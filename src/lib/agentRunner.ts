import { query, tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { getDb, getSetting } from "@/lib/db";
import { executeTool } from "@/lib/chatTools";
import { notifyChange } from "@/lib/changeNotifier";
import { randomUUID } from "crypto";
import { dirname } from "path";

function getMaxRounds(): number {
  const setting = getSetting("agent_max_rounds");
  if (setting) {
    const parsed = parseInt(setting, 10);
    if (!isNaN(parsed) && parsed >= 5 && parsed <= 100) return parsed;
  }
  return 30;
}

// --- SDK MCP Tools ---
// Wrap each tool from chatTools.ts in SDK format using tool() helper.
// Each tool calls executeTool() which has the actual implementation.

function buildMcpServer(sessionId: string, abortController: AbortController) {
  const ctx = { sessionId };

  const sdkTools = [
    tool("dismiss_item", "Dismiss/clear an item from the user's queue.", { source: z.enum(["linear", "github", "slack", "calendar"]), source_id: z.string() },
      async (args) => { const r = await executeTool("dismiss_item", args, ctx); return { content: [{ type: "text" as const, text: r }] }; }),
    tool("snooze_item", "Snooze an item so it reappears later.", { source: z.enum(["linear", "github", "slack", "calendar"]), source_id: z.string(), duration: z.enum(["1h", "2h", "4h", "tomorrow", "next_week"]) },
      async (args) => { const r = await executeTool("snooze_item", args, ctx); return { content: [{ type: "text" as const, text: r }] }; }),
    tool("merge_pr", "Merge a GitHub pull request.", { repo: z.string(), pr_number: z.number() },
      async (args) => { const r = await executeTool("merge_pr", args, ctx); return { content: [{ type: "text" as const, text: r }] }; }),
    tool("enable_auto_merge", "Enable auto-merge on a PR so it merges when checks pass.", { repo: z.string(), pr_number: z.number() },
      async (args) => { const r = await executeTool("enable_auto_merge", args, ctx); return { content: [{ type: "text" as const, text: r }] }; }),
    tool("add_reviewer", "Request a review from someone on a GitHub PR.", { repo: z.string(), pr_number: z.number(), reviewer: z.string() },
      async (args) => { const r = await executeTool("add_reviewer", args, ctx); return { content: [{ type: "text" as const, text: r }] }; }),
    tool("update_linear_status", "Change the status of a Linear issue.", { issue_id: z.string(), state_id: z.string() },
      async (args) => { const r = await executeTool("update_linear_status", args, ctx); return { content: [{ type: "text" as const, text: r }] }; }),
    tool("assign_linear_issue", "Assign a Linear issue to someone.", { issue_id: z.string(), assignee_id: z.string().optional() },
      async (args) => { const r = await executeTool("assign_linear_issue", args, ctx); return { content: [{ type: "text" as const, text: r }] }; }),
    tool("reply_slack", "Send a reply in a Slack thread.", { channel: z.string(), text: z.string(), thread_ts: z.string() },
      async (args) => { const r = await executeTool("reply_slack", args, ctx); return { content: [{ type: "text" as const, text: r }] }; }),
    tool("react_slack", "Add an emoji reaction to a Slack message.", { channel: z.string(), timestamp: z.string(), reaction: z.string() },
      async (args) => { const r = await executeTool("react_slack", args, ctx); return { content: [{ type: "text" as const, text: r }] }; }),
    tool("create_todo", "Create a new todo item for the user.", { text: z.string(), persistent: z.boolean().optional() },
      async (args) => { const r = await executeTool("create_todo", args, ctx); return { content: [{ type: "text" as const, text: r }] }; }),
    tool("complete_todo", "Mark a todo item as done.", { todo_id: z.string() },
      async (args) => { const r = await executeTool("complete_todo", args, ctx); return { content: [{ type: "text" as const, text: r }] }; }),
    tool("search_code", "Search for code patterns in a GitHub repository.", { repo: z.string(), query: z.string(), branch: z.string().optional() },
      async (args) => { const r = await executeTool("search_code", args, ctx); return { content: [{ type: "text" as const, text: r }] }; }),
    tool("read_file", "Read a file from a cloned repo. Use repo='self' for Builder Command's own code.", { repo: z.string(), path: z.string(), branch: z.string().optional() },
      async (args) => { const r = await executeTool("read_file", args, ctx); return { content: [{ type: "text" as const, text: r }] }; }),
    tool("list_files", "List files in a directory of a cloned repository.", { repo: z.string(), directory: z.string().optional(), branch: z.string().optional() },
      async (args) => { const r = await executeTool("list_files", args, ctx); return { content: [{ type: "text" as const, text: r }] }; }),
    tool("clone_repo", "Clone or update a GitHub repository for code exploration.", { repo: z.string() },
      async (args) => { const r = await executeTool("clone_repo", args, ctx); return { content: [{ type: "text" as const, text: r }] }; }),
    tool("web_fetch", "Fetch a web page and return its text content.", { url: z.string(), method: z.enum(["GET", "POST"]).optional(), headers: z.record(z.string()).optional(), body: z.string().optional() },
      async (args) => { const r = await executeTool("web_fetch", args, ctx); return { content: [{ type: "text" as const, text: r }] }; }),
    tool("api_fetch", "Make authenticated API calls to Linear or GitHub. Auth headers added automatically. Linear: POST https://api.linear.app/graphql. GitHub REST: GET/POST https://api.github.com/repos/{owner}/{repo}/pulls/{number}/files etc.", { url: z.string(), method: z.enum(["GET", "POST"]).optional(), body: z.string().optional(), accept: z.string().optional() },
      async (args) => { const r = await executeTool("api_fetch", args, ctx); return { content: [{ type: "text" as const, text: r }] }; }),
    tool("browse_web", "Browse a website using a real browser (Playwright). Renders JavaScript, returns text + screenshot. Actions: navigate (go to URL), click (CSS selector or text), type (into input), screenshot (current page).", { action: z.enum(["navigate", "click", "type", "screenshot"]), url: z.string().optional(), selector: z.string().optional(), text: z.string().optional() },
      async (args) => { const r = await executeTool("browse_web", args, ctx); return { content: [{ type: "text" as const, text: r }] }; }),
    tool("save_memory", "Save a fact or preference to persistent memory.", { content: z.string(), category: z.enum(["user", "team", "workflow", "repo", "general"]).optional() },
      async (args) => { const r = await executeTool("save_memory", args, ctx); return { content: [{ type: "text" as const, text: r }] }; }),
    tool("delete_memory", "Delete a memory that is no longer relevant.", { memory_id: z.string() },
      async (args) => { const r = await executeTool("delete_memory", args, ctx); return { content: [{ type: "text" as const, text: r }] }; }),
    tool("execute_code", "Execute code in a sandboxed subprocess. 30s timeout.", { language: z.enum(["javascript", "python"]), code: z.string() },
      async (args) => { const r = await executeTool("execute_code", args, ctx); return { content: [{ type: "text" as const, text: r }] }; }),
    tool("write_file", "Write content to a file in the agent workspace (data/workspace/).", { path: z.string(), content: z.string() },
      async (args) => { const r = await executeTool("write_file", args, ctx); return { content: [{ type: "text" as const, text: r }] }; }),
    tool("edit_file", "Find and replace text in a file in the agent workspace.", { path: z.string(), find: z.string(), replace: z.string() },
      async (args) => { const r = await executeTool("edit_file", args, ctx); return { content: [{ type: "text" as const, text: r }] }; }),
    tool("schedule_followup", "Schedule yourself to wake up later and continue working. Session ends after this call.", { delay: z.enum(["5m", "10m", "15m", "30m", "1h", "2h", "4h"]), instruction: z.string() },
      async (args) => {
        const r = await executeTool("schedule_followup", args, ctx);
        // Abort the SDK loop after scheduling — session should end gracefully
        abortController.abort();
        return { content: [{ type: "text" as const, text: r }] };
      }),
  ];

  return createSdkMcpServer({ name: "builder-command-tools", tools: sdkTools });
}

// --- Environment ---

function getFixedEnv(): Record<string, string> {
  const nodeDir = dirname(process.execPath);
  const envPath = process.env.PATH || "";
  const fixedPath = envPath.includes(nodeDir) ? envPath : `${nodeDir}:${envPath}`;
  return {
    ...process.env as Record<string, string>,
    PATH: fixedPath,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || "",
  };
}

// --- State ---

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

  return { running: processing, currentTodoId, currentTodoText: currentText, queueLength: queue.count };
}

export function triggerAgent(todoId: string) {
  const db = getDb();
  db.prepare("UPDATE daily_todos SET agent_enabled = 1 WHERE id = ?").run(todoId);

  if (!enabled) startAgentRunner();

  const existingSession = db.prepare(
    `SELECT id, status, sdk_session_id FROM agent_sessions WHERE todo_id = ? ORDER BY created_at DESC LIMIT 1`
  ).get(todoId) as { id: string; status: string; sdk_session_id?: string } | undefined;

  if (existingSession) {
    if (existingSession.status === "running" || existingSession.status === "completed") return;
    if (!processing) {
      continueSession(existingSession.id, "Continue working on this task. Pick up where you left off.").catch(e => {
        console.error("[AgentRunner] Failed to resume session:", e);
      });
    }
    return;
  }

  if (!processing) {
    if (timer) { clearTimeout(timer); timer = null; }
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
      const todo = getNextEligibleTodo();
      if (todo) await processTask(todo);
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
     ORDER BY run_at ASC LIMIT 1`
  ).get() as { id: string; session_id: string; instruction: string } | null;
}

function getNextEligibleTodo(): { id: string; text: string; source?: string; source_id?: string; agent_prompt?: string } | null {
  const db = getDb();
  return db.prepare(
    `SELECT dt.id, dt.text, dt.source, dt.source_id, dt.agent_prompt FROM daily_todos dt
     WHERE dt.done = 0 AND dt.agent_enabled = 1
     AND NOT EXISTS (SELECT 1 FROM agent_sessions s WHERE s.todo_id = dt.id)
     ORDER BY dt.sort_order ASC LIMIT 1`
  ).get() as { id: string; text: string; source?: string; source_id?: string; agent_prompt?: string } | null;
}

function getSourceContext(source?: string, sourceId?: string): string {
  if (!source || !sourceId) return "";
  const db = getDb();

  if (source === "linear") {
    const item = db.prepare("SELECT raw_data FROM items WHERE source = 'linear' AND source_id = ?").get(sourceId) as { raw_data?: string } | undefined;
    if (item?.raw_data) {
      try {
        const raw = JSON.parse(item.raw_data);
        return "\n\n" + [
          `## Source: Linear Issue ${raw.identifier}`,
          `**Title:** ${raw.title}`, `**State:** ${raw.state}`,
          `**Priority:** ${["None", "Urgent", "High", "Medium", "Low"][raw.priority ?? 0]}`,
          raw.assignee ? `**Assignee:** ${raw.assignee}` : null,
          raw.labels?.length ? `**Labels:** ${raw.labels.join(", ")}` : null,
          raw.description ? `**Description:**\n${raw.description}` : null,
          raw.url ? `**URL:** ${raw.url}` : null,
        ].filter(Boolean).join("\n");
      } catch { /* ignore */ }
    }
  }

  if (source === "github") {
    const item = db.prepare("SELECT raw_data FROM items WHERE source = 'github' AND source_id = ?").get(sourceId) as { raw_data?: string } | undefined;
    if (item?.raw_data) {
      try {
        const raw = JSON.parse(item.raw_data);
        return "\n\n" + [
          `## Source: GitHub PR #${raw.id} (${raw.repo})`,
          `**Title:** ${raw.title}`,
          `**State:** ${raw.draft ? "Draft" : raw.mergeableState ?? "open"}`,
          raw.body ? `**Description:**\n${raw.body.slice(0, 2000)}` : null,
          raw.url ? `**URL:** ${raw.url}` : null,
        ].filter(Boolean).join("\n");
      } catch { /* ignore */ }
    }
  }

  return "";
}

// --- Build the agent prompt appended to Claude Code's default system prompt ---

function buildAgentContext(): string {
  const db = getDb();
  const { getProfile } = require("@/lib/items");
  const profile = getProfile();

  // Agent memories
  const memories = db.prepare("SELECT id, content, category FROM agent_memories ORDER BY category, created_at").all() as { id: string; content: string; category: string }[];
  let memorySection = "No memories saved yet.";
  if (memories.length > 0) {
    const byCategory = new Map<string, { id: string; content: string }[]>();
    for (const m of memories) {
      if (!byCategory.has(m.category)) byCategory.set(m.category, []);
      byCategory.get(m.category)!.push(m);
    }
    memorySection = Array.from(byCategory.entries()).map(([cat, mems]) =>
      `### ${cat}\n${mems.map(m => `- [${m.id}] ${m.content}`).join("\n")}`
    ).join("\n");
  }

  // User instructions
  const userInstructions = getSetting("agent_prompt") || "No custom instructions set.";

  return `## Profile
- GitHub: ${profile?.github_username ?? "not set"}
- Linear: ${profile?.linear_email ?? "not set"}

## Agent Memory
${memorySection}

## User Instructions
${userInstructions}`;
}

function buildAgentAppendPrompt(taskText: string, opts: {
  sourceContext: string;
  agentPrompt?: string;
  isFollowUp?: boolean;
}): string {
  const agentContext = buildAgentContext();
  const mode = opts.isFollowUp ? "AGENT MODE (Follow-up)" : "AGENT MODE";
  const modeDesc = opts.isFollowUp
    ? "You are continuing work on a previously assigned task."
    : "You've been assigned a specific task to complete.";

  return `## Role
You are an executive assistant for a software engineering leader. Your job is admin work, research, troubleshooting, and operational tasks — NOT coding. Typical tasks include: reviewing and triaging PRs, looking up information via APIs, investigating issues, summarizing findings, managing Linear tickets, replying on Slack, and coordinating work.

You have access to GitHub and Linear APIs (via api_fetch), web browsing, code search (read-only), and integrations with Slack, GitHub, and Linear. Use these tools proactively to gather information and take action.

${agentContext}

## ${mode}
${modeDesc}
${opts.sourceContext}

YOUR TOOLS are provided via MCP server "bc-tools". They are prefixed with mcp__bc-tools__ but you can call them directly. Available tools: dismiss_item, snooze_item, merge_pr, enable_auto_merge, add_reviewer, update_linear_status, assign_linear_issue, reply_slack, react_slack, create_todo, complete_todo, search_code, read_file, list_files, clone_repo, web_fetch, api_fetch, browse_web, save_memory, delete_memory, execute_code, write_file, edit_file, schedule_followup.

RULES:
1. Write a 1-sentence PLAN, then execute using tools
2. Be CONCISE and DENSE — no filler, no fluff, no verbose explanations
3. End with a **SUMMARY:** section — bullet points preferred, keep it tight
4. If you CANNOT complete the task, state WHY in one sentence
5. Be efficient — minimum tool calls needed
6. NEVER use the complete_todo tool. The user will review your work and decide when to mark it done.
7. For tasks that require WAITING (CI checks, deployments, external responses), use schedule_followup to pause and resume later.

TASK: "${taskText}"${opts.agentPrompt ? `\n\nTASK-SPECIFIC INSTRUCTIONS FROM USER:\n${opts.agentPrompt}` : ""}`;
}

// --- SDK query runner ---

async function runSDKQuery(opts: {
  sessionId: string;
  prompt: string;
  appendPrompt: string;
  resumeSdkSessionId?: string;
}): Promise<{ sdkSessionId: string; resultText: string; toolCallsLog: ToolCallLog[]; collectedMessages: unknown[]; status: "completed" | "waiting" | "incomplete"; errorMsg?: string }> {
  const abortController = new AbortController();
  const mcpServer = buildMcpServer(opts.sessionId, abortController);

  const toolCallsLog: ToolCallLog[] = [];
  // Collect messages in Anthropic MessageParam format for UI compatibility
  const collectedMessages: { role: "user" | "assistant"; content: unknown }[] = [];
  let resultText = "";
  let sdkSessionId = opts.resumeSdkSessionId || "";
  let status: "completed" | "waiting" | "incomplete" = "completed";

  const db = getDb();

  try {
    for await (const message of query({
      prompt: opts.prompt,
      options: {
        model: "claude-opus-4-20250514",
        maxTurns: getMaxRounds(),
        systemPrompt: {
          type: "preset",
          preset: "claude_code",
          append: opts.appendPrompt,
        },
        mcpServers: { "bc-tools": mcpServer },
        disallowedTools: ["Bash", "Read", "Edit", "Write", "Glob", "Grep", "Agent", "NotebookEdit"],  // Only our MCP tools
        permissionMode: "bypassPermissions",
        allowDangerouslySkipPermissions: true,
        env: getFixedEnv(),
        abortController,
        ...(opts.resumeSdkSessionId ? { resume: opts.resumeSdkSessionId } : {}),
      },
    })) {
      // Capture session ID from first message
      if (message.session_id && !sdkSessionId) {
        sdkSessionId = message.session_id;
        db.prepare("UPDATE agent_sessions SET sdk_session_id = ? WHERE id = ?").run(sdkSessionId, opts.sessionId);
      }

      // Collect assistant messages for UI
      if (message.type === "assistant" && message.message?.content) {
        collectedMessages.push({ role: "assistant", content: message.message.content });
        for (const block of message.message.content) {
          if (block.type === "text") {
            resultText += block.text;
          }
          if (block.type === "tool_use") {
            console.log(`[AgentRunner] Tool call: ${block.name}`);
            toolCallsLog.push({
              tool: block.name,
              input: block.input,
              result: "(pending)",
              timestamp: new Date().toISOString(),
            });
          }
        }
      }

      // Collect user messages (including tool results) for UI
      if (message.type === "user" && message.message) {
        // Only collect non-synthetic user messages or tool results
        if (!message.isSynthetic || message.parent_tool_use_id) {
          collectedMessages.push({ role: "user", content: message.message.content });
        }

        // Update tool call results
        if (message.tool_use_result) {
          const toolResult = message.tool_use_result as { name?: string; input?: unknown; result?: string };
          // Update the last matching pending tool call
          for (let i = toolCallsLog.length - 1; i >= 0; i--) {
            if (toolCallsLog[i].result === "(pending)" && (!toolResult.name || toolCallsLog[i].tool === toolResult.name)) {
              toolCallsLog[i].result = typeof toolResult.result === "string"
                ? (toolResult.result.length > 500 ? toolResult.result.slice(0, 500) + "..." : toolResult.result)
                : JSON.stringify(toolResult.result ?? "").slice(0, 500);
              break;
            }
          }
        }

        // Update in-progress data for live UI
        db.prepare("UPDATE agent_sessions SET tool_calls = ?, messages = ? WHERE id = ?")
          .run(JSON.stringify(toolCallsLog), JSON.stringify(collectedMessages), opts.sessionId);
        notifyChange();
      }

      // Handle result message
      if (message.type === "result") {
        if (message.subtype === "error_max_turns") {
          status = "incomplete";
        } else if (message.subtype !== "success") {
          status = "incomplete";
        }
      }
    }
  } catch (e) {
    // AbortError is expected when schedule_followup triggers abort
    const isAbort = e instanceof Error && (e.name === "AbortError" || e.message.includes("aborted"));
    if (isAbort) {
      status = "waiting";
    } else {
      throw e;
    }
  }

  return { sdkSessionId, resultText, toolCallsLog, collectedMessages, status };
}

type ToolCallLog = { tool: string; input: unknown; result: string; timestamp: string };

// --- Process a new task ---

async function processTask(todo: { id: string; text: string; source?: string; source_id?: string; agent_prompt?: string }) {
  processing = true;
  currentTodoId = todo.id;
  const sessionId = randomUUID();
  const db = getDb();

  console.log(`[AgentRunner] Processing task: "${todo.text}" (${todo.id})`);

  db.prepare(
    `INSERT INTO agent_sessions (id, todo_id, status, started_at) VALUES (?, ?, 'running', datetime('now'))`
  ).run(sessionId, todo.id);
  notifyChange();

  const sourceContext = getSourceContext(todo.source, todo.source_id);
  const appendPrompt = buildAgentAppendPrompt(todo.text, {
    sourceContext,
    agentPrompt: todo.agent_prompt,
  });

  try {
    const result = await runSDKQuery({
      sessionId,
      prompt: `Work on this task: ${todo.text}`,
      appendPrompt,
    });

    const summary = extractSummary(result.resultText);

    db.prepare(
      `UPDATE agent_sessions SET status = ?, summary = ?, tool_calls = ?, messages = ?, sdk_session_id = ?, completed_at = datetime('now') WHERE id = ?`
    ).run(
      result.status,
      summary || (result.status === "incomplete" ? "Agent ran out of turns. You can continue the session." : null),
      JSON.stringify(result.toolCallsLog),
      JSON.stringify(result.collectedMessages),
      result.sdkSessionId,
      sessionId
    );

    console.log(`[AgentRunner] Task ${result.status}: "${todo.text}"`);
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    console.error(`[AgentRunner] Task failed: "${todo.text}" - ${errorMsg}`);
    db.prepare(
      `UPDATE agent_sessions SET status = 'failed', failure_reason = ?, completed_at = datetime('now') WHERE id = ?`
    ).run(errorMsg, sessionId);
  }

  processing = false;
  currentTodoId = null;
  notifyChange();
}

// --- Continue an existing session ---

export async function continueSession(sessionId: string, followUpText: string): Promise<string> {
  const db = getDb();
  const session = db.prepare("SELECT * FROM agent_sessions WHERE id = ?").get(sessionId) as {
    id: string; todo_id: string; status: string; sdk_session_id?: string; tool_calls?: string; messages?: string;
  } | undefined;

  if (!session) throw new Error("Session not found");
  if (session.status === "running") throw new Error("Session is already running");

  const todo = db.prepare("SELECT text, agent_prompt FROM daily_todos WHERE id = ?").get(session.todo_id) as { text: string; agent_prompt: string | null } | undefined;
  const taskText = todo?.text ?? "task";

  db.prepare(
    "UPDATE agent_sessions SET status = 'running', summary = NULL, failure_reason = NULL, completed_at = NULL WHERE id = ?"
  ).run(sessionId);
  notifyChange();

  processing = true;
  currentTodoId = session.todo_id;

  const sourceContext = getSourceContext(
    // Resolve source from todo
    ...((): [string?, string?] => {
      const t = db.prepare("SELECT source, source_id FROM daily_todos WHERE id = ?").get(session.todo_id) as { source?: string; source_id?: string } | undefined;
      return [t?.source, t?.source_id];
    })()
  );

  const appendPrompt = buildAgentAppendPrompt(taskText, {
    sourceContext,
    agentPrompt: todo?.agent_prompt ?? undefined,
    isFollowUp: true,
  });

  try {
    const result = await runSDKQuery({
      sessionId,
      prompt: followUpText,
      appendPrompt,
      resumeSdkSessionId: session.sdk_session_id || undefined,
    });

    // Merge tool calls and messages from previous session
    let existingToolCalls: ToolCallLog[] = [];
    if (session.tool_calls) {
      try { existingToolCalls = JSON.parse(session.tool_calls); } catch { /* start fresh */ }
    }
    const allToolCalls = [...existingToolCalls, ...result.toolCallsLog];

    let existingMessages: unknown[] = [];
    if (session.messages) {
      try { existingMessages = JSON.parse(session.messages); } catch { /* start fresh */ }
    }
    const allMessages = [...existingMessages, ...result.collectedMessages];

    const summary = extractSummary(result.resultText);

    db.prepare(
      `UPDATE agent_sessions SET status = ?, summary = ?, tool_calls = ?, messages = ?, sdk_session_id = ?, completed_at = datetime('now') WHERE id = ?`
    ).run(
      result.status,
      summary || (result.status === "incomplete" ? "Agent ran out of turns. You can continue the session." : null),
      JSON.stringify(allToolCalls),
      JSON.stringify(allMessages),
      result.sdkSessionId,
      sessionId
    );

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
  const summaryMatch = text.match(/\*{0,2}SUMMARY[:\s*]*\*{0,2}\s*([\s\S]+?)$/i);
  if (summaryMatch) return summaryMatch[1].trim().slice(0, 2000);
  const paragraphs = text.split("\n\n").filter(p => p.trim());
  if (paragraphs.length > 0) return paragraphs[paragraphs.length - 1].trim().slice(0, 2000);
  return text.trim().slice(0, 2000);
}

function recoverStaleSessions() {
  const db = getDb();
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

  const staleFollowups = db.prepare(
    "UPDATE scheduled_followups SET status = 'pending' WHERE status = 'running'"
  ).run();
  if (staleFollowups.changes > 0) {
    console.log(`[AgentRunner] Reset ${staleFollowups.changes} stale followup(s) to pending`);
  }
}
