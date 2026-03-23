import { NextRequest, NextResponse } from "next/server";
import { logBehavior, getBehaviorStats, getLearnedPatterns, BehaviorAction } from "@/lib/behavior";

// GET /api/behavior — stats + learned patterns
export async function GET() {
  const stats = getBehaviorStats();
  const patterns = getLearnedPatterns(0.3);
  return NextResponse.json({ stats, patterns });
}

// POST /api/behavior — log a client-side action (focus, unfocus, etc.)
export async function POST(request: NextRequest) {
  const { action, source, source_id, item_title, item_context, metadata } = await request.json();
  if (!action || !source || !source_id) {
    return NextResponse.json({ error: "action, source, source_id required" }, { status: 400 });
  }
  logBehavior(action as BehaviorAction, source, source_id, item_title, item_context, metadata);
  return NextResponse.json({ ok: true });
}
