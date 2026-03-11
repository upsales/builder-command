import Anthropic from "@anthropic-ai/sdk";
import { getDb } from "@/lib/db";
import { tools, executeTool, buildSystemPrompt } from "@/lib/chatTools";
import { notifyChange } from "@/lib/changeNotifier";
import { randomUUID } from "crypto";

const client = new Anthropic();

let enabled = false;
let timer: ReturnType<typeof setTimeout> | null = null;
let currentTodoId: string | null = null;
let processing = false;

interface AgentStatus {
  running: boolean;
  currentTodoId: string | null;
  currentTodoText: string | null;
  queueLength: number;
}

export function startAgentRunner() {
  if (enabled) return;
  enabled = true;
  console.log("[AgentRunner] Started");

  // Recover stale sessions on startup
  recoverStaleSessions();

  scheduleNext();
}

export function stopAgentRunner() {
  enabled = false;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  console.log("[AgentRunner] Stopped");
}

export function getAgentStatus(): AgentStatus {
  const db = getDb();
  const queue = db.prepare(
    `SELECT COUNT(*) as count FROM daily_todos dt
     WHERE dt.done = 0 AND dt.agent_enabled = 1
     AND NOT EXISTS (
       SELECT 1 FROM agent_sessions s
       WHERE s.todo_id = dt.id AND s.status IN ('running', 'completed')
     )`
  ).get() as { count: number };

  let currentText: string | null = null;
  if (currentTodoId) {
    const todo = db.prepare("SELECT text FROM daily_todos WHERE id = ?").get(currentTodoId) as { text: string } | undefined;
    currentText = todo?.text ?? null;
  }

  return {
    running: processing,
    currentTodoId,
    currentTodoText: currentText,
    queueLength: queue.count,
  };
}

export function triggerAgent(todoId: string) {
  const db = getDb();
  db.prepare("UPDATE daily_todos SET agent_enabled = 1 WHERE id = ?").run(todoId);

  // Ensure the runner is started (handles Next.js dev mode module isolation)
  if (!enabled) {
    startAgentRunner();
  }

  // If not currently processing, start immediately
  if (!processing) {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    tick();
  }
}

function scheduleNext() {
  if (!enabled) return;
  timer = setTimeout(tick, 10000);
}

async function tick() {
  if (!enabled || processing) return;

  try {
    const todo = getNextEligibleTodo();
    if (todo) {
      await processTask(todo);
    }
  } catch (e) {
    console.error("[AgentRunner] Error in tick:", e);
  }

  scheduleNext();
}

function getNextEligibleTodo(): { id: string; text: string } | null {
  const db = getDb();
  return db.prepare(
    `SELECT dt.id, dt.text FROM daily_todos dt
     WHERE dt.done = 0 AND dt.agent_enabled = 1
     AND NOT EXISTS (
       SELECT 1 FROM agent_sessions s
       WHERE s.todo_id = dt.id AND s.status IN ('running', 'completed')
     )
     ORDER BY dt.sort_order ASC
     LIMIT 1`
  ).get() as { id: string; text: string } | null;
}

async function processTask(todo: { id: string; text: string }) {
  processing = true;
  currentTodoId = todo.id;
  const sessionId = randomUUID();
  const db = getDb();

  console.log(`[AgentRunner] Processing task: "${todo.text}" (${todo.id})`);

  // Insert session
  db.prepare(
    `INSERT INTO agent_sessions (id, todo_id, status, started_at)
     VALUES (?, ?, 'running', datetime('now'))`
  ).run(sessionId, todo.id);
  notifyChange();

  const toolCallsLog: { tool: string; input: unknown; result: string }[] = [];
  const allMessages: Anthropic.MessageParam[] = [];

  try {
    const basePrompt = buildSystemPrompt();
    const agentPrompt = `${basePrompt}

## AGENT MODE
You are an autonomous AI agent. You've been assigned a specific task to complete.

RULES:
1. First, write a 1-2 sentence PLAN of what you'll do
2. Execute using tools
3. End with a SUMMARY of what you accomplished
4. If you CANNOT complete the task, clearly state WHY
5. Be efficient — minimum tool calls needed

TASK: "${todo.text}"`;

    const userMessage: Anthropic.MessageParam = {
      role: "user",
      content: `Work on this task: ${todo.text}`,
    };
    allMessages.push(userMessage);

    let currentMessages = [...allMessages];
    let maxRounds = 10;
    let finalText = "";

    while (maxRounds > 0) {
      maxRounds--;

      const response = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: agentPrompt,
        tools,
        messages: currentMessages,
      });

      // Collect text from response
      for (const block of response.content) {
        if (block.type === "text") {
          finalText += block.text;
        }
      }

      // Process tool calls
      let hasToolUse = false;
      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const block of response.content) {
        if (block.type === "tool_use") {
          hasToolUse = true;
          console.log(`[AgentRunner] Tool call: ${block.name}`);

          const result = await executeTool(block.name, block.input as Record<string, unknown>);

          toolCallsLog.push({
            tool: block.name,
            input: block.input,
            result: result.length > 500 ? result.slice(0, 500) + "..." : result,
          });

          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: result,
          });
        }
      }

      if (!hasToolUse || response.stop_reason !== "tool_use") {
        break;
      }

      // Continue conversation with tool results
      currentMessages = [
        ...currentMessages,
        { role: "assistant" as const, content: response.content },
        { role: "user" as const, content: toolResults },
      ];
    }

    // Extract summary from final text
    const summary = extractSummary(finalText);

    // Update session as completed
    db.prepare(
      `UPDATE agent_sessions SET
        status = 'completed',
        summary = ?,
        tool_calls = ?,
        messages = ?,
        completed_at = datetime('now')
      WHERE id = ?`
    ).run(
      summary,
      JSON.stringify(toolCallsLog),
      JSON.stringify(currentMessages),
      sessionId
    );

    console.log(`[AgentRunner] Task completed: "${todo.text}"`);
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    console.error(`[AgentRunner] Task failed: "${todo.text}" - ${errorMsg}`);

    db.prepare(
      `UPDATE agent_sessions SET
        status = 'failed',
        failure_reason = ?,
        tool_calls = ?,
        completed_at = datetime('now')
      WHERE id = ?`
    ).run(errorMsg, JSON.stringify(toolCallsLog), sessionId);
  }

  processing = false;
  currentTodoId = null;
  notifyChange();
}

function extractSummary(text: string): string {
  // Try to find a SUMMARY section
  const summaryMatch = text.match(/SUMMARY[:\s]*(.+?)(?:\n\n|$)/si);
  if (summaryMatch) return summaryMatch[1].trim();

  // Otherwise use the last paragraph as summary
  const paragraphs = text.split("\n\n").filter(p => p.trim());
  if (paragraphs.length > 0) return paragraphs[paragraphs.length - 1].trim();

  return text.trim().slice(0, 500);
}

function recoverStaleSessions() {
  const db = getDb();
  const stale = db.prepare(
    `UPDATE agent_sessions SET
      status = 'failed',
      failure_reason = 'Server restarted during processing.',
      completed_at = datetime('now')
    WHERE status = 'running'
      AND started_at < datetime('now', '-10 minutes')`
  ).run();

  if (stale.changes > 0) {
    console.log(`[AgentRunner] Recovered ${stale.changes} stale session(s)`);
  }
}
