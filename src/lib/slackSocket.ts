import { SocketModeClient } from "@slack/socket-mode";
import { WebClient } from "@slack/web-api";
import { getProfile, upsertItem } from "./items";
import { getDb, getSetting, setSetting } from "./db";
import { notifyChange } from "./changeNotifier";
import { updateLastReadCache } from "./integrations/slack";

// Use globalThis to share state across Next.js dev mode module instances
const g = globalThis as unknown as {
  __slackSocketClient?: SocketModeClient | null;
  __slackSocketStarted?: boolean;
  __slackSocketLog?: SlackSocketEvent[];
  __slackReadStateInterval?: ReturnType<typeof setInterval> | null;
  __slackLastMessageTime?: number; // epoch ms of last received message
};

function getSocketClient() { return g.__slackSocketClient ?? null; }
function setSocketClient(c: SocketModeClient | null) { g.__slackSocketClient = c; }
function isStarted() { return g.__slackSocketStarted ?? false; }
function setStarted(v: boolean) { g.__slackSocketStarted = v; }

// Event log for debugging
export interface SlackSocketEvent {
  time: string;
  type: string;
  detail: string;
}
function getEventLog(): SlackSocketEvent[] {
  if (!g.__slackSocketLog) g.__slackSocketLog = [];
  return g.__slackSocketLog;
}
const MAX_LOG = 200;

function logEvent(type: string, detail: string) {
  const time = new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const log = getEventLog();
  log.unshift({ time, type, detail });
  if (log.length > MAX_LOG) log.length = MAX_LOG;
}

export function getSlackSocketLog(): SlackSocketEvent[] {
  return getEventLog();
}

// User name cache
const userNameCache = new Map<string, string>();

async function resolveUserName(webClient: WebClient, userId: string): Promise<string> {
  if (userNameCache.has(userId)) return userNameCache.get(userId)!;
  try {
    const res = await webClient.users.info({ user: userId });
    const name = res.user?.profile?.display_name || res.user?.real_name || res.user?.name || userId;
    userNameCache.set(userId, name);
    return name;
  } catch {
    return userId;
  }
}

// Channel name cache
const channelNameCache = new Map<string, string>();

async function resolveChannelName(webClient: WebClient, channelId: string, isDm: boolean): Promise<string> {
  if (channelNameCache.has(channelId)) return channelNameCache.get(channelId)!;
  try {
    const res = await webClient.conversations.info({ channel: channelId });
    const ch = res.channel as Record<string, unknown>;
    if (isDm) {
      // Single DM — resolve user name
      const userId = ch?.user as string;
      if (userId) {
        const name = await resolveUserName(webClient, userId);
        const dmName = `DM: ${name}`;
        channelNameCache.set(channelId, dmName);
        return dmName;
      }
      // MPIM (group DM) — use purpose or name_normalized
      const purpose = (ch?.purpose as Record<string, unknown>)?.value as string;
      if (purpose) {
        const dmName = `DM: ${purpose.substring(0, 50)}`;
        channelNameCache.set(channelId, dmName);
        return dmName;
      }
      const nameNorm = ch?.name_normalized as string ?? ch?.name as string;
      if (nameNorm) {
        const dmName = `DM: ${nameNorm}`;
        channelNameCache.set(channelId, dmName);
        return dmName;
      }
    }
    const name = ch?.name as string;
    if (name) {
      channelNameCache.set(channelId, name);
      return name;
    }
    // Channel name not available — don't cache the ID so we retry next time
    console.log(`[slack-socket] Could not resolve channel name for ${channelId}`);
    return channelId;
  } catch (err) {
    // Don't cache failures — retry on next message
    console.log(`[slack-socket] Failed to resolve channel ${channelId}:`, err instanceof Error ? err.message : err);
    return channelId;
  }
}

async function resolveUserMentions(webClient: WebClient, text: string): Promise<string> {
  const mentionRegex = /<@([A-Z0-9]+)>/g;
  const matches = [...text.matchAll(mentionRegex)];
  if (matches.length === 0) return text;
  let result = text;
  for (const match of matches) {
    const userId = match[1];
    const name = await resolveUserName(webClient, userId);
    if (name !== userId) {
      result = result.replace(`<@${userId}>`, `<@${userId}|${name}>`);
    }
  }
  return result;
}

const READ_STATE_POLL_INTERVAL = 60_000; // 60 seconds (avoid Slack rate limits)

/**
 * Poll Slack for read-state changes on channels we have items for.
 * Handles both directions: reading in Slack → remove from Builder,
 * and marking unread in Slack → show in Builder.
 */
async function pollReadState(webClient: WebClient): Promise<void> {
  const db = getDb();
  // Get all non-dismissed slack items with their raw_data
  const items = db.prepare(
    `SELECT i.id, i.source_id, i.raw_data FROM items i
     LEFT JOIN dismissed d ON d.source = i.source AND d.source_id = i.source_id
     WHERE i.source = 'slack' AND d.source IS NULL AND i.raw_data IS NOT NULL`
  ).all() as { id: string; source_id: string; raw_data: string }[];

  if (items.length === 0) return;

  // Group items by channel
  const byChannel = new Map<string, { id: string; source_id: string; raw: Record<string, unknown>; ts: string }[]>();
  for (const item of items) {
    try {
      const raw = JSON.parse(item.raw_data);
      const channelId = raw.channel as string;
      const ts = raw.timestamp as string;
      if (!channelId || !ts) continue;
      if (!byChannel.has(channelId)) byChannel.set(channelId, []);
      byChannel.get(channelId)!.push({ id: item.id, source_id: item.source_id, raw, ts });
    } catch { /* skip malformed */ }
  }

  let changed = false;
  const channelIds = [...byChannel.keys()];

  // Batch conversations.info calls (3 at a time to avoid rate limits)
  for (let i = 0; i < channelIds.length; i += 3) {
    const batch = channelIds.slice(i, i + 3);
    const results = await Promise.all(
      batch.map(async (chId) => {
        try {
          const info = await webClient.conversations.info({ channel: chId });
          const c = info.channel as Record<string, unknown>;
          const lastRead = c?.last_read as string;
          if (lastRead) updateLastReadCache(chId, lastRead);
          return lastRead ? { chId, lastRead } : null;
        } catch {
          return null;
        }
      })
    );

    for (const result of results) {
      if (!result) continue;
      const channelItems = byChannel.get(result.chId);
      if (!channelItems) continue;

      for (const item of channelItems) {
        const shouldBeUnread = parseFloat(item.ts) > parseFloat(result.lastRead);
        const currentlyUnread = !!item.raw.isUnread;

        if (shouldBeUnread !== currentlyUnread) {
          item.raw.isUnread = shouldBeUnread;
          db.prepare("UPDATE items SET raw_data = ? WHERE id = ?")
            .run(JSON.stringify(item.raw), item.id);
          changed = true;
          logEvent("read_sync", `${item.source_id} ${currentlyUnread ? "read" : "unread"} (last_read=${result.lastRead})`);
        }
      }
    }
  }

  if (changed) {
    logEvent("read_sync", "Read state changed, notifying UI");
    notifyChange();
  }
}

function startReadStatePolling(webClient: WebClient): void {
  stopReadStatePolling();
  logEvent("read_sync", "Starting read-state polling (15s interval)");
  g.__slackReadStateInterval = setInterval(() => {
    pollReadState(webClient).catch((err) => {
      logEvent("error", `Read-state poll failed: ${err instanceof Error ? err.message : err}`);
    });
  }, READ_STATE_POLL_INTERVAL);
}

function stopReadStatePolling(): void {
  if (g.__slackReadStateInterval) {
    clearInterval(g.__slackReadStateInterval);
    g.__slackReadStateInterval = null;
  }
}

/**
 * Catch up on missed messages since the socket was last active.
 * Fetches recent history from watched channels + DMs where we have items.
 */
/**
 * Catch up on missed messages since the socket was last active.
 * Uses the USER token (not bot token) so it can read DMs and private channels.
 */
async function catchUpMissedMessages(): Promise<void> {
  const profile = getProfile();
  if (!profile?.slack_user_id || !profile?.slack_token) {
    logEvent("catchup", "No user token available, skipping catch-up");
    return;
  }

  // Try in-memory first, then DB-persisted value, then default to 10 min ago
  let lastTime = g.__slackLastMessageTime;
  if (!lastTime) {
    const persisted = getSetting("slack:lastMessageTime");
    if (persisted) lastTime = parseInt(persisted, 10);
  }
  const oldest = lastTime
    ? String(Math.floor(lastTime / 1000))
    : String(Math.floor(Date.now() / 1000) - 10 * 60);

  const gapSeconds = Math.floor((Date.now() - (lastTime ?? Date.now())) / 1000);
  if (gapSeconds < 30) {
    logEvent("catchup", `Gap only ${gapSeconds}s, skipping catch-up`);
    return;
  }

  logEvent("catchup", `Catching up on messages since ${new Date(lastTime ?? Date.now() - 10 * 60_000).toLocaleTimeString()} (${gapSeconds}s gap)`);

  // Use the user token for full access to DMs and private channels
  const userClient = new WebClient(profile.slack_token);

  // Get all channels with unread messages
  const db = getDb();
  const channelsToCheck: { id: string; isDm: boolean }[] = [];

  try {
    let cursor: string | undefined;
    do {
      const res = await userClient.conversations.list({
        types: "public_channel,private_channel,mpim,im",
        exclude_archived: true,
        limit: 200,
        cursor,
      });
      for (const ch of res.channels ?? []) {
        if (!ch.id) continue;
        const c = ch as Record<string, unknown>;
        const unread = (c.unread_count as number) ?? 0;
        if (unread > 0) {
          channelsToCheck.push({ id: ch.id, isDm: ch.is_im === true || ch.is_mpim === true });
        }
      }
      cursor = res.response_metadata?.next_cursor || undefined;
    } while (cursor);
  } catch (e) {
    logEvent("catchup_err", `Failed to list channels: ${e instanceof Error ? e.message : e}`);
    // Fall back to channels from existing items
    const existingChannels = db.prepare(
      `SELECT DISTINCT json_extract(raw_data, '$.channel') as channel_id,
              json_extract(raw_data, '$.channelName') as channel_name
       FROM items WHERE source = 'slack' AND raw_data IS NOT NULL`
    ).all() as { channel_id: string; channel_name: string }[];
    for (const c of existingChannels) {
      if (c.channel_id) channelsToCheck.push({ id: c.channel_id, isDm: c.channel_name?.startsWith("DM:") ?? false });
    }
  }

  if (channelsToCheck.length === 0) {
    logEvent("catchup", "No channels with unread messages");
    return;
  }

  logEvent("catchup", `Checking ${channelsToCheck.length} channels with unread messages`);
  let added = 0;

  for (const channel of channelsToCheck.slice(0, 25)) {
    try {
      const result = await userClient.conversations.history({
        channel: channel.id,
        oldest,
        limit: 20,
      });

      const messages = result.messages ?? [];
      for (const msg of messages) {
        if (!msg.ts || !msg.user) continue;
        if (msg.user === profile.slack_user_id) continue;
        if (msg.subtype && !["thread_broadcast", "file_share", "me_message"].includes(msg.subtype)) continue;

        const sourceId = `${channel.id}-${msg.ts}`;
        const existing = db.prepare("SELECT 1 FROM items WHERE source = 'slack' AND source_id = ?").get(sourceId);
        if (existing) continue;

        const dismissed = db.prepare("SELECT 1 FROM dismissed WHERE source = 'slack' AND source_id = ?").get(sourceId);
        if (dismissed) continue;

        const text = (msg.text ?? "").substring(0, 500);
        const mentionsUser = text.includes(`<@${profile.slack_user_id}>`);

        // For non-DM channels, only grab mentions (otherwise we'd pull every message from every channel)
        if (!channel.isDm && !mentionsUser) continue;

        const senderName = await resolveUserName(userClient, msg.user);
        const channelName = await resolveChannelName(userClient, channel.id, channel.isDm);
        const resolvedText = await resolveUserMentions(userClient, text);

        let permalink = `https://slack.com/archives/${channel.id}/p${msg.ts.replace(".", "")}`;
        try {
          const pRes = await userClient.chat.getPermalink({ channel: channel.id, message_ts: msg.ts });
          if (pRes.permalink) permalink = pRes.permalink;
        } catch { /* use fallback */ }

        upsertItem({
          source: "slack",
          source_id: sourceId,
          title: `#${channelName} — ${senderName}: ${resolvedText.substring(0, 100)}`,
          url: permalink,
          raw_data: JSON.stringify({
            channel: channel.id,
            channelName,
            text: resolvedText,
            sender: msg.user,
            senderName,
            threadTs: msg.thread_ts ?? null,
            timestamp: msg.ts,
            isUnread: true,
            replyCount: 0,
            isThreadReply: false,
          }),
        });
        added++;
      }

      // Small delay between channels to avoid rate limits
      await new Promise(r => setTimeout(r, 300));
    } catch (e) {
      logEvent("catchup_err", `Failed to fetch ${channel.id}: ${e instanceof Error ? e.message : e}`);
    }
  }

  // Update the last message time to now so we don't re-catch-up
  g.__slackLastMessageTime = Date.now();
  setSetting("slack:lastMessageTime", String(g.__slackLastMessageTime));

  if (added > 0) {
    logEvent("catchup", `Added ${added} missed messages`);
    notifyChange();
  } else {
    logEvent("catchup", "No missed messages found");
  }
}

export function startSlackSocket(): void {
  if (isStarted()) return;
  setStarted(true);

  const appToken = process.env.SLACK_APP_TOKEN;
  const botToken = process.env.SLACK_BOT_TOKEN;

  if (!appToken || !botToken) {
    console.log("[slack-socket] Missing SLACK_APP_TOKEN or SLACK_BOT_TOKEN, skipping Socket Mode");
    return;
  }

  const socketClient = new SocketModeClient({ appToken, clientOptions: { retries: 2 } });
  setSocketClient(socketClient);
  const webClient = new WebClient(botToken);

  // Debug: catch-all for any Slack event
  socketClient.on("slack_event" as string, ({ type, body }: { type: string; body?: unknown }) => {
    const bodyStr = body ? JSON.stringify(body).slice(0, 150) : "";
    logEvent("ws_event", `type=${type} ${bodyStr}`);
  });

  logEvent("init", "Starting Socket Mode connection...");
  console.log("[slack-socket] Starting Socket Mode connection...");

  // Listen for all message events
  socketClient.on("message", async ({ event, ack }) => {
    logEvent("msg_recv", `ch=${event.channel} user=${event.user} subtype=${event.subtype ?? "none"} ch_type=${event.channel_type ?? "?"} thread_ts=${event.thread_ts ?? "none"} ts=${event.ts} text="${(event.text ?? "").substring(0, 80)}"${event.files ? ` files=${event.files.length}` : ""}`);
    await ack();
    logEvent("msg_ack", `Acked message ${event.ts}`);

    const profile = getProfile();
    if (!profile?.slack_user_id) {
      logEvent("msg_skip", "No profile or slack_user_id configured");
      return;
    }
    logEvent("msg_check", `My user_id=${profile.slack_user_id}, sender=${event.user}`);

    // Skip messages from ourselves
    if (event.user === profile.slack_user_id) {
      logEvent("msg_skip", `Own message in ch=${event.channel}, ignoring`);
      return;
    }
    // Skip non-content subtypes (channel_join, channel_leave, etc.) but allow actual message content
    const allowedSubtypes = new Set(["thread_broadcast", "file_share", "me_message"]);
    if (event.subtype && !allowedSubtypes.has(event.subtype)) {
      logEvent("msg_skip", `Subtype=${event.subtype}, ignoring`);
      return;
    }

    const channelId = event.channel;
    const ts = event.ts;
    const threadTs = event.thread_ts;
    const text = (event.text ?? "").substring(0, 500);
    const sender = event.user ?? "unknown";
    const isDm = event.channel_type === "im" || event.channel_type === "mpim";

    const mentionsUser = text.includes(`<@${profile.slack_user_id}>`);
    logEvent("msg_parse", `isDm=${isDm} mentionsUser=${mentionsUser} isThread=${!!(threadTs && threadTs !== ts)} text="${text.substring(0, 60)}"`);

    // Resolve names
    logEvent("msg_resolve", `Resolving sender ${sender}...`);
    const senderName = await resolveUserName(webClient, sender);
    logEvent("msg_resolve", `Sender resolved: ${sender} → ${senderName}`);

    logEvent("msg_resolve", `Resolving channel ${channelId} (isDm=${isDm})...`);
    const channelName = await resolveChannelName(webClient, channelId, isDm);
    logEvent("msg_resolve", `Channel resolved: ${channelId} → ${channelName}`);

    // Resolve all <@U...> mentions in the text to real names
    const resolvedText = await resolveUserMentions(webClient, text);
    if (resolvedText !== text) {
      logEvent("msg_resolve", `Resolved mentions in text`);
    }

    // If this is a thread reply, update the parent item instead of creating a separate item
    const isThreadReply = !!(threadTs && threadTs !== ts);
    if (isThreadReply) {
      const db = getDb();
      const parentSourceId = `${channelId}-${threadTs}`;
      logEvent("thread", `Thread reply detected, checking parent ${parentSourceId}`);
      const existing = db.prepare(
        "SELECT raw_data FROM items WHERE source = 'slack' AND source_id = ?"
      ).get(parentSourceId) as { raw_data: string | null } | undefined;

      if (existing?.raw_data) {
        logEvent("thread", `Parent found, updating with new reply from ${senderName}`);
        try {
          const raw = JSON.parse(existing.raw_data);
          raw.replyCount = (raw.replyCount ?? 0) + 1;
          if (!raw.replyUserNames) raw.replyUserNames = [];
          if (!raw.replyUserNames.includes(senderName)) {
            raw.replyUserNames.push(senderName);
          }
          // Store new reply inline so the UI can show it in the thread
          if (!raw.newReplies) raw.newReplies = [];
          raw.newReplies.push({
            senderName,
            text: resolvedText,
            timestamp: ts,
            sender,
          });
          // Mark parent as having new thread activity
          raw.hasNewReplies = true;
          db.prepare(
            "UPDATE items SET raw_data = ? WHERE source = 'slack' AND source_id = ?"
          ).run(JSON.stringify(raw), parentSourceId);
          logEvent("thread", `Parent updated: replyCount=${raw.replyCount} newReplies=${raw.newReplies.length}`);
          notifyChange();
        } catch (e) {
          logEvent("error", `Failed to update parent: ${e instanceof Error ? e.message : e}`);
        }
        // Don't create a separate item — the reply lives inside the parent thread
        if (!mentionsUser && !isDm) {
          return;
        }
        // If it also mentions us or is a DM, fall through to create a standalone item too
      } else {
        logEvent("thread", `Parent NOT found in DB — not tracked`);
      }
    }

    // Accept all DMs and all @mentions (no channel filter needed)
    if (mentionsUser || isDm) {
      logEvent("msg_add", `Adding ${isDm ? "DM" : "mention"} from ${senderName} in #${channelName}`);

      let permalink = `https://slack.com/archives/${channelId}/p${ts.replace(".", "")}`;
      try {
        const pRes = await webClient.chat.getPermalink({ channel: channelId, message_ts: ts });
        if (pRes.permalink) permalink = pRes.permalink;
        logEvent("msg_add", `Got permalink: ${permalink.slice(0, 80)}`);
      } catch (e) {
        logEvent("warn", `Permalink fetch failed: ${e instanceof Error ? e.message : e}`);
      }

      const files = event.files?.map((f: Record<string, string>) => ({
        name: f.name,
        mimetype: f.mimetype,
        url: f.url_private,
        thumb: f.thumb_360 || f.thumb_80,
      })) ?? [];
      if (files.length > 0) {
        logEvent("msg_add", `Message has ${files.length} file(s): ${files.map(f => f.name).join(", ")}`);
      }

      upsertItem({
        source: "slack",
        source_id: `${channelId}-${ts}`,
        title: `#${channelName} — ${senderName}: ${resolvedText.substring(0, 100)}`,
        url: permalink,
        raw_data: JSON.stringify({
          channel: channelId,
          channelName,
          text: resolvedText,
          sender,
          senderName,
          threadTs: threadTs ?? null,
          timestamp: ts,
          isUnread: true,
          files: files.length > 0 ? files : undefined,
          replyCount: 0,
          isThreadReply: !!(threadTs && threadTs !== ts),
        }),
      });
      logEvent("added", `${isDm ? "DM" : "Mention"} from ${senderName} in #${channelName}: "${resolvedText.substring(0, 60)}"`);
      g.__slackLastMessageTime = Date.now();
      setSetting("slack:lastMessageTime", String(g.__slackLastMessageTime));
      notifyChange();
    } else {
      logEvent("msg_drop", `Not a mention, DM, or watched — from ${senderName} in #${channelName}: "${resolvedText.substring(0, 60)}"`);
      g.__slackLastMessageTime = Date.now();
    }
  });

  // Listen for reaction events
  socketClient.on("reaction_added", async ({ event, ack }) => {
    await ack();
    logEvent("reaction", `reaction_added: ${event.reaction} by ${event.user} on item_user=${event.item_user} in ch=${event.item?.channel}`);
    const profile = getProfile();
    if (event.user === profile?.slack_user_id) {
      logEvent("reaction", `Own reaction — triggering UI refresh`);
      notifyChange();
    }
  });

  socketClient.on("reaction_removed", async ({ event, ack }: { event: Record<string, unknown>; ack: () => Promise<void> }) => {
    await ack();
    logEvent("reaction", `reaction_removed: ${event.reaction} by ${event.user}`);
  });

  // Add event listeners for connection lifecycle
  socketClient.on("connected" as string, () => {
    logEvent("connected", "Socket Mode connected to Slack");
    console.log("[slack-socket] Connected to Slack via Socket Mode");
    // Catch up on any messages missed while disconnected
    catchUpMissedMessages().catch(e => {
      logEvent("catchup_err", `Catch-up failed: ${e instanceof Error ? e.message : e}`);
    });
  });
  socketClient.on("authenticated" as string, (data: unknown) => {
    logEvent("auth", `Authenticated: ${JSON.stringify(data).slice(0, 200)}`);
    console.log("[slack-socket] Authenticated");
  });
  socketClient.on("disconnected" as string, () => {
    logEvent("disconnected", "Socket Mode disconnected");
    console.log("[slack-socket] Disconnected from Slack");
    stopReadStatePolling();
  });
  socketClient.on("reconnecting" as string, () => {
    logEvent("reconnecting", "Socket Mode reconnecting...");
    console.log("[slack-socket] Reconnecting to Slack...");
  });
  socketClient.on("connecting" as string, () => {
    logEvent("connecting", "Socket Mode connecting...");
  });
  socketClient.on("error" as string, (err: Error) => {
    logEvent("error", `Socket error: ${err?.message ?? JSON.stringify(err)}`);
    console.error("[slack-socket] Socket error:", err);
  });
  socketClient.on("close" as string, () => {
    logEvent("close", "WebSocket closed");
  });

  socketClient.start().then(() => {
    logEvent("started", "Socket Mode start() resolved");
    console.log("[slack-socket] start() resolved");
  }).catch((err) => {
    logEvent("error", `Failed to connect: ${err instanceof Error ? err.message : err}`);
    console.error("[slack-socket] Failed to connect:", err);
    setStarted(false);
    setSocketClient(null);
  });
}

export function isSlackSocketRunning(): boolean {
  return isStarted() && getSocketClient() !== null;
}

export function restartSlackSocket(): void {
  stopReadStatePolling();
  const client = getSocketClient();
  if (client) {
    try { client.disconnect(); } catch { /* ignore */ }
  }
  setSocketClient(null);
  setStarted(false);
  getEventLog().length = 0;
  logEvent("restart", "Socket manually restarted");
  startSlackSocket();
}
