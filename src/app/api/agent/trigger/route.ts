import { NextRequest, NextResponse } from "next/server";
import { triggerAgent } from "@/lib/agentRunner";

export async function POST(request: NextRequest) {
  const { todo_id } = await request.json();
  if (!todo_id) {
    return NextResponse.json({ error: "todo_id required" }, { status: 400 });
  }
  triggerAgent(todo_id);
  return NextResponse.json({ ok: true, triggered: todo_id });
}
