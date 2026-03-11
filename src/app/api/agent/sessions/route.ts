import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(request: NextRequest) {
  const todoId = request.nextUrl.searchParams.get("todo_id");
  const sessionId = request.nextUrl.searchParams.get("session_id");
  const db = getDb();

  // Single session with full messages (for chat view)
  if (sessionId) {
    const session = db.prepare(
      "SELECT * FROM agent_sessions WHERE id = ?"
    ).get(sessionId);
    return NextResponse.json(session ?? null);
  }

  if (todoId) {
    const sessions = db.prepare(
      "SELECT id, todo_id, status, summary, failure_reason, tool_calls, started_at, completed_at, created_at FROM agent_sessions WHERE todo_id = ? ORDER BY created_at DESC"
    ).all(todoId);
    return NextResponse.json(sessions);
  }

  const sessions = db.prepare(
    "SELECT id, todo_id, status, summary, failure_reason, tool_calls, started_at, completed_at, created_at FROM agent_sessions ORDER BY created_at DESC LIMIT 20"
  ).all();
  return NextResponse.json(sessions);
}
