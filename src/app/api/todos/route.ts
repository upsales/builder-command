import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { randomUUID } from "crypto";

function today() {
  return new Date().toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get("mode");
  const db = getDb();

  if (mode === "queue") {
    // Fetch today's todos + all undated todos + incomplete past todos + done tasks from last 7 days
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const todos = db.prepare(
      `SELECT * FROM daily_todos
       WHERE (date = ? OR date IS NULL OR (done = 0 AND date < ?) OR (done = 1 AND date >= ? AND date < ?))
       ORDER BY done ASC, sort_order, created_at`
    ).all(today(), today(), weekAgo, today());
    return NextResponse.json(todos);
  }

  const date = request.nextUrl.searchParams.get("date") ?? today();
  const todos = db.prepare(
    "SELECT * FROM daily_todos WHERE date = ? ORDER BY sort_order, created_at"
  ).all(date);
  return NextResponse.json(todos);
}

export async function POST(request: NextRequest) {
  const { text, date, deadline, image, source, source_id } = await request.json();
  const db = getDb();
  const id = randomUUID();
  // date can be: a date string, null (persistent), or undefined (defaults to today)
  const d = date === null ? null : (date ?? today());
  const maxOrder = db.prepare(
    "SELECT COALESCE(MAX(sort_order), 0) as m FROM daily_todos WHERE done = 0"
  ).get() as { m: number };
  db.prepare(
    "INSERT INTO daily_todos (id, date, text, sort_order, deadline, image, source, source_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(id, d, text, maxOrder.m + 1, deadline ?? null, image ?? null, source ?? null, source_id ?? null);
  return NextResponse.json({ id, date: d, text, done: 0, sort_order: maxOrder.m + 1, deadline: deadline ?? null, image: image ?? null, source: source ?? null, source_id: source_id ?? null });
}

export async function PATCH(request: NextRequest) {
  const { id, done, text, deadline, note, agent_enabled } = await request.json();
  const db = getDb();
  if (done !== undefined) {
    const wasDone = (db.prepare("SELECT done FROM daily_todos WHERE id = ?").get(id) as { done: number } | undefined)?.done;
    db.prepare("UPDATE daily_todos SET done = ? WHERE id = ?").run(done ? 1 : 0, id);
    if (done && !wasDone) {
      const todoRow = db.prepare("SELECT text FROM daily_todos WHERE id = ?").get(id) as { text: string } | undefined;
      db.prepare("INSERT INTO xp_log (action, source, xp, label) VALUES (?, ?, ?, ?)").run(
        "complete_todo", null, 20, todoRow?.text ?? "Completed todo"
      );
    }
  }
  if (text !== undefined) {
    db.prepare("UPDATE daily_todos SET text = ? WHERE id = ?").run(text, id);
  }
  if (deadline !== undefined) {
    db.prepare("UPDATE daily_todos SET deadline = ? WHERE id = ?").run(deadline, id);
  }
  if (note !== undefined) {
    db.prepare("UPDATE daily_todos SET note = ? WHERE id = ?").run(note, id);
  }
  if (agent_enabled !== undefined) {
    db.prepare("UPDATE daily_todos SET agent_enabled = ? WHERE id = ?").run(agent_enabled ? 1 : 0, id);
  }
  return NextResponse.json({ ok: true });
}

export async function PUT(request: NextRequest) {
  // Reorder: receives array of { id, sort_order }
  const { order } = await request.json();
  const db = getDb();
  const stmt = db.prepare("UPDATE daily_todos SET sort_order = ? WHERE id = ?");
  const txn = db.transaction((items: { id: string; sort_order: number }[]) => {
    for (const item of items) {
      stmt.run(item.sort_order, item.id);
    }
  });
  txn(order);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const { id } = await request.json();
  const db = getDb();
  db.prepare("DELETE FROM daily_todos WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
