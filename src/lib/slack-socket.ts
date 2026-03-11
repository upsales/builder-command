import { SocketModeClient } from "@slack/socket-mode";
import { WebClient } from "@slack/web-api";
import { upsertItem } from "./items";
import { getDb } from "./db";

let socketClient: SocketModeClient | null = null;
let started = false;

const userCache = new Map<string, string>();

async function resolveUser(client: WebClient, uid: string): Promise<string> {
  if (userCache.has(uid)) return userCache.get(uid)!;
  try {
    const info = await client.users.info({ user: uid });
    const name = info.user?.real_name ?? info.user?.name ?? uid;
    userCache.set(uid, name);
    return name;
  } catch {
    userCache.set(uid, uid);
    return uid;
  }
}

export function startSlackSocket() {
  if (started) return;

  const appToken = process.env.SLACK_APP_TOKEN;
  const botToken = process.env.SLACK_BOT_TOKEN;

  if (!appToken || !botToken) {
    console.log("[slack-socket] Missing SLACK_APP_TOKEN or SLACK_BOT_TOKEN, skipping socket mode");
    return;
  }

  if (!appToken.startsWith("xapp-")) {
    console.log("[slack-socket] SLACK_APP_TOKEN doesn't start with xapp-, skipping");
    return;
  }

  started = true;
  const web = new WebClient(botToken);

  socketClient = new SocketModeClient({ appToken });

  // Get the bot's own user ID to filter self-messages
  let botUserId: string | null = null;
  web.auth.test().then((res) => {
    botUserId = res.user_id as string;
    console.log(`[slack-socket] Bot user ID: ${botUserId}`);
  }).catch(() => {});

  // Get the human user's Slack ID from profile
  const db = getDb();
  const profile = db.prepare("SELECT slack_user_id FROM profile WHERE id = 1").get() as { slack_user_id: string | null } | undefined;
  const humanUserId = profile?.slack_user_id;

  socketClient.on("message", async ({ event, ack }) => {
    await ack();

    if (!event || !humanUserId) return;
    const sender = event.user as string | undefined;
    if (!sender) return;
    // Ignore bot's own messages and the human user's own messages
    if (sender === botUserId || sender === humanUserId) return;

    const text = (event.text as string) ?? "";
    const channelId = event.channel as string;
    const ts = event.ts as string;
    const threadTs = event.thread_ts as string | undefined;
    const channelType = event.channel_type as string; // "im", "channel", "group", "mpim"

    // Check if this mentions the user or is a DM
    const mentionsUser = text.includes(`<@${humanUserId}>`);
    const isDm = channelType === "im";

    if (!mentionsUser && !isDm) return;

    const senderName = await resolveUser(web, sender);

    // Try to get channel name
    let channelName = channelId;
    if (isDm) {
      channelName = `DM: ${senderName}`;
    } else {
      try {
        const info = await web.conversations.info({ channel: channelId });
        channelName = (info.channel as Record<string, unknown>)?.name as string ?? channelId;
      } catch { /* use ID */ }
    }

    const permalink = `https://slack.com/archives/${channelId}/p${ts.replace(".", "")}`;

    console.log(`[slack-socket] ${isDm ? "DM" : "mention"} from ${senderName} in ${channelName}: ${text.substring(0, 80)}`);

    upsertItem({
      source: "slack",
      source_id: `${channelId}-${ts}`,
      title: `#${channelName} — ${senderName}: ${text.substring(0, 100)}`,
      url: permalink,
      raw_data: JSON.stringify({
        channel: channelId,
        channelName,
        text,
        sender,
        senderName,
        threadTs: threadTs ?? null,
        replyCount: 0,
        timestamp: ts,
        isUnread: true,
        isThreadReply: !!(threadTs && threadTs !== ts),
      }),
    });
  });

  socketClient.on("connected", () => {
    console.log("[slack-socket] Connected to Slack via Socket Mode");
  });

  socketClient.on("disconnected", () => {
    console.log("[slack-socket] Disconnected from Slack Socket Mode");
  });

  socketClient.start().catch((err) => {
    console.error("[slack-socket] Failed to start:", err);
    started = false;
  });
}

export function stopSlackSocket() {
  if (socketClient) {
    socketClient.disconnect();
    socketClient = null;
    started = false;
  }
}
