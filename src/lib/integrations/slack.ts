import { WebClient } from "@slack/web-api";

export interface SlackReply {
  sender: string;
  senderName: string;
  text: string;
  timestamp: string;
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
  isThreadReply?: boolean;
}

export interface SlackChannel {
  id: string;
  name: string;
  isDm: boolean;
  memberCount?: number;
}

// Persistent cache across syncs (same process)
const userCache = new Map<string, string>();

async function resolveUsers(client: WebClient, userIds: string[]): Promise<void> {
  const toResolve = userIds.filter((id) => !userCache.has(id));
  for (let i = 0; i < toResolve.length; i += 10) {
    const batch = toResolve.slice(i, i + 10);
    await Promise.all(
      batch.map(async (uid) => {
        try {
          const info = await client.users.info({ user: uid });
          userCache.set(uid, info.user?.real_name ?? info.user?.name ?? uid);
        } catch {
          userCache.set(uid, uid);
        }
      })
    );
  }
}

function getUserName(uid: string): string {
  return userCache.get(uid) ?? uid;
}

function cleanSlackTextSync(text: string): string {
  // Resolve mentions and channels but keep URL markup for the frontend to render as clickable links
  let cleaned = text.replace(/<@([A-Z0-9]+)\|([^>]+)>/g, (_m, _uid, name) => `@${name}`);
  cleaned = cleaned.replace(/<@([A-Z0-9]+)>/g, (_m, uid) => `@${getUserName(uid)}`);
  cleaned = cleaned.replace(/<#[A-Z0-9]+\|([^>]+)>/g, "#$1");
  // Keep <url|label> and <url> intact — the frontend SlackText component renders these as clickable links
  return cleaned;
}

const channelNameCache = new Map<string, string>();

/**
 * List channels the user is a member of that have had activity in the last 7 days.
 */
export async function listUserChannels(userToken: string): Promise<SlackChannel[]> {
  const client = new WebClient(userToken);
  const channels: SlackChannel[] = [];
  const oneWeekAgo = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;

  // users.conversations only returns channels the user is in — much faster
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
      // Filter to recently active channels
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

/**
 * Fetch messages from specific watched channels + all DMs for the last 24h.
 * Includes the user's own messages so DM conversations show both sides.
 */
// Cache DM channels across quick syncs
let cachedDmChannels: { id: string; userId: string }[] | null = null;

export async function fetchChannelMessages(
  userToken: string,
  userId: string,
  onProgress?: (status: string) => void,
  watchedChannelIds?: string[],
  lookbackMinutes?: number,
  onMessages?: (messages: SlackMessage[]) => void,
  activeDmChannelIds?: string[],
): Promise<SlackMessage[]> {
  const client = new WebClient(userToken);
  const lookbackSec = (lookbackMinutes ?? 24 * 60) * 60;
  const oldest = String(Math.floor(Date.now() / 1000) - lookbackSec);
  const isQuickSync = lookbackMinutes != null && lookbackMinutes < 60;

  // Build list of channels to fetch: watched channels + DMs
  interface ChannelToFetch {
    id: string;
    name: string;
    isDm: boolean;
    lastRead: string;
  }

  const channelsToFetch: ChannelToFetch[] = [];

  // Add watched channels (fetch info + last_read in parallel)
  if (watchedChannelIds && watchedChannelIds.length > 0) {
    if (isQuickSync) {
      // On quick sync, skip conversations.info — use cached names, don't fetch last_read
      for (const chId of watchedChannelIds) {
        channelsToFetch.push({ id: chId, name: channelNameCache.get(chId) ?? chId, isDm: false, lastRead: "0" });
      }
    } else {
      const results = await Promise.all(
        watchedChannelIds.map(async (chId) => {
          try {
            const info = await client.conversations.info({ channel: chId });
            const c = info.channel as Record<string, unknown>;
            const name = (c?.name as string) ?? chId;
            const lastRead = (c?.last_read as string) ?? "0";
            channelNameCache.set(chId, name);
            return { id: chId, name, isDm: false, lastRead };
          } catch {
            return { id: chId, name: channelNameCache.get(chId) ?? chId, isDm: false, lastRead: "0" };
          }
        })
      );
      channelsToFetch.push(...results);
    }
  }

  // On quick sync, refresh only the active DM channels (ones currently showing in UI)
  if (isQuickSync && activeDmChannelIds && activeDmChannelIds.length > 0) {
    for (const chId of activeDmChannelIds) {
      channelsToFetch.push({ id: chId, name: channelNameCache.get(chId) ?? `DM: ${chId}`, isDm: true, lastRead: "0" });
    }
  }

  // Full sync: discover all DMs
  if (!isQuickSync) {
    onProgress?.("finding DMs");
    const allDms: { id: string; userId: string; updated: number }[] = [];
    let cursor: string | undefined;
    do {
      const res = await client.conversations.list({
        types: "im",
        exclude_archived: true,
        limit: 200,
        cursor,
      });
      for (const ch of res.channels ?? []) {
        if (ch.id) {
          const c = ch as Record<string, unknown>;
          allDms.push({ id: ch.id, userId: (c.user as string) ?? "", updated: (c.updated as number) ?? 0 });
        }
      }
      cursor = res.response_metadata?.next_cursor || undefined;
    } while (cursor);

    const cutoff = Math.floor(Date.now() / 1000) - lookbackSec;
    const activeDms = allDms.filter(dm => dm.updated >= cutoff);
    console.log(`[slack] ${allDms.length} total DMs, ${activeDms.length} active within lookback`);

    const dmUserIds = activeDms.map((d) => d.userId).filter(Boolean);
    await resolveUsers(client, dmUserIds);

    for (const dm of activeDms) {
      channelsToFetch.push({ id: dm.id, name: `DM: ${getUserName(dm.userId)}`, isDm: true, lastRead: "0" });
    }
  }

  onProgress?.(`fetching ${channelsToFetch.length} channels`);

  // Helper for permalink generation (used in multiple code paths)
  const makePermalink = (channelId: string, ts: string) => {
    const tsClean = ts.replace(".", "");
    return `https://app.slack.com/client/${channelId}/p${tsClean}`;
  };

  // On quick sync with few/no channels, skip heavy history fetch — just use mention search
  if (isQuickSync && channelsToFetch.length === 0) {
    const filteredMessages: SlackMessage[] = [];
    onProgress?.("searching for mentions");
    try {
      const mentionRes = await client.search.messages({
        query: `<@${userId}>`,
        sort: "timestamp",
        sort_dir: "desc",
        count: 20,
      });
      const rawMatches = ((mentionRes.messages as Record<string, unknown>)?.matches ?? []) as Array<Record<string, unknown>>;
      console.log(`[slack] Quick mention search returned ${rawMatches.length} matches`);
      const mentionUserIds = new Set<string>();
      const userIdChannelNames = new Set<string>();
      for (const match of rawMatches) {
        const ts = match.ts as string;
        if (!ts || parseFloat(ts) < parseFloat(oldest)) continue;
        const chObj = match.channel as Record<string, unknown> | undefined;
        const channelId = chObj?.id as string ?? "";
        const channelName = chObj?.name as string ?? "";
        // Skip DM mentions — DMs are fetched through the DM channel path
        if (channelId.startsWith("D")) continue;
        const user = match.user as string ?? match.username as string;
        if (user === userId) continue;
        if (user) mentionUserIds.add(user);
        if (channelName && /^[A-Z][A-Z0-9]{8,}$/.test(channelName)) userIdChannelNames.add(channelName);
        const isThreadReply = !!(match.thread_ts && match.thread_ts !== match.ts);
        filteredMessages.push({
          id: `${channelId}-${ts}`,
          channel: channelId,
          channelName: channelName || channelNameCache.get(channelId) || channelId,
          text: cleanSlackTextSync(match.text as string ?? ""),
          sender: user ?? "",
          senderName: user ? getUserName(user) : "unknown",
          threadTs: match.thread_ts as string ?? null,
          replyCount: 0,
          replies: [],
          permalink: match.permalink as string ?? makePermalink(channelId, ts),
          isUnread: true,
          timestamp: ts,
          isThreadReply,
        });
      }
      await resolveUsers(client, [...mentionUserIds, ...userIdChannelNames]);
      for (const m of filteredMessages) {
        if (m.sender) m.senderName = getUserName(m.sender);
        // Fix user-ID-like channel names
        if (/^[A-Z][A-Z0-9]{8,}$/.test(m.channelName)) {
          const resolved = getUserName(m.channelName);
          if (resolved !== m.channelName) m.channelName = resolved;
        }
        // DM channels need "DM: " prefix for UI identification
        if (m.channel.startsWith("D") && !m.channelName.startsWith("DM:")) {
          m.channelName = `DM: ${m.channelName}`;
        }
      }
    } catch (e) {
      console.log(`[slack] Quick mention search failed: ${e instanceof Error ? e.message : e}`);
    }
    console.log(`[slack] Quick sync: ${filteredMessages.length} mention messages`);
    filteredMessages.sort((a, b) => parseFloat(b.timestamp) - parseFloat(a.timestamp));
    return filteredMessages;
  }

  // Fetch history for all channels in parallel
  interface SlackFile {
    name: string;
    mimetype: string;
    url: string;
    thumb?: string;
  }

  interface RawMsg {
    channelId: string;
    channelName: string;
    isDm: boolean;
    lastRead: string;
    user?: string;
    text: string;
    ts: string;
    threadTs?: string;
    replyCount: number;
    replyUsers?: string[];
    files?: SlackFile[];
  }

  const allMessages: SlackMessage[] = [];
  let fetchedCount = 0;

  const batchSize = isQuickSync ? 20 : 10;
  for (let i = 0; i < channelsToFetch.length; i += batchSize) {
    const batch = channelsToFetch.slice(i, i + batchSize);
    const batchRaw: RawMsg[] = [];

    const results = await Promise.all(
      batch.map(async (ch) => {
        try {
          const res = await client.conversations.history({
            channel: ch.id,
            oldest,
            limit: 100,
          });
          const msgs: RawMsg[] = [];
          for (const msg of res.messages ?? []) {
            if (msg.subtype && msg.subtype !== "thread_broadcast") continue;
            // Extract file attachments (images, etc.)
            const rawMsg = msg as Record<string, unknown>;
            const rawFiles = rawMsg.files as Array<Record<string, unknown>> | undefined;
            const files: SlackFile[] = [];
            if (rawFiles) {
              for (const f of rawFiles) {
                const mimetype = (f.mimetype as string) ?? "";
                const url = (f.url_private as string) ?? (f.permalink as string) ?? "";
                if (url) {
                  files.push({
                    name: (f.name as string) ?? "file",
                    mimetype,
                    url,
                    thumb: (f.thumb_360 as string) ?? (f.thumb_480 as string) ?? undefined,
                  });
                }
              }
            }
            msgs.push({
              channelId: ch.id,
              channelName: ch.name,
              isDm: ch.isDm,
              lastRead: ch.lastRead,
              user: msg.user,
              text: msg.text ?? "",
              ts: msg.ts ?? "",
              threadTs: rawMsg.thread_ts as string | undefined,
              replyCount: rawMsg.reply_count as number ?? 0,
              replyUsers: rawMsg.reply_users as string[] | undefined,
              files: files.length > 0 ? files : undefined,
            });
          }
          return msgs;
        } catch (e) {
          console.log(`[slack] Failed to fetch ${ch.name}: ${e instanceof Error ? e.message : e}`);
          return [];
        }
      })
    );
    for (const msgs of results) batchRaw.push(...msgs);

    // Resolve users for this batch (including thread reply participants)
    const batchUserIds = new Set<string>();
    for (const m of batchRaw) {
      if (m.user) batchUserIds.add(m.user);
      for (const match of m.text.matchAll(/<@([A-Z0-9]+)/g)) batchUserIds.add(match[1]);
      if (m.replyUsers) for (const u of m.replyUsers) batchUserIds.add(u);
    }
    await resolveUsers(client, [...batchUserIds]);

    // Build messages for this batch
    const batchMessages: SlackMessage[] = batchRaw.map((m) => ({
      id: `${m.channelId}-${m.ts}`,
      channel: m.channelId,
      channelName: m.channelName,
      text: cleanSlackTextSync(m.text),
      sender: m.user ?? "",
      senderName: m.user ? getUserName(m.user) : "unknown",
      threadTs: m.threadTs ?? null,
      replyCount: m.replyCount,
      replyUserNames: m.replyUsers?.map((u) => getUserName(u)).filter(Boolean),
      replies: [],
      permalink: makePermalink(m.channelId, m.ts),
      isUnread: parseFloat(m.ts) > parseFloat(m.lastRead),
      timestamp: m.ts,
      files: m.files,
    }));

    allMessages.push(...batchMessages);
    fetchedCount += batch.length;
    onProgress?.(`fetched ${fetchedCount}/${channelsToFetch.length} channels (${allMessages.length} messages)`);

    // Emit incremental results
    if (batchMessages.length > 0 && onMessages) {
      onMessages(allMessages);
    }
  }

  // Save user's own messages for style learning (persists across syncs)
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

  // Find channels that need attention:
  // 1. Has unread messages from someone else, OR
  // 2. Last message in the channel is from someone else (they're waiting on you)
  const channelsToKeep = new Set<string>();

  // Group messages by channel to find the latest per channel
  const msgsByChannel = new Map<string, SlackMessage[]>();
  for (const m of allMessages) {
    if (!msgsByChannel.has(m.channel)) msgsByChannel.set(m.channel, []);
    msgsByChannel.get(m.channel)!.push(m);
  }

  for (const [channelId, msgs] of msgsByChannel) {
    // Sort by timestamp desc to find the latest
    msgs.sort((a, b) => parseFloat(b.timestamp) - parseFloat(a.timestamp));
    const latest = msgs[0];

    // Only keep if the LAST message in the conversation is from someone else
    // (meaning they're waiting on you). If you replied last, you've attended to it.
    if (latest && latest.sender !== userId) {
      channelsToKeep.add(channelId);
    }
  }

  // For watched channels, always keep them
  const watchedSet = new Set(watchedChannelIds ?? []);

  const filteredMessages = allMessages.filter((m) => {
    if (watchedSet.has(m.channel)) return true;
    return channelsToKeep.has(m.channel);
  });

  // Search for recent @mentions across ALL channels
  onProgress?.("searching for mentions");
  try {
    // On quick sync, only search for @mentions (skip "to:me" which mostly returns DMs)
    const mentionRes = await client.search.messages({
      query: `<@${userId}>`,
      sort: "timestamp",
      sort_dir: "desc",
      count: isQuickSync ? 20 : 30,
    });
    const rawMatches = ((mentionRes.messages as Record<string, unknown>)?.matches ?? []) as Array<Record<string, unknown>>;

    let toMeMatches: Array<Record<string, unknown>> = [];
    if (!isQuickSync) {
      const toMeRes = await client.search.messages({ query: "to:me", sort: "timestamp", sort_dir: "desc", count: 30 });
      toMeMatches = ((toMeRes.messages as Record<string, unknown>)?.matches ?? []) as Array<Record<string, unknown>>;
    }
    const seenTs = new Set<string>();
    const allSearchMatches: Array<Record<string, unknown>> = [];
    for (const m of [...rawMatches, ...toMeMatches]) {
      const key = `${(m.channel as Record<string, unknown>)?.id}-${m.ts}`;
      if (!seenTs.has(key)) { seenTs.add(key); allSearchMatches.push(m); }
    }
    // Fake a combined searchRes shape for the rest of the code
    const searchRes = { messages: { matches: allSearchMatches, total: allSearchMatches.length } };
    const matches = searchRes.messages.matches;
    console.log(`[slack] Mention search returned ${matches.length} combined matches (toMe: ${toMeMatches.length}, raw: ${rawMatches.length})`);
    if (matches.length > 0) {
      const sample = matches[0];
      const chInfo = sample.channel as Record<string, unknown> | undefined;
      console.log(`[slack] First match channel: ${chInfo?.name ?? chInfo?.id}, ts: ${sample.ts}, user: ${sample.user ?? sample.username}`);
    }
    const mentionUserIds = new Set<string>();
    const mentionMsgs: Array<{channelId: string; channelName: string; user?: string; text: string; ts: string; threadTs?: string; permalink: string}> = [];

    for (const match of matches) {
      const ts = match.ts as string;
      if (!ts || parseFloat(ts) < parseFloat(oldest)) continue;
      const chObj = match.channel as Record<string, unknown> | undefined;
      const channelId = chObj?.id as string ?? "";
      const channelName = chObj?.name as string ?? "";
      // Skip DM mentions — DMs are fetched through the DM channel path with full conversation context
      // The search API only returns the mention itself, missing later replies from the user
      if (channelId.startsWith("D")) continue;
      const user = match.user as string ?? match.username as string;
      if (user === userId) continue; // skip own messages
      if (user) mentionUserIds.add(user);
      mentionMsgs.push({
        channelId,
        channelName,
        user,
        text: match.text as string ?? "",
        ts,
        threadTs: match.thread_ts as string | undefined,
        permalink: match.permalink as string ?? makePermalink(channelId, ts),
      });
    }

    // Also resolve any user IDs that appear as channel names (DM channels)
    const userIdChannelNames = new Set<string>();
    for (const m of mentionMsgs) {
      if (m.channelName && /^[A-Z][A-Z0-9]{8,}$/.test(m.channelName)) {
        userIdChannelNames.add(m.channelName);
      }
    }
    await resolveUsers(client, [...mentionUserIds, ...userIdChannelNames]);

    // Add mention messages that aren't already in our list
    const existingIds = new Set(filteredMessages.map(m => m.id));
    for (const m of mentionMsgs) {
      const id = `${m.channelId}-${m.ts}`;
      if (existingIds.has(id)) continue;
      existingIds.add(id);
      // Resolve user-ID-like channel names to real names
      let resolvedChannelName = m.channelName;
      if (resolvedChannelName && /^[A-Z][A-Z0-9]{8,}$/.test(resolvedChannelName)) {
        const resolved = getUserName(resolvedChannelName);
        if (resolved !== resolvedChannelName) resolvedChannelName = resolved;
      }
      // DM channels (ID starts with D) need "DM: " prefix for UI identification
      const isDmChannel = m.channelId.startsWith("D");
      if (isDmChannel && resolvedChannelName && !resolvedChannelName.startsWith("DM:")) {
        resolvedChannelName = `DM: ${resolvedChannelName}`;
      }
      if (channelNameCache.has(m.channelId)) {
        // use cached name
      } else if (resolvedChannelName) {
        channelNameCache.set(m.channelId, resolvedChannelName);
      }
      const isThreadReply = !!(m.threadTs && m.threadTs !== m.ts);
      filteredMessages.push({
        id,
        channel: m.channelId,
        channelName: resolvedChannelName || channelNameCache.get(m.channelId) || m.channelId,
        text: cleanSlackTextSync(m.text),
        sender: m.user ?? "",
        senderName: m.user ? getUserName(m.user) : "unknown",
        threadTs: m.threadTs ?? null,
        replyCount: 0,
        replies: [],
        permalink: m.permalink,
        isUnread: true, // mentions are always treated as unread/actionable
        timestamp: m.ts,
        isThreadReply,
      });
    }
    const addedCount = filteredMessages.length - existingIds.size + mentionMsgs.length;
    console.log(`[slack] Found ${mentionMsgs.length} mention messages within lookback, added new ones to results`);
  } catch (e) {
    console.log(`[slack] Mention search failed (may need search:read scope): ${e instanceof Error ? e.message : e}`);
  }

  console.log(`[slack] ${allMessages.length} total messages, ${channelsToKeep.size} channels to keep, ${filteredMessages.length} after filter`);

  filteredMessages.sort((a, b) => parseFloat(b.timestamp) - parseFloat(a.timestamp));
  return filteredMessages;
}

export async function sendReply(
  userToken: string,
  channel: string,
  text: string,
  threadTs?: string,
): Promise<string | undefined> {
  const client = new WebClient(userToken);
  const res = await client.chat.postMessage({ channel, text, thread_ts: threadTs });
  return res.ts;
}

export async function addReaction(
  userToken: string,
  channel: string,
  timestamp: string,
  reaction: string,
): Promise<void> {
  const client = new WebClient(userToken);
  await client.reactions.add({ channel, timestamp, name: reaction });
}

export async function markAsRead(
  userToken: string,
  channel: string,
  timestamp: string,
): Promise<void> {
  const client = new WebClient(userToken);
  try {
    await client.conversations.mark({ channel, ts: timestamp });
  } catch (e) {
    console.log(`[slack] Failed to mark ${channel} as read: ${e instanceof Error ? e.message : e}`);
  }
}
