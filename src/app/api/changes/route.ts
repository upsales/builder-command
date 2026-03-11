import { NextResponse } from "next/server";
import { getChangeCounter } from "@/lib/changeNotifier";
import { isSlackSocketRunning, getSlackSocketLog } from "@/lib/slackSocket";
import { getAgentStatus } from "@/lib/agentRunner";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ v: getChangeCounter(), slackSocket: isSlackSocketRunning(), socketLog: getSlackSocketLog(), agentStatus: getAgentStatus() });
}
