import { WebClient } from "@slack/web-api";

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));


export interface SlackReply {
  sender: string;
  senderName: string;
  text: string;
  timestamp: string;
}

export interface SlackReaction {
  name: string;
  count: number;
  users: string[];
}

export interface SlackMessage {
  id: string;
  channel: string;
  channelName: string;
  text: string;
  sender: string;
  senderName: string;
  threadTs: string | null;
  replyCount: number;
  replyUserNames?: string[];
  replies: SlackReply[];
  permalink: string;
  timestamp: string;
  isUnread: boolean;
  files?: { name: string; mimetype: string; url: string; thumb?: string }[];
  reactions?: SlackReaction[];
  isThreadReply?: boolean;
  // Used by UI for grouping
  newReplies?: SlackReply[];
  hasNewReplies?: boolean;
}

export interface SlackChannel {
  id: string;
  name: string;
  isDm: boolean;
  memberCount?: number;
}

// ─── User resolution cache ───────────────────────────────────────────
const userCache = new Map<string, string>();

async function resolveUsers(client: WebClient, userIds: string[]): Promise<void> {
  const toResolve = userIds.filter((id) => !userCache.has(id));
  // Resolve all in parallel — SDK handles rate limits
  await Promise.all(
    toResolve.map(async (uid) => {
      try {
        const info = await client.users.info({ user: uid });
        userCache.set(uid, info.user?.real_name ?? info.user?.name ?? uid);
      } catch {
        userCache.set(uid, uid);
      }
    })
  );
}

function getUserName(uid: string): string {
  return userCache.get(uid) ?? uid;
}

function cleanSlackTextSync(text: string): string {
  let cleaned = text.replace(/<@([A-Z0-9]+)\|([^>]+)>/g, (_m, _uid, name) => `@${name}`);
  cleaned = cleaned.replace(/<@([A-Z0-9]+)>/g, (_m, uid) => `@${getUserName(uid)}`);
  cleaned = cleaned.replace(/<#[A-Z0-9]+\|([^>]+)>/g, "#$1");
  return cleaned;
}

const channelNameCache = new Map<string, string>();
const lastReadCache = new Map<string, { ts: string; updatedAt: number }>();

export function updateLastReadCache(channelId: string, lastRead: string): void {
  lastReadCache.set(channelId, { ts: lastRead, updatedAt: Date.now() });
}

function makePermalink(channelId: string, ts: string): string {
  return `https://app.slack.com/client/${channelId}/p${ts.replace(".", "")}`;
}

// ─── Channel listing ─────────────────────────────────────────────────

export async function listUserChannels(userToken: string): Promise<SlackChannel[]> {
  const client = new WebClient(userToken, { retryConfig: { retries: 0 }, rejectRateLimitedCalls: true });
  const channels: SlackChannel[] = [];
  const oneWeekAgo = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;

  let cursor: string | undefined;
  do {
    const res = await client.users.conversations({
      types: "public_channel,private_channel",
      exclude_archived: true,
      limit: 200,
      cursor,
    });
    for (const ch of res.channels ?? []) {
      if (!ch.id || !ch.name) continue;
      const raw = ch as Record<string, unknown>;
      const updated = raw.updated as number | undefined;
      if (updated && updated < oneWeekAgo) continue;
      channels.push({
        id: ch.id,
        name: ch.name,
        isDm: false,
        memberCount: (raw.num_members as number) ?? undefined,
      });
    }
    cursor = res.response_metadata?.next_cursor || undefined;
  } while (cursor);

  channels.sort((a, b) => a.name.localeCompare(b.name));
  return channels;
}

// ─── Core: fetch unread channels matching Slack's read state ─────────

interface ChannelWithUnreads {
  id: string;
  name: string;
  isDm: boolean;
  lastRead: string;
  unreadCount: number;
}

/**
 * Search Slack and extract channel info from results.
 * Returns a map of channel ID → channel metadata.
 */
async function searchChannels(
  client: WebClient,
  query: string,
  count: number = 50,
): Promise<Map<string, { name: string; isDm: boolean; userId?: string }>> {
  const channelMap = new Map<string, { name: string; isDm: boolean; userId?: string }>();
  const res = await client.search.messages({ query, sort: "timestamp", sort_dir: "desc", count }).catch(() => null);
  if (!res) return channelMap;
  const matches = ((res.messages as Record<string, unknown>)?.matches ?? []) as Array<Record<string, unknown>>;
  for (const match of matches) {
    const ch = match.channel as Record<string, unknown> | undefined;
    const chId = ch?.id as string;
    if (!chId || channelMap.has(chId)) continue;
    const isDm = chId.startsWith("D");
    const isMpim = chId.startsWith("G");
    const name = (ch?.name as string) ?? chId;
    channelMap.set(chId, { name, isDm: isDm || isMpim, userId: isDm ? name : undefined });
  }
  return channelMap;
}

/**
 * Given a set of channel IDs, get last_read and filter to those with actual unreads.
 * Batches conversations.info calls to avoid rate limits (Tier 3 = ~50/min).
 */
async function filterToUnread(
  client: WebClient,
  channelMap: Map<string, { name: string; isDm: boolean; userId?: string }>,
): Promise<ChannelWithUnreads[]> {
  const channelIds = [...channelMap.keys()];
  const infoResults: ({ chId: string; lastRead: string; latestTs: string | undefined } | null)[] = [];

  // Batch in groups of 3 with 2s delays to stay within Tier 3 rate limits (~50/min)
  const batchSize = 3;
  for (let i = 0; i < channelIds.length; i += batchSize) {
    if (i > 0) await sleep(2000);
    const batch = channelIds.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(async (chId) => {
        try {
          const info = await client.conversations.info({ channel: chId });
          const c = info.channel as Record<string, unknown>;
          const lr = (c.last_read as string) ?? "0";
          const latest = c.latest as Record<string, unknown> | undefined;
          const latestTs = latest?.ts as string | undefined;
          updateLastReadCache(chId, lr);
          return { chId, lastRead: lr, latestTs };
        } catch {
          return null;
        }
      })
    );
    infoResults.push(...batchResults);
  }

  const userIdsToResolve = new Set<string>();
  const unreadChannels: ChannelWithUnreads[] = [];

  for (const result of infoResults) {
    if (!result) continue;
    const { chId, lastRead, latestTs } = result;
    if (lastRead !== "0" && lastRead !== "0000000000.000000" && latestTs) {
      if (parseFloat(latestTs) <= parseFloat(lastRead)) continue;
    }
    const chInfo = channelMap.get(chId)!;
    if (chInfo.isDm && chInfo.userId && /^[A-Z][A-Z0-9]{8,}$/.test(chInfo.userId)) {
      userIdsToResolve.add(chInfo.userId);
    }
    if (/^[A-Z][A-Z0-9]{8,}$/.test(chInfo.name)) userIdsToResolve.add(chInfo.name);
    unreadChannels.push({
      id: chId, name: chInfo.name, isDm: chInfo.isDm,
      lastRead: (lastRead === "0000000000.000000" ? "0" : lastRead), unreadCount: 1,
    });
  }

  if (userIdsToResolve.size > 0) await resolveUsers(client, [...userIdsToResolve]);

  for (const ch of unreadChannels) {
    if (/^[A-Z][A-Z0-9]{8,}$/.test(ch.name)) {
      const resolved = getUserName(ch.name);
      if (resolved !== ch.name) ch.name = `DM: ${resolved}`;
    }
    if (ch.isDm && !ch.name.startsWith("DM:")) ch.name = `DM: ${ch.name}`;
    channelNameCache.set(ch.id, ch.name);
  }

  return unreadChannels;
}

interface SlackFile {
  name: string;
  mimetype: string;
  url: string;
  thumb?: string;
}

const ALLOWED_SUBTYPES = new Set(["thread_broadcast", "file_share", "me_message", "bot_message"]);

/**
 * For a single channel, fetch messages in a SINGLE API call.
 * Uses cached last_read when available, falls back to conversations.info only when needed.
 * Returns raw messages with isUnread flag, plus collected user IDs.
 */
async function fetchChannelRaw(
  client: WebClient,
  channel: ChannelWithUnreads,
  contextCount: number = 3,
): Promise<{ messages: SlackMessage[]; userIds: Set<string> }> {
  const userIds = new Set<string>();

  // Use last_read from channel (already populated by filterToUnread via bulk fetch)
  let lastRead = channel.lastRead;
  if (lastRead === "0") {
    const cached = lastReadCache.get(channel.id);
    lastRead = cached?.ts ?? "0";
  }

  // If still no last_read, use 4h lookback as fallback
  if (lastRead === "0") {
    lastRead = String(Math.floor(Date.now() / 1000) - 4 * 60 * 60);
  }

  // Single API call: fetch last ~20 messages (enough for context + unread)
  let res;
  try {
    // Fetch a window around last_read: go back a bit for context
    res = await client.conversations.history({
      channel: channel.id,
      limit: 20 + contextCount,
    });
  } catch {
    return { messages: [], userIds };
  }

  const allMsgs = ((res.messages ?? []) as Array<Record<string, unknown>>).reverse(); // oldest first
  if (allMsgs.length === 0) return { messages: [], userIds };

  // Split into context (before last_read) and unread (after last_read)
  const lastReadF = parseFloat(lastRead);
  const unreadMsgs = allMsgs.filter(m => parseFloat((m.ts as string) ?? "0") > lastReadF);
  if (unreadMsgs.length === 0) return { messages: [], userIds };

  // Get context: messages just before the unread boundary
  const contextMsgs = allMsgs
    .filter(m => parseFloat((m.ts as string) ?? "0") <= lastReadF)
    .slice(-contextCount);

  // Collect user IDs
  for (const msg of [...contextMsgs, ...unreadMsgs]) {
    if (msg.user) userIds.add(msg.user as string);
    const text = (msg.text as string) ?? "";
    for (const match of text.matchAll(/<@([A-Z0-9]+)/g)) userIds.add(match[1]);
    const replyUsers = msg.reply_users as string[] | undefined;
    if (replyUsers) for (const u of replyUsers) userIds.add(u);
  }

  const parseMsg = (raw: Record<string, unknown>, isUnread: boolean): SlackMessage | null => {
    const subtype = raw.subtype as string | undefined;
    if (subtype && !ALLOWED_SUBTYPES.has(subtype)) return null;
    const ts = (raw.ts as string) ?? "";
    const user = (raw.user as string) || (raw.bot_id as string) || "";

    const rawFiles = raw.files as Array<Record<string, unknown>> | undefined;
    const files: SlackFile[] = [];
    if (rawFiles) {
      for (const f of rawFiles) {
        const url = (f.url_private as string) ?? (f.permalink as string) ?? "";
        if (url) files.push({
          name: (f.name as string) ?? "file",
          mimetype: (f.mimetype as string) ?? "",
          url,
          thumb: (f.thumb_360 as string) ?? (f.thumb_480 as string) ?? undefined,
        });
      }
    }

    const rawReactions = raw.reactions as Array<{ name: string; count: number; users: string[] }> | undefined;
    const reactions = rawReactions?.map(r => ({ name: r.name, count: r.count, users: r.users ?? [] }));
    const threadTs = raw.thread_ts as string | undefined;
    const replyUsers = raw.reply_users as string[] | undefined;

    // Include attachment text (bot messages often put content in attachments)
    let text = (raw.text as string) ?? "";
    const rawAttachments = raw.attachments as Array<Record<string, unknown>> | undefined;
    if (rawAttachments) {
      for (const att of rawAttachments) {
        let attText = (att.text as string) || (att.fallback as string) || "";
        attText = attText.replace(/```/g, "").trim();
        if (attText && !text.includes(attText.substring(0, 50))) {
          text += (text ? "\n" : "") + attText;
        }
      }
    }

    return {
      id: `${channel.id}-${ts}`,
      channel: channel.id,
      channelName: channel.name,
      text,
      sender: user,
      senderName: (raw.username as string) || user,
      threadTs: threadTs ?? null,
      replyCount: (raw.reply_count as number) ?? 0,
      replyUserNames: replyUsers ? [...replyUsers] : undefined,
      replies: [],
      permalink: makePermalink(channel.id, ts),
      isUnread,
      timestamp: ts,
      files: files.length > 0 ? files : undefined,
      reactions: reactions && reactions.length > 0 ? reactions : undefined,
      isThreadReply: !!(threadTs && threadTs !== ts),
    };
  };

  const contextParsed = contextMsgs.map(m => parseMsg(m, false)).filter((m): m is SlackMessage => m !== null);
  const newParsed = unreadMsgs.map(m => parseMsg(m, true)).filter((m): m is SlackMessage => m !== null);

  // Update cache with the latest message's ts
  const latestTs = allMsgs[allMsgs.length - 1]?.ts as string;
  if (latestTs) updateLastReadCache(channel.id, lastRead); // keep current last_read

  return { messages: [...contextParsed, ...newParsed], userIds };
}

/** After user resolution, fix up names and clean text in-place */
function resolveMessageNames(messages: SlackMessage[]): void {
  for (const msg of messages) {
    const resolved = msg.sender ? getUserName(msg.sender) : "unknown";
    // Keep existing senderName (e.g. bot username) if user resolution returned the raw ID
    msg.senderName = (resolved !== msg.sender) ? resolved : (msg.senderName || resolved);
    msg.text = cleanSlackTextSync(msg.text);
    if (msg.replyUserNames) {
      msg.replyUserNames = msg.replyUserNames.map(u => getUserName(u)).filter(Boolean);
    }
  }
}

// ─── Phased sync ─────────────────────────────────────────────────────
//
// Phases (executed sequentially, UI updates after each):
//   1. DMs — search "to:me", filter to DM channel IDs
//   2. Mentions — search "<@userId>", filter to non-DM channels
//   3. Thread mentions — already caught by phase 2 (threads show in search)
//   4. Subscribed threads — search "from:me has:thread" → conversations.replies
export type SyncPhase = 1 | 2 | 3 | 4;

/** Fetch messages for a batch of channels, resolve names, return them.
 *  Batches history calls in groups of 8 to avoid rate limits. */
async function fetchAndResolve(
  client: WebClient,
  channels: ChannelWithUnreads[],
): Promise<SlackMessage[]> {
  if (channels.length === 0) return [];
  const allUserIds = new Set<string>();
  const messages: SlackMessage[] = [];
  const batchSize = 8;
  for (let i = 0; i < channels.length; i += batchSize) {
    const batch = channels.slice(i, i + batchSize);
    const results = await Promise.all(batch.map(ch => fetchChannelRaw(client, ch, 3)));
    for (const { messages: msgs, userIds } of results) {
      for (const uid of userIds) allUserIds.add(uid);
      messages.push(...msgs);
    }
    if (i + batchSize < channels.length) await sleep(200);
  }
  if (allUserIds.size > 0) await resolveUsers(client, [...allUserIds]);
  resolveMessageNames(messages);
  return messages;
}

// ─── Main export: fetch all unread channel messages ──────────────────

export async function fetchChannelMessages(
  userToken: string,
  userId: string,
  onProgress?: (status: string) => void,
  _watchedChannelIds?: string[],
  lookbackMinutes?: number,
  onMessages?: (messages: SlackMessage[]) => void,
  activeDmChannelIds?: string[],
  /** Which phases to run (default: all). Phases 1-2 = urgent, 3-5 = full */
  phases?: SyncPhase[],
): Promise<SlackMessage[]> {
  const client = new WebClient(userToken, { retryConfig: { retries: 0 }, rejectRateLimitedCalls: true });
  const runPhases = new Set(phases ?? [1, 2, 3, 4]);

  const allMessages: SlackMessage[] = [];
  const seenMsgIds = new Set<string>();
  const fetchedChannelIds = new Set<string>(); // track which channels we've already fetched

  const addMessages = (msgs: SlackMessage[]) => {
    for (const m of msgs) {
      if (!seenMsgIds.has(m.id)) {
        seenMsgIds.add(m.id);
        allMessages.push(m);
        fetchedChannelIds.add(m.channel);
      }
    }
    if (onMessages && allMessages.length > 0) {
      onMessages([...allMessages].sort((a, b) => parseFloat(b.timestamp) - parseFloat(a.timestamp)));
    }
  };

  const t0 = Date.now();

    // ── Phase 1: DMs ──
    if (runPhases.has(1)) {
      onProgress?.("phase 1: checking DMs");
      const dmChannels = await searchChannels(client, "to:me", 50);
      // Filter to DM-type channels only
      const dmsOnly = new Map<string, { name: string; isDm: boolean; userId?: string }>();
      for (const [id, ch] of dmChannels) {
        if (ch.isDm) dmsOnly.set(id, ch);
      }
      if (dmsOnly.size > 0) {
        const unread = await filterToUnread(client, dmsOnly);
        onProgress?.(`phase 1: ${unread.length} DM channels with unreads`);
        const msgs = await fetchAndResolve(client, unread.slice(0, 20));
        addMessages(msgs);
        console.log(`[slack] Phase 1 (DMs): ${msgs.length} msgs in ${Date.now() - t0}ms`);
      } else {
        onProgress?.("phase 1: no unread DMs");
      }
    }

    // ── Phase 2: Mentions (non-DM channels) ──
    if (runPhases.has(2)) {
      const t2 = Date.now();
      onProgress?.("phase 2: checking mentions");
      const mentionChannels = await searchChannels(client, `<@${userId}>`, 50);
      // Filter OUT DM channels (already handled in phase 1)
      const nonDms = new Map<string, { name: string; isDm: boolean; userId?: string }>();
      for (const [id, ch] of mentionChannels) {
        if (!ch.isDm && !fetchedChannelIds.has(id)) nonDms.set(id, ch);
      }
      if (nonDms.size > 0) {
        const unread = await filterToUnread(client, nonDms);
        onProgress?.(`phase 2: ${unread.length} channels with mentions`);
        const msgs = await fetchAndResolve(client, unread.slice(0, 20));
        addMessages(msgs);
        console.log(`[slack] Phase 2 (mentions): ${msgs.length} msgs in ${Date.now() - t2}ms`);
      } else {
        onProgress?.("phase 2: no unread mentions");
      }
    }

    // ── Phase 3: Thread mentions (already caught by phase 2 search, but
    //    we also search "to:me" in non-DM channels for threads where user
    //    was mentioned but hasn't posted) ──
    if (runPhases.has(3)) {
      const t3 = Date.now();
      onProgress?.("phase 3: checking thread mentions");
      // "to:me" also catches channels — filter to only ones not yet seen
      const toMeChannels = await searchChannels(client, "to:me", 50);
      const newNonDms = new Map<string, { name: string; isDm: boolean; userId?: string }>();
      for (const [id, ch] of toMeChannels) {
        if (!ch.isDm && !fetchedChannelIds.has(id)) newNonDms.set(id, ch);
      }
      if (newNonDms.size > 0) {
        const unread = await filterToUnread(client, newNonDms);
        const msgs = await fetchAndResolve(client, unread.slice(0, 15));
        addMessages(msgs);
        console.log(`[slack] Phase 3 (thread mentions): ${msgs.length} msgs in ${Date.now() - t3}ms`);
      }
    }

    // ── Phase 4: Subscribed threads with unread replies ──
    if (runPhases.has(4)) {
      const t4 = Date.now();
      onProgress?.("phase 4: checking subscribed threads");
      try {
        const threadMsgs = await fetchUnreadThreads(client, userId);
        addMessages(threadMsgs);
        console.log(`[slack] Phase 4 (threads): ${threadMsgs.length} msgs in ${Date.now() - t4}ms`);
      } catch (e) {
        console.error(`[slack] Phase 4 failed: ${e instanceof Error ? e.message : e}`);
      }
    }

    // Save user's own messages for style learning
    try {
      const { getDb } = await import("@/lib/db");
      const db = getDb();
      const insertStyle = db.prepare(
        `INSERT OR IGNORE INTO slack_style (channel, text, timestamp) VALUES (?, ?, ?)`
      );
      for (const m of allMessages) {
        if (m.sender === userId && m.text.length > 1) {
          insertStyle.run(m.channelName, m.text, m.timestamp);
        }
      }
    } catch { /* non-fatal */ }

    allMessages.sort((a, b) => parseFloat(b.timestamp) - parseFloat(a.timestamp));
    console.log(`[slack] Sync complete: ${allMessages.length} messages, phases [${[...runPhases].join(",")}] in ${Date.now() - t0}ms`);
    return allMessages;
}

// ─── Thread unread detection ─────────────────────────────────────────

/**
 * Find threads the user is subscribed to that have unread replies.
 * Uses search "from:me has:thread" to discover threads, then checks
 * conversations.replies for each to find unread ones.
 */
async function fetchUnreadThreads(
  client: WebClient,
  userId: string,
  onMessages?: (messages: SlackMessage[]) => void,
): Promise<SlackMessage[]> {
  const t0 = Date.now();

  // Search for threads the user participated in
  const searchRes = await client.search.messages({
    query: "from:me has:thread",
    sort: "timestamp",
    sort_dir: "desc",
    count: 20,
  }).catch(() => null);

  if (!searchRes) return [];

  const matches = ((searchRes.messages as Record<string, unknown>)?.matches ?? []) as Array<Record<string, unknown>>;

  // Get unique thread roots (channel + thread_ts)
  const threads: { channelId: string; channelName: string; threadTs: string }[] = [];
  const seen = new Set<string>();
  for (const match of matches) {
    const ch = match.channel as Record<string, unknown> | undefined;
    const chId = ch?.id as string;
    const ts = (match.ts as string) ?? "";
    // The search result ts IS the thread parent ts for parent messages
    const threadTs = (match.thread_ts as string) ?? ts;
    const key = `${chId}-${threadTs}`;
    if (!chId || seen.has(key)) continue;
    seen.add(key);
    const isDm = chId.startsWith("D") || chId.startsWith("G");
    const name = channelNameCache.get(chId) ?? (ch?.name as string) ?? chId;
    threads.push({ channelId: chId, channelName: isDm && !name.startsWith("DM:") ? `DM: ${name}` : name, threadTs });
  }

  console.log(`[slack] Found ${threads.length} threads to check for unreads`);
  if (threads.length === 0) return [];

  // Check each thread in parallel for unread replies
  const allMessages: SlackMessage[] = [];
  const allUserIds = new Set<string>();

  const threadResults = await Promise.all(
    threads.map(async (thread) => {
      try {
        const res = await client.conversations.replies({
          channel: thread.channelId,
          ts: thread.threadTs,
          limit: 20,
        });
        const msgs = (res.messages ?? []) as Array<Record<string, unknown>>;
        if (msgs.length < 2) return null; // No replies

        // Parent message has last_read and subscribed
        const parent = msgs[0];
        const lastRead = parent.last_read as string | undefined;
        const subscribed = parent.subscribed as boolean | undefined;
        if (!subscribed || !lastRead) return null;

        // Find unread replies (after last_read)
        const lastReadF = parseFloat(lastRead);
        const unreadReplies = msgs.slice(1).filter(m => {
          const ts = parseFloat((m.ts as string) ?? "0");
          const user = m.user as string;
          return ts > lastReadF && user !== userId; // Skip own messages
        });

        if (unreadReplies.length === 0) return null;

        // Get context (last read reply before the unread boundary)
        const readReplies = msgs.slice(1).filter(m => parseFloat((m.ts as string) ?? "0") <= lastReadF);
        const contextReplies = readReplies.slice(-2);

        // Collect user IDs
        for (const m of [...contextReplies, ...unreadReplies]) {
          if (m.user) allUserIds.add(m.user as string);
          const text = (m.text as string) ?? "";
          for (const match of text.matchAll(/<@([A-Z0-9]+)/g)) allUserIds.add(match[1]);
        }

        // Build parent text summary
        const parentText = (parent.text as string) ?? "";
        allUserIds.add(parent.user as string);

        return { thread, parent, parentText, contextReplies, unreadReplies, lastRead };
      } catch {
        return null;
      }
    })
  );

  // Resolve all users at once
  if (allUserIds.size > 0) await resolveUsers(client, [...allUserIds]);

  // Build messages
  for (const result of threadResults) {
    if (!result) continue;
    const { thread, parent, parentText, contextReplies, unreadReplies } = result;
    const parentUser = (parent.user as string) ?? "";

    // Create a thread parent message with replies inline
    const threadMsg: SlackMessage = {
      id: `${thread.channelId}-${thread.threadTs}`,
      channel: thread.channelId,
      channelName: thread.channelName,
      text: cleanSlackTextSync(parentText),
      sender: parentUser,
      senderName: getUserName(parentUser),
      threadTs: thread.threadTs,
      replyCount: unreadReplies.length,
      replies: [],
      permalink: makePermalink(thread.channelId, thread.threadTs),
      isUnread: true,
      timestamp: thread.threadTs,
      hasNewReplies: true,
      isThreadReply: false,
    };

    // Add context + unread replies
    for (const m of contextReplies) {
      const user = (m.user as string) ?? "";
      threadMsg.replies.push({
        sender: user,
        senderName: getUserName(user),
        text: cleanSlackTextSync((m.text as string) ?? ""),
        timestamp: (m.ts as string) ?? "",
      });
    }
    if (!threadMsg.newReplies) threadMsg.newReplies = [];
    for (const m of unreadReplies) {
      const user = (m.user as string) ?? "";
      threadMsg.newReplies.push({
        sender: user,
        senderName: getUserName(user),
        text: cleanSlackTextSync((m.text as string) ?? ""),
        timestamp: (m.ts as string) ?? "",
      });
    }

    allMessages.push(threadMsg);
  }

  console.log(`[slack] Found ${allMessages.length} threads with unread replies in ${Date.now() - t0}ms`);
  if (onMessages && allMessages.length > 0) onMessages(allMessages);
  return allMessages;
}

// ─── Startup sync ────────────────────────────────────────────────────

export async function startupSlackSync(): Promise<void> {
  try {
    const { getDb, getSetting } = await import("@/lib/db");
    const { getProfile, upsertItem, removeStaleItems } = await import("@/lib/items");
    const { notifyChange } = await import("@/lib/changeNotifier");

    const profile = getProfile();
    if (!profile?.slack_token || !profile?.slack_user_id) {
      console.log("[slack-startup] No Slack credentials configured, skipping startup sync");
      return;
    }

    console.log("[slack-startup] Starting sync");
    const messages = await fetchChannelMessages(
      profile.slack_token,
      profile.slack_user_id,
      (status) => console.log(`[slack-startup] ${status}`),
    );

    const sourceIds: string[] = [];
    for (const msg of messages) {
      sourceIds.push(msg.id);
      upsertItem({
        source: "slack",
        source_id: msg.id,
        title: `#${msg.channelName} — ${msg.senderName}: ${msg.text.substring(0, 100)}`,
        url: msg.permalink,
        raw_data: JSON.stringify(msg),
      });
    }
    removeStaleItems("slack", sourceIds);
    notifyChange();
    console.log(`[slack-startup] Sync complete: ${messages.length} messages`);
  } catch (e) {
    console.error("[slack-startup] Sync failed:", e instanceof Error ? e.message : e);
  }
}

// ─── Actions ─────────────────────────────────────────────────────────

export async function sendReply(
  userToken: string,
  channel: string,
  text: string,
  threadTs?: string,
): Promise<string | undefined> {
  const client = new WebClient(userToken, { retryConfig: { retries: 0 }, rejectRateLimitedCalls: true });
  const res = await client.chat.postMessage({ channel, text, thread_ts: threadTs });
  return res.ts;
}

export async function addReaction(
  userToken: string,
  channel: string,
  timestamp: string,
  reaction: string,
): Promise<void> {
  const client = new WebClient(userToken, { retryConfig: { retries: 0 }, rejectRateLimitedCalls: true });
  await client.reactions.add({ channel, timestamp, name: reaction });
}

export async function markAsRead(
  userToken: string,
  channel: string,
  timestamp: string,
  threadTs?: string,
): Promise<void> {
  const client = new WebClient(userToken, { retryConfig: { retries: 0 }, rejectRateLimitedCalls: true });
  try {
    // Mark channel as read
    await client.conversations.mark({ channel, ts: timestamp });
    // Also update our cache so next sync knows this channel is read
    updateLastReadCache(channel, timestamp);
  } catch (e) {
    console.log(`[slack] Failed to mark ${channel} as read: ${e instanceof Error ? e.message : e}`);
  }
}
