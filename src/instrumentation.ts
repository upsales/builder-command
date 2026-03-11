export async function register() {
  // Only run on the server (not edge runtime)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startSlackSocket } = await import("@/lib/slack-socket");
    startSlackSocket();
    const { startAgentRunner } = await import("@/lib/agentRunner");
    startAgentRunner();

    // Run Slack sync on startup to backfill any messages missed while offline
    const { startupSlackSync } = await import("@/lib/integrations/slack");
    startupSlackSync(); // fire and forget — don't block server startup
  }
}
