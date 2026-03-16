import Anthropic from "@anthropic-ai/sdk";
import { getDb, getSetting } from "@/lib/db";
import { tools, executeTool, buildSystemPrompt } from "@/lib/chatTools";

function getMaxRounds(): number {
  const setting = getSetting("agent_max_rounds");
  if (setting) {
    const parsed = parseInt(setting, 10);
    if (!isNaN(parsed) && parsed >= 5 && parsed <= 100) return parsed;
  }
  return 30;
}
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
       WHERE s.todo_id = dt.id
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

  // Check if there's an existing incomplete/failed session to resume
  const existingSession = db.prepare(
    `SELECT id, status FROM agent_sessions WHERE todo_id = ? ORDER BY created_at DESC LIMIT 1`
  ).get(todoId) as { id: string; status: string } | undefined;

  if (existingSession) {
    if (existingSession.status === "running") {
      // Already running, nothing to do
      return;
    }
    if (existingSession.status === "completed") {
      // Already done, nothing to do
      return;
    }
    // Resume the existing incomplete/failed session
    if (!processing) {
      continueSession(existingSession.id, "Continue working on this task. Pick up where you left off.").catch(e => {
        console.error("[AgentRunner] Failed to resume session:", e);
      });
    }
    return;
  }

  // No existing session — start fresh
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
    // First, check for any due scheduled followups
    const followup = getNextDueFollowup();
    if (followup) {
      console.log(`[AgentRunner] Resuming scheduled followup for session ${followup.session_id}: "${followup.instruction}"`);
      const db = getDb();
      db.prepare("UPDATE scheduled_followups SET status = 'running' WHERE id = ?").run(followup.id);
      try {
        await continueSession(followup.session_id, `[Scheduled followup] ${followup.instruction}`);
        db.prepare("UPDATE scheduled_followups SET status = 'completed' WHERE id = ?").run(followup.id);
      } catch (e) {
        console.error("[AgentRunner] Scheduled followup failed:", e);
        db.prepare("UPDATE scheduled_followups SET status = 'failed' WHERE id = ?").run(followup.id);
      }
    } else {
      // Then check for new tasks
      const todo = getNextEligibleTodo();
      if (todo) {
        await processTask(todo);
      }
    }
  } catch (e) {
    console.error("[AgentRunner] Error in tick:", e);
  }

  scheduleNext();
}

function getNextDueFollowup(): { id: string; session_id: string; instruction: string } | null {
  const db = getDb();
  return db.prepare(
    `SELECT id, session_id, instruction FROM scheduled_followups
     WHERE status = 'pending' AND run_at <= datetime('now')
     ORDER BY run_at ASC
     LIMIT 1`
  ).get() as { id: string; session_id: string; instruction: string } | null;
}

function getNextEligibleTodo(): { id: string; text: string; source?: string; source_id?: string; agent_prompt?: string } | null {
  const db = getDb();
  // Exclude todos that already have ANY session (running, completed, failed, incomplete)
  // Users must explicitly re-trigger or send a follow-up to retry
  return db.prepare(
    `SELECT dt.id, dt.text, dt.source, dt.source_id, dt.agent_prompt FROM daily_todos dt
     WHERE dt.done = 0 AND dt.agent_enabled = 1
     AND NOT EXISTS (
       SELECT 1 FROM agent_sessions s
       WHERE s.todo_id = dt.id
     )
     ORDER BY dt.sort_order ASC
     LIMIT 1`
  ).get() as { id: string; text: string; source?: string; source_id?: string } | null;
}

function getSourceContext(source?: string, sourceId?: string): string {
  if (!source || !sourceId) return "";
  const db = getDb();

  if (source === "linear") {
    const item = db.prepare("SELECT raw_data FROM items WHERE source = 'linear' AND source_id = ?").get(sourceId) as { raw_data?: string } | undefined;
    if (item?.raw_data) {
      try {
        const raw = JSON.parse(item.raw_data);
        const parts = [
          `## Source: Linear Issue ${raw.identifier}`,
          `**Title:** ${raw.title}`,
          `**State:** ${raw.state}`,
          `**Priority:** ${["None", "Urgent", "High", "Medium", "Low"][raw.priority ?? 0]}`,
          raw.assignee ? `**Assignee:** ${raw.assignee}` : null,
          raw.labels?.length ? `**Labels:** ${raw.labels.join(", ")}` : null,
          raw.description ? `**Description:**\n${raw.description}` : null,
          raw.url ? `**URL:** ${raw.url}` : null,
        ].filter(Boolean);
        return "\n\n" + parts.join("\n");
      } catch { /* ignore */ }
    }
  }

  if (source === "github") {
    const item = db.prepare("SELECT raw_data FROM items WHERE source = 'github' AND source_id = ?").get(sourceId) as { raw_data?: string } | undefined;
    if (item?.raw_data) {
      try {
        const raw = JSON.parse(item.raw_data);
        const parts = [
          `## Source: GitHub PR #${raw.id} (${raw.repo})`,
          `**Title:** ${raw.title}`,
          `**State:** ${raw.draft ? "Draft" : raw.mergeableState ?? "open"}`,
          raw.body ? `**Description:**\n${raw.body.slice(0, 2000)}` : null,
          raw.url ? `**URL:** ${raw.url}` : null,
        ].filter(Boolean);
        return "\n\n" + parts.join("\n");
      } catch { /* ignore */ }
    }
  }

  return "";
}

async function processTask(todo: { id: string; text: string; source?: string; source_id?: string; agent_prompt?: string }) {
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

  const toolCallsLog: { tool: string; input: unknown; result: string; timestamp: string }[] = [];
  const allMessages: Anthropic.MessageParam[] = [];

  // Fetch source context (Linear issue details, GitHub PR details, etc.)
  const sourceContext = getSourceContext(todo.source, todo.source_id);

  try {
    const basePrompt = buildSystemPrompt();
    let maxRounds = getMaxRounds();
    const totalBudget = maxRounds;
    const agentPrompt = `${basePrompt}

## AGENT MODE
You are an autonomous AI agent. You've been assigned a specific task to complete.
${sourceContext}
TURN BUDGET: You have a maximum of ${totalBudget} turns. Each tool call response counts as one turn. Plan accordingly — if the task is complex, prioritize the most impactful actions first. If the task is too large for your budget, do as much meaningful work as possible and leave clear notes — the user can send a follow-up to continue where you left off with your full conversation history preserved.

RULES:
1. Write a 1-sentence PLAN, then execute using tools
2. Be CONCISE and DENSE — no filler, no fluff, no verbose explanations
3. End with a **SUMMARY:** section — bullet points preferred, keep it tight
4. If you CANNOT complete the task, state WHY in one sentence
5. Be efficient — minimum tool calls needed
6. NEVER use the complete_todo tool. The user will review your work and decide when to mark it done.
7. When you see a "TURN BUDGET WARNING", wrap up immediately — summarize what you accomplished, what remains, and suggest what to do in the next follow-up.
8. For tasks that require WAITING (CI checks, deployments, external responses), use schedule_followup to pause and resume later instead of wasting turns polling. Example: after triggering a merge, schedule a 10m followup to verify it succeeded.

TASK: "${todo.text}"${todo.agent_prompt ? `\n\nTASK-SPECIFIC INSTRUCTIONS FROM USER:\n${todo.agent_prompt}` : ""}`;

    const userMessage: Anthropic.MessageParam = {
      role: "user",
      content: `Work on this task: ${todo.text}`,
    };
    allMessages.push(userMessage);

    let currentMessages = [...allMessages];
    let finalText = "";
    let exhaustedRounds = false;
    let scheduledStop = false;

    while (maxRounds > 0) {
      maxRounds--;

      const response = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: [{ type: "text", text: agentPrompt, cache_control: { type: "ephemeral" } }],
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

          const result = await executeTool(block.name, block.input as Record<string, unknown>, { sessionId });

          toolCallsLog.push({
            tool: block.name,
            input: block.input,
            result: result.length > 500 ? result.slice(0, 500) + "..." : result,
            timestamp: new Date().toISOString(),
          });

          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: result,
          });

          // If agent scheduled a followup, stop the loop after processing remaining tool results
          if (block.name === "schedule_followup") {
            scheduledStop = true;
          }
        }
      }

      if (!hasToolUse || response.stop_reason !== "tool_use" || scheduledStop) {
        // Save final assistant response to messages
        currentMessages = [
          ...currentMessages,
          { role: "assistant" as const, content: response.content },
        ];
        break;
      }

      // Inject turn budget warning when running low
      const turnContent: (Anthropic.ToolResultBlockParam | Anthropic.TextBlockParam)[] = [...toolResults];
      if (maxRounds <= 3 && maxRounds > 0) {
        turnContent.push({
          type: "text",
          text: `⚠️ TURN BUDGET WARNING: You have ${maxRounds} turn(s) remaining. Wrap up now — write your SUMMARY of what was accomplished and what remains.`,
        });
      }

      // Continue conversation with tool results
      currentMessages = [
        ...currentMessages,
        { role: "assistant" as const, content: response.content },
        { role: "user" as const, content: turnContent },
      ];

      // Update session in-progress so the UI can show real-time data
      db.prepare(
        `UPDATE agent_sessions SET
          tool_calls = ?,
          messages = ?
        WHERE id = ?`
      ).run(
        JSON.stringify(toolCallsLog),
        JSON.stringify(currentMessages),
        sessionId
      );
      notifyChange();

      if (maxRounds === 0) {
        exhaustedRounds = true;
      }
    }

    // Extract summary from final text
    const summary = extractSummary(finalText);

    // Determine final status
    const finalStatus = scheduledStop ? "waiting" : exhaustedRounds ? "incomplete" : "completed";

    db.prepare(
      `UPDATE agent_sessions SET
        status = ?,
        summary = ?,
        tool_calls = ?,
        messages = ?,
        completed_at = datetime('now')
      WHERE id = ?`
    ).run(
      finalStatus,
      summary || (exhaustedRounds ? "Agent ran out of rounds before finishing. You can continue the session." : null),
      JSON.stringify(toolCallsLog),
      JSON.stringify(currentMessages),
      sessionId
    );

    console.log(`[AgentRunner] Task ${finalStatus}: "${todo.text}"`);
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

export async function continueSession(sessionId: string, followUpText: string): Promise<string> {
  const db = getDb();
  const session = db.prepare("SELECT * FROM agent_sessions WHERE id = ?").get(sessionId) as {
    id: string; todo_id: string; status: string; messages?: string; tool_calls?: string;
  } | undefined;

  if (!session) throw new Error("Session not found");
  if (session.status === "running") throw new Error("Session is already running");

  // Restore previous messages
  let previousMessages: Anthropic.MessageParam[] = [];
  if (session.messages) {
    try { previousMessages = JSON.parse(session.messages); } catch { /* start fresh */ }
  }
  let toolCallsLog: { tool: string; input: unknown; result: string; timestamp: string }[] = [];
  if (session.tool_calls) {
    try { toolCallsLog = JSON.parse(session.tool_calls); } catch { /* start fresh */ }
  }

  // Get the task text
  const todo = db.prepare("SELECT text, agent_prompt FROM daily_todos WHERE id = ?").get(session.todo_id) as { text: string; agent_prompt: string | null } | undefined;
  const taskText = todo?.text ?? "task";

  // Mark session as running again
  db.prepare(
    "UPDATE agent_sessions SET status = 'running', summary = NULL, failure_reason = NULL, completed_at = NULL WHERE id = ?"
  ).run(sessionId);
  notifyChange();

  processing = true;
  currentTodoId = session.todo_id;

  try {
    const basePrompt = buildSystemPrompt();
    let maxRounds = getMaxRounds();
    const totalBudget = maxRounds;
    const agentPrompt = `${basePrompt}

## AGENT MODE (Follow-up)
You are an autonomous AI agent continuing work on a task. The user has sent a follow-up message.

TURN BUDGET: You have a maximum of ${totalBudget} turns for this follow-up. Plan accordingly. If there's still more to do, leave clear notes — the user can send another follow-up to continue.

RULES:
1. Consider the previous conversation context
2. Execute the follow-up request using tools
3. Be CONCISE and DENSE — no filler, bullet points preferred
4. End with a **SUMMARY:** section — keep it tight
5. If you CANNOT complete the request, state WHY in one sentence
6. Be efficient — minimum tool calls needed
7. NEVER use the complete_todo tool
8. When you see a "TURN BUDGET WARNING", wrap up immediately — summarize what you accomplished, what remains, and suggest what to do in the next follow-up.
9. For tasks that require WAITING, use schedule_followup to pause and resume later.

ORIGINAL TASK: "${taskText}"${todo?.agent_prompt ? `\n\nTASK-SPECIFIC INSTRUCTIONS FROM USER:\n${todo.agent_prompt}` : ""}`;

    // Add follow-up as new user message
    const currentMessages: Anthropic.MessageParam[] = [
      ...previousMessages,
      { role: "user", content: followUpText },
    ];
    let finalText = "";
    let exhaustedRounds = false;
    let scheduledStop = false;

    while (maxRounds > 0) {
      maxRounds--;

      const response = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: [{ type: "text", text: agentPrompt, cache_control: { type: "ephemeral" } }],
        tools,
        messages: currentMessages,
      });

      for (const block of response.content) {
        if (block.type === "text") finalText += block.text;
      }

      let hasToolUse = false;
      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const block of response.content) {
        if (block.type === "tool_use") {
          hasToolUse = true;
          const result = await executeTool(block.name, block.input as Record<string, unknown>, { sessionId });
          toolCallsLog.push({
            tool: block.name,
            input: block.input,
            result: result.length > 500 ? result.slice(0, 500) + "..." : result,
            timestamp: new Date().toISOString(),
          });
          toolResults.push({ type: "tool_result", tool_use_id: block.id, content: result });

          if (block.name === "schedule_followup") {
            scheduledStop = true;
          }
        }
      }

      if (!hasToolUse || response.stop_reason !== "tool_use" || scheduledStop) {
        currentMessages.push({ role: "assistant" as const, content: response.content });
        break;
      }

      // Inject turn budget warning when running low
      const turnContent: (Anthropic.ToolResultBlockParam | Anthropic.TextBlockParam)[] = [...toolResults];
      if (maxRounds <= 3 && maxRounds > 0) {
        turnContent.push({
          type: "text",
          text: `⚠️ TURN BUDGET WARNING: You have ${maxRounds} turn(s) remaining. Wrap up now — write your SUMMARY of what was accomplished and what remains.`,
        });
      }

      currentMessages.push(
        { role: "assistant" as const, content: response.content },
        { role: "user" as const, content: turnContent },
      );

      db.prepare("UPDATE agent_sessions SET tool_calls = ?, messages = ? WHERE id = ?")
        .run(JSON.stringify(toolCallsLog), JSON.stringify(currentMessages), sessionId);
      notifyChange();

      if (maxRounds === 0) exhaustedRounds = true;
    }

    const summary = extractSummary(finalText);
    const finalStatus = scheduledStop ? "waiting" : exhaustedRounds ? "incomplete" : "completed";
    db.prepare(
      `UPDATE agent_sessions SET status = ?, summary = ?, tool_calls = ?, messages = ?, completed_at = datetime('now') WHERE id = ?`
    ).run(finalStatus, summary || (exhaustedRounds ? "Agent ran out of rounds. You can continue the session." : null), JSON.stringify(toolCallsLog), JSON.stringify(currentMessages), sessionId);

    processing = false;
    currentTodoId = null;
    notifyChange();
    return sessionId;
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    db.prepare(
      "UPDATE agent_sessions SET status = 'failed', failure_reason = ?, completed_at = datetime('now') WHERE id = ?"
    ).run(errorMsg, sessionId);
    processing = false;
    currentTodoId = null;
    notifyChange();
    throw e;
  }
}

function extractSummary(text: string): string {
  // Try to find a **SUMMARY:** or SUMMARY: section — capture everything after it
  const summaryMatch = text.match(/\*{0,2}SUMMARY[:\s*]*\*{0,2}\s*([\s\S]+?)$/i);
  if (summaryMatch) return summaryMatch[1].trim().slice(0, 2000);

  // Otherwise use the last paragraph as summary
  const paragraphs = text.split("\n\n").filter(p => p.trim());
  if (paragraphs.length > 0) return paragraphs[paragraphs.length - 1].trim().slice(0, 2000);

  return text.trim().slice(0, 2000);
}

function recoverStaleSessions() {
  const db = getDb();
  // Mark any 'running' sessions as incomplete — they were interrupted by server restart
  // Use a short threshold (2 min) since in-memory state is gone on restart
  const stale = db.prepare(
    `UPDATE agent_sessions SET
      status = 'incomplete',
      failure_reason = 'Server restarted during processing. Send a follow-up to continue.',
      completed_at = datetime('now')
    WHERE status = 'running'
      AND started_at < datetime('now', '-2 minutes')`
  ).run();

  if (stale.changes > 0) {
    console.log(`[AgentRunner] Recovered ${stale.changes} stale session(s) as incomplete`);
  }

  // Reset any 'running' scheduled followups back to pending (they were interrupted)
  const staleFollowups = db.prepare(
    "UPDATE scheduled_followups SET status = 'pending' WHERE status = 'running'"
  ).run();
  if (staleFollowups.changes > 0) {
    console.log(`[AgentRunner] Reset ${staleFollowups.changes} stale followup(s) to pending`);
  }
}
