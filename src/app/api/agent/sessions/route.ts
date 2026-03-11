import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(request: NextRequest) {
  const todoId = request.nextUrl.searchParams.get("todo_id");
  const db = getDb();

  if (todoId) {
    const sessions = db.prepare(
      "SELECT * FROM agent_sessions WHERE todo_id = ? ORDER BY created_at DESC"
    ).all(todoId);
    return NextResponse.json(sessions);
  }

  const sessions = db.prepare(
    "SELECT * FROM agent_sessions ORDER BY created_at DESC LIMIT 20"
  ).all();
  return NextResponse.json(sessions);
}
