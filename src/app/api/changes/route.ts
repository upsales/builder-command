import { NextResponse } from "next/server";
import { getChangeCounter } from "@/lib/changeNotifier";
import { getAgentStatus } from "@/lib/agentRunner";
import { getSyncTimes } from "@/lib/items";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ v: getChangeCounter(), agentStatus: getAgentStatus(), syncTimes: getSyncTimes() });
}
