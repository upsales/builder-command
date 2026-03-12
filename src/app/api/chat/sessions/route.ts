import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { randomUUID } from "crypto";

// GET — list sessions or get a specific one
export async function GET(request: NextRequest) {
  const db = getDb();
  const id = request.nextUrl.searchParams.get("id");

  if (id) {
    const session = db.prepare("SELECT * FROM chat_sessions WHERE id = ?").get(id);
    if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(session);
  }

  // Purge sessions older than 72 hours
  db.prepare("DELETE FROM chat_sessions WHERE updated_at < datetime('now', '-72 hours')").run();

  const sessions = db.prepare(
    "SELECT id, title, created_at, updated_at FROM chat_sessions ORDER BY updated_at DESC LIMIT 50"
  ).all();
  return NextResponse.json(sessions);
}

// POST — create or update a session
export async function POST(request: NextRequest) {
  const { id, title, messages } = await request.json();
  const db = getDb();

  if (id) {
    // Update existing session
    const existing = db.prepare("SELECT id FROM chat_sessions WHERE id = ?").get(id);
    if (existing) {
      db.prepare(
        "UPDATE chat_sessions SET title = COALESCE(?, title), messages = ?, updated_at = datetime('now') WHERE id = ?"
      ).run(title ?? null, JSON.stringify(messages), id);
      return NextResponse.json({ id });
    }
  }

  // Create new session
  const newId = id || randomUUID();
  const sessionTitle = title || (messages?.[0]?.content?.slice(0, 60) ?? "New chat");
  db.prepare(
    "INSERT INTO chat_sessions (id, title, messages, updated_at) VALUES (?, ?, ?, datetime('now'))"
  ).run(newId, sessionTitle, JSON.stringify(messages ?? []));
  return NextResponse.json({ id: newId });
}

// DELETE — delete a session
export async function DELETE(request: NextRequest) {
  const { id } = await request.json();
  const db = getDb();
  db.prepare("DELETE FROM chat_sessions WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
