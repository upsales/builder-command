import { SocketModeClient } from "@slack/socket-mode";
import { WebClient } from "@slack/web-api";
import { getProfile, upsertItem } from "./items";
import { getDb } from "./db";
import { notifyChange } from "./changeNotifier";

// Use globalThis to share state across Next.js dev mode module instances
const g = globalThis as unknown as {
  __slackSocketClient?: SocketModeClient | null;
  __slackSocketStarted?: boolean;
  __slackSocketLog?: SlackSocketEvent[];
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
    if (isDm) {
      const userId = (res.channel as Record<string, unknown>)?.user as string;
      if (userId) {
        const name = await resolveUserName(webClient, userId);
        const dmName = `DM: ${name}`;
        channelNameCache.set(channelId, dmName);
        return dmName;
      }
    }
    const name = (res.channel as Record<string, string>)?.name;
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
    const isDm = event.channel_type === "im";

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

    // New mention or DM — insert as new item
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
      notifyChange();
    } else {
      logEvent("msg_drop", `Not a mention or DM — from ${senderName} in #${channelName}: "${resolvedText.substring(0, 60)}"`);
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
  });
  socketClient.on("authenticated" as string, (data: unknown) => {
    logEvent("auth", `Authenticated: ${JSON.stringify(data).slice(0, 200)}`);
    console.log("[slack-socket] Authenticated");
  });
  socketClient.on("disconnected" as string, () => {
    logEvent("disconnected", "Socket Mode disconnected");
    console.log("[slack-socket] Disconnected from Slack");
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
