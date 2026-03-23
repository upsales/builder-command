import { NextResponse } from "next/server";
import { getProfile, upsertItem, removeStaleItems, getItems, recordSyncTime, getSyncTimes } from "@/lib/items";
import { fetchAssignedIssues } from "@/lib/integrations/linear";
import { fetchPRsNeedingReview, fetchMyPRs, fetchAssignedPRs } from "@/lib/integrations/github";
import { fetchChannelMessages, type SyncPhase } from "@/lib/integrations/slack";
import { fetchEvents } from "@/lib/integrations/google-calendar";
import { fetchSessions as fetchClankerSessions } from "@/lib/integrations/clanker";
import { notifyChange } from "@/lib/changeNotifier";
export async function POST(request: Request) {
  const profile = getProfile();
  if (!profile) {
    return NextResponse.json({ error: "Profile not set up" }, { status: 400 });
  }

  let slackLookbackMinutes: number | undefined;
  let activeDmChannelIds: string[] | undefined;
  let githubMode: "author" | "assignee" | undefined;
  let slackPhases: SyncPhase[] | undefined;
  try {
    const body = await request.json();
    slackLookbackMinutes = body.slackLookbackMinutes;
    activeDmChannelIds = body.activeDmChannelIds;
    githubMode = body.githubMode;
    slackPhases = body.slackPhases;
  } catch { /* no body is fine */ }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      const sendItems = () => send("items", getItems());

      // Quick sync = any subset of phases (skips Linear, GitHub, Calendar)
      const isQuickSync = slackPhases && slackPhases.length < 4;
      const tasks: Promise<void>[] = [];

      // Linear (skip on quick sync)
      if (!isQuickSync && process.env.LINEAR_API_KEY && profile.linear_email) {
        tasks.push((async () => {
          try {
            send("status", { source: "linear", state: "fetching issues..." });
            const issues = await fetchAssignedIssues(profile.linear_email!);
            send("status", { source: "linear", state: `found ${issues.length} issues` });
            const sourceIds: string[] = [];
            for (const issue of issues) {
              sourceIds.push(issue.identifier);
              upsertItem({
                source: "linear",
                source_id: issue.identifier,
                title: `[${issue.identifier}] ${issue.title}`,
                url: issue.url,
                raw_data: JSON.stringify(issue),
              });
            }
            removeStaleItems("linear", sourceIds);
            recordSyncTime("linear", sourceIds.length);
            sendItems();
          } catch (e) {
            recordSyncTime("linear", 0, e instanceof Error ? e.message : String(e));
            send("error", { source: "linear", message: e instanceof Error ? e.message : String(e) });
          }
        })());
      }

      // GitHub (skip on quick sync)
      if (!isQuickSync && process.env.GITHUB_TOKEN && profile.github_username) {
        tasks.push((async () => {
          try {
            send("status", { source: "github", state: "fetching PRs to review..." });
            const sourceIds: string[] = [];

            const reviewPRs = await fetchPRsNeedingReview(profile.github_username!);
            for (const pr of reviewPRs) {
              const sid = `review-${pr.repo}-${pr.id}`;
              sourceIds.push(sid);
              upsertItem({
                source: "github",
                source_id: sid,
                title: `Review: ${pr.title} (${pr.repo}#${pr.id})`,
                url: pr.url,
                raw_data: JSON.stringify(pr),
              });
            }
            sendItems();

            const prLabel = githubMode === "assignee" ? "assigned PRs" : "my PRs";
            send("status", { source: "github", state: `${reviewPRs.length} reviews, fetching ${prLabel}...` });
            const myPRs = githubMode === "assignee"
              ? await fetchAssignedPRs(profile.github_username!)
              : await fetchMyPRs(profile.github_username!);
            for (const pr of myPRs) {
              const sid = `pr-${pr.repo}-${pr.id}`;
              sourceIds.push(sid);
              upsertItem({
                source: "github",
                source_id: sid,
                title: `My PR: ${pr.title} (${pr.repo}#${pr.id})`,
                url: pr.url,
                raw_data: JSON.stringify(pr),
              });
            }
            removeStaleItems("github", sourceIds);
            recordSyncTime("github", sourceIds.length);
            sendItems();
          } catch (e) {
            recordSyncTime("github", 0, e instanceof Error ? e.message : String(e));
            send("error", { source: "github", message: e instanceof Error ? e.message : String(e) });
          }
        })());
      }

      // Slack
      if (profile.slack_token && profile.slack_user_id) {
        tasks.push((async () => {
          try {
            send("status", { source: "slack", state: "starting..." });
            const slackSourceIds: string[] = [];
            const messages = await fetchChannelMessages(
              profile.slack_token!,
              profile.slack_user_id!,
              (status) => send("status", { source: "slack", state: status }),
              undefined,
              slackLookbackMinutes,
              (incrementalMessages) => {
                for (const msg of incrementalMessages) {
                  if (!slackSourceIds.includes(msg.id)) {
                    slackSourceIds.push(msg.id);
                    upsertItem({
                      source: "slack",
                      source_id: msg.id,
                      title: `#${msg.channelName} — ${msg.senderName}: ${msg.text.substring(0, 100)}`,
                      url: msg.permalink,
                      raw_data: JSON.stringify(msg),
                    });
                  }
                }
                sendItems();
              },
              activeDmChannelIds,
              slackPhases,
            );
            const finalSourceIds: string[] = [];
            for (const msg of messages) {
              finalSourceIds.push(msg.id);
              upsertItem({
                source: "slack",
                source_id: msg.id,
                title: `#${msg.channelName} — ${msg.senderName}: ${msg.text.substring(0, 100)}`,
                url: msg.permalink,
                raw_data: JSON.stringify(msg),
              });
            }
            // Only prune stale items on full syncs
            if (!isQuickSync) {
              removeStaleItems("slack", finalSourceIds);
            }
            recordSyncTime("slack", finalSourceIds.length);
            sendItems();
          } catch (e) {
            console.error("[sync] Slack error:", e);
            recordSyncTime("slack", 0, e instanceof Error ? e.message : String(e));
            send("error", { source: "slack", message: e instanceof Error ? e.message : String(e) });
          }
        })());
      }

      // Google Calendar (skip on quick sync)
      if (!isQuickSync && profile.google_refresh_token) {
        tasks.push((async () => {
          try {
            send("status", { source: "calendar", state: "fetching events..." });
            const events = await fetchEvents(profile.google_refresh_token!);
            send("status", { source: "calendar", state: `found ${events.length} events` });
            const sourceIds: string[] = [];
            for (const event of events) {
              sourceIds.push(event.id);
              const timeStr = event.allDay ? "All day" :
                new Date(event.start).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
              upsertItem({
                source: "calendar",
                source_id: event.id,
                title: `${timeStr} — ${event.title}`,
                url: event.htmlLink,
                raw_data: JSON.stringify(event),
              });
            }
            removeStaleItems("calendar", sourceIds);
            recordSyncTime("calendar", sourceIds.length);
            sendItems();
          } catch (e) {
            console.error("[sync] Calendar error:", e);
            recordSyncTime("calendar", 0, e instanceof Error ? e.message : String(e));
            send("error", { source: "calendar", message: e instanceof Error ? e.message : String(e) });
          }
        })());
      }

      // Clanker sessions (skip on quick sync)
      if (!isQuickSync && (process.env.CLANKER_URL || process.env.CLANKER_API_KEY)) {
        tasks.push((async () => {
          try {
            send("status", { source: "clanker", state: "fetching sessions..." });
            const sessions = await fetchClankerSessions(profile.linear_email || undefined);
            // Filter out old finished sessions (older than 7 days)
            const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
            const finishedStatuses = new Set(["completed", "cancelled", "aborted", "failed", "stale"]);
            const relevant = sessions.filter(s => {
              if (finishedStatuses.has(s.status)) {
                const finishedDate = s.completedAt || s.updatedAt;
                return finishedDate > cutoff;
              }
              return true;
            });
            send("status", { source: "clanker", state: `found ${relevant.length} sessions` });
            const sourceIds: string[] = [];
            for (const session of relevant) {
              sourceIds.push(session.id);
              const statusEmojis: Record<string, string> = { running: "⚡", waiting: "⏸", completed: "✓", failed: "✗", aborted: "—", parked: "⏸", stale: "⚠" };
              const statusEmoji = statusEmojis[session.status] ?? "◷";
              const repoLabel = session.repo ? ` (${session.repo})` : "";
              upsertItem({
                source: "clanker",
                source_id: session.id,
                title: `${statusEmoji} ${session.prompt.substring(0, 120)}${repoLabel}`,
                url: session.url,
                raw_data: JSON.stringify(session),
              });
            }
            removeStaleItems("clanker", sourceIds);
            sendItems();
          } catch (e) {
            console.error("[sync] Clanker error:", e);
            send("error", { source: "clanker", message: e instanceof Error ? e.message : String(e) });
          }
        })());
      }

      await Promise.all(tasks);

      notifyChange();
      send("done", { syncTimes: getSyncTimes() });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
