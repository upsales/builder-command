import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(request: NextRequest) {
  const todoId = request.nextUrl.searchParams.get("todo_id");
  const sessionId = request.nextUrl.searchParams.get("session_id");
  const db = getDb();

  // Single session with full messages (for chat view)
  if (sessionId) {
    const session = db.prepare(
      `SELECT s.*, t.source as todo_source, t.source_id as todo_source_id, t.text as todo_text
       FROM agent_sessions s
       LEFT JOIN daily_todos t ON s.todo_id = t.id
       WHERE s.id = ?`
    ).get(sessionId) as Record<string, unknown> | undefined;
    if (session?.todo_source && session?.todo_source_id) {
      // Fetch the source item URL for linking
      const item = db.prepare(
        "SELECT raw_data FROM items WHERE source = ? AND source_id = ?"
      ).get(session.todo_source, session.todo_source_id) as { raw_data?: string } | undefined;
      if (item?.raw_data) {
        try {
          const raw = JSON.parse(item.raw_data);
          session.source_url = raw.url ?? null;
          session.source_identifier = raw.identifier ?? null;
        } catch { /* ignore */ }
      }
    }
    return NextResponse.json(session ?? null);
  }

  if (todoId) {
    const sessions = db.prepare(
      "SELECT id, todo_id, status, summary, failure_reason, tool_calls, started_at, completed_at, created_at FROM agent_sessions WHERE todo_id = ? ORDER BY created_at DESC"
    ).all(todoId);
    return NextResponse.json(sessions);
  }

  const sessions = db.prepare(
    "SELECT s.id, s.todo_id, s.status, s.summary, s.failure_reason, s.tool_calls, s.started_at, s.completed_at, s.created_at, t.text as todo_text FROM agent_sessions s LEFT JOIN daily_todos t ON s.todo_id = t.id ORDER BY s.created_at DESC LIMIT 20"
  ).all();
  return NextResponse.json(sessions);
}
