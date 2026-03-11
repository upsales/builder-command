import { NextResponse } from "next/server";
import { startSlackSocket, isSlackSocketRunning } from "@/lib/slackSocket";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    running: isSlackSocketRunning(),
    hasAppToken: !!process.env.SLACK_APP_TOKEN,
    hasBotToken: !!process.env.SLACK_BOT_TOKEN,
  });
}

export async function POST() {
  try {
    startSlackSocket();
    // Give it a moment to connect
    await new Promise((r) => setTimeout(r, 2000));
    return NextResponse.json({
      running: isSlackSocketRunning(),
      message: isSlackSocketRunning() ? "Socket Mode connected" : "Socket Mode started (connecting...)",
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
