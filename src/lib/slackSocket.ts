import { SocketModeClient } from "@slack/socket-mode";
import { WebClient } from "@slack/web-api";
import { getProfile, upsertItem } from "./items";
import { getDb } from "./db";
import { notifyChange } from "./changeNotifier";

let socketClient: SocketModeClient | null = null;
let started = false;

// Event log for debugging
export interface SlackSocketEvent {
  time: string;
  type: string;
  detail: string;
}
const eventLog: SlackSocketEvent[] = [];
const MAX_LOG = 50;

function logEvent(type: string, detail: string) {
  const time = new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
  eventLog.unshift({ time, type, detail });
  if (eventLog.length > MAX_LOG) eventLog.length = MAX_LOG;
}

export function getSlackSocketLog(): SlackSocketEvent[] {
  return eventLog;
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
  if (started) return;
  started = true;

  const appToken = process.env.SLACK_APP_TOKEN;
  const botToken = process.env.SLACK_BOT_TOKEN;

  if (!appToken || !botToken) {
    console.log("[slack-socket] Missing SLACK_APP_TOKEN or SLACK_BOT_TOKEN, skipping Socket Mode");
    return;
  }

  socketClient = new SocketModeClient({ appToken });
  const webClient = new WebClient(botToken);

  logEvent("init", "Starting Socket Mode connection...");
  console.log("[slack-socket] Starting Socket Mode connection...");

  // Listen for all message events
  socketClient.on("message", async ({ event, ack }) => {
    await ack();
    logEvent("raw", `ch=${event.channel} user=${event.user} subtype=${event.subtype ?? "none"} text="${(event.text ?? "").substring(0, 60)}"`);

    const profile = getProfile();
    if (!profile?.slack_user_id) { logEvent("skip", "No profile/slack_user_id"); return; }

    // Skip messages from ourselves
    if (event.user === profile.slack_user_id) { logEvent("skip", "Own message"); return; }
    // Skip message subtypes we don't care about (channel_join, etc.) but allow thread_broadcast
    if (event.subtype && event.subtype !== "thread_broadcast") { logEvent("skip", `Subtype: ${event.subtype}`); return; }

    const channelId = event.channel;
    const ts = event.ts;
    const threadTs = event.thread_ts;
    const text = (event.text ?? "").substring(0, 500);
    const sender = event.user ?? "unknown";
    const isDm = event.channel_type === "im";

    const mentionsUser = text.includes(`<@${profile.slack_user_id}>`);

    // Resolve names
    const senderName = await resolveUserName(webClient, sender);
    const channelName = await resolveChannelName(webClient, channelId, isDm);

    // Resolve all <@U...> mentions in the text to real names
    const resolvedText = await resolveUserMentions(webClient, text);

    // If this is a thread reply, update the parent item's reply count
    if (threadTs && threadTs !== ts) {
      const db = getDb();
      const parentSourceId = `${channelId}-${threadTs}`;
      const existing = db.prepare(
        "SELECT raw_data FROM items WHERE source = 'slack' AND source_id = ?"
      ).get(parentSourceId) as { raw_data: string | null } | undefined;

      if (existing?.raw_data) {
        try {
          const raw = JSON.parse(existing.raw_data);
          raw.replyCount = (raw.replyCount ?? 0) + 1;
          if (!raw.replyUserNames) raw.replyUserNames = [];
          if (!raw.replyUserNames.includes(senderName)) {
            raw.replyUserNames.push(senderName);
          }
          db.prepare(
            "UPDATE items SET raw_data = ? WHERE source = 'slack' AND source_id = ?"
          ).run(JSON.stringify(raw), parentSourceId);
          notifyChange();
        } catch { /* ignore */ }
      }
    }

    // Thread reply where we have the parent tracked — user has notifications on
    const isThreadReply = !!(threadTs && threadTs !== ts);
    if (isThreadReply && !mentionsUser && !isDm) {
      const db = getDb();
      const parentSourceId = `${channelId}-${threadTs}`;
      const parentExists = db.prepare(
        "SELECT 1 FROM items WHERE source = 'slack' AND source_id = ?"
      ).get(parentSourceId);

      if (parentExists) {
        // Parent is tracked — create an item for this thread reply so user sees it
        let permalink = `https://slack.com/archives/${channelId}/p${ts.replace(".", "")}`;
        try {
          const pRes = await webClient.chat.getPermalink({ channel: channelId, message_ts: ts });
          if (pRes.permalink) permalink = pRes.permalink;
        } catch { /* use fallback */ }

        const files = event.files?.map((f: Record<string, string>) => ({
          name: f.name,
          mimetype: f.mimetype,
          url: f.url_private,
          thumb: f.thumb_360 || f.thumb_80,
        })) ?? [];

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
            threadTs,
            timestamp: ts,
            isUnread: true,
            files: files.length > 0 ? files : undefined,
            replyCount: 0,
            isThreadReply: true,
          }),
        });
        logEvent("added", `Thread reply from ${senderName} in #${channelName} (parent tracked)`);
        notifyChange();
        return; // Already handled as thread reply item + parent was updated above
      }
    }

    // New mention or DM — insert as new item
    if (mentionsUser || isDm) {
      // Get permalink
      let permalink = `https://slack.com/archives/${channelId}/p${ts.replace(".", "")}`;
      try {
        const pRes = await webClient.chat.getPermalink({ channel: channelId, message_ts: ts });
        if (pRes.permalink) permalink = pRes.permalink;
      } catch { /* use fallback */ }

      // Get files if any
      const files = event.files?.map((f: Record<string, string>) => ({
        name: f.name,
        mimetype: f.mimetype,
        url: f.url_private,
        thumb: f.thumb_360 || f.thumb_80,
      })) ?? [];

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
      logEvent("added", `${isDm ? "DM" : "Mention"} from ${senderName} in #${channelName}`);
      notifyChange();
    } else {
      logEvent("ignored", `No mention/DM — from ${senderName} in #${channelName}`);
    }
  });

  // Listen for reaction events
  socketClient.on("reaction_added", async ({ event, ack }) => {
    await ack();
    const profile = getProfile();
    if (event.user === profile?.slack_user_id) {
      notifyChange();
    }
  });

  socketClient.start().then(() => {
    logEvent("connected", "Socket Mode connected to Slack");
    console.log("[slack-socket] Connected to Slack via Socket Mode");
  }).catch((err) => {
    logEvent("error", `Failed to connect: ${err instanceof Error ? err.message : err}`);
    console.error("[slack-socket] Failed to connect:", err);
    started = false;
  });
}

export function isSlackSocketRunning(): boolean {
  return started && socketClient !== null;
}
