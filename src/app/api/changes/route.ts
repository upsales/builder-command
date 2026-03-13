import { NextResponse } from "next/server";
import { getChangeCounter } from "@/lib/changeNotifier";
import { getAgentStatus } from "@/lib/agentRunner";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ v: getChangeCounter(), agentStatus: getAgentStatus() });
}
