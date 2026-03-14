import { NextRequest, NextResponse } from "next/server";
import { triggerAgent, continueSession } from "@/lib/agentRunner";
import { getDb } from "@/lib/db";

export async function POST(request: NextRequest) {
  const { todo_id, session_id, follow_up, agent_prompt } = await request.json();

  // Continue an existing session with a follow-up message
  if (session_id && follow_up) {
    try {
      await continueSession(session_id, follow_up);
      return NextResponse.json({ ok: true, session_id });
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 400 });
    }
  }

  if (!todo_id) {
    return NextResponse.json({ error: "todo_id required" }, { status: 400 });
  }

  // Store task-specific prompt if provided
  if (agent_prompt) {
    const db = getDb();
    db.prepare("UPDATE daily_todos SET agent_prompt = ? WHERE id = ?").run(agent_prompt, todo_id);
  }

  triggerAgent(todo_id);
  return NextResponse.json({ ok: true, triggered: todo_id });
}
