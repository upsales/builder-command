import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { triggerAgent } from "@/lib/agentRunner";
import { randomUUID } from "crypto";

export async function POST(request: NextRequest) {
  const { prompt, source, source_id } = await request.json();
  if (!prompt) {
    return NextResponse.json({ error: "prompt required" }, { status: 400 });
  }

  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);

  // Create a task with the prompt text
  const todoId = randomUUID();
  const maxOrder = (db.prepare("SELECT MAX(sort_order) as m FROM daily_todos WHERE date = ?").get(today) as { m: number | null })?.m ?? 0;
  db.prepare(
    "INSERT INTO daily_todos (id, date, text, sort_order, agent_enabled, source, source_id) VALUES (?, ?, ?, ?, 1, ?, ?)"
  ).run(todoId, today, prompt.slice(0, 500), maxOrder + 1, source ?? null, source_id ?? null);

  // If source item provided, set it as in-progress context
  if (source && source_id) {
    db.prepare(
      "INSERT OR REPLACE INTO settings (key, value) VALUES ('inProgress', ?)"
    ).run(JSON.stringify({ source, source_id, todoId }));
  }

  // Trigger the agent
  triggerAgent(todoId);

  return NextResponse.json({ ok: true, todo_id: todoId });
}
