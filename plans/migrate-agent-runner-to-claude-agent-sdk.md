# feat: Migrate agent runner to Claude Agent SDK for session continuity

## Overview

Replace the manual Messages API tool loop in `src/lib/agentRunner.ts` with the Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`). This gives us real session continuity — follow-ups resume where they left off instead of replaying the entire conversation, eliminating growing token costs and latency.

## Problem Statement / Motivation

The current agent runner:
1. **Replays full message history on every follow-up** — token costs grow linearly with conversation length
2. **Manually implements the tool loop** — reimplements what the SDK does natively (tool dispatch, error handling, context management)
3. **No session continuity** — each API call is stateless, losing Claude's internal reasoning state
4. **Fragile context injection** — system prompt rebuilt from scratch each time, injected as a monolithic string

The Claude Agent SDK solves all of these by managing sessions as persistent subprocess state with built-in tool execution and native session resume via `query({ resume: sessionId })`.

## Proposed Solution

Use `@anthropic-ai/claude-agent-sdk`'s `query()` function to replace the manual while-loop. Capture the SDK session ID, store it in the DB, and use `resume` for follow-ups. Register custom tools using the SDK's `tool()` helper. Fall back to message-replay if SDK session files are missing.

## Technical Approach

### Architecture

```
Current:
  API Route → agentRunner.processTask() → while loop → client.messages.create() → executeTool()
                                                    ↕ (full message history in SQLite)

Proposed:
  API Route → agentRunner.processTask() → query({ prompt, options }) → SDK subprocess
                                              ↕ stream events → SQLite (for UI)
              agentRunner.continueSession() → query({ prompt, resume: sdkSessionId })
```

### Key Design Decisions

1. **Add `sdk_session_id` column** (not replace `id`) — existing sessions stay readable, new sessions get SDK resume capability
2. **Continue writing `messages` column** — consume SDK stream events and write them in the existing `Anthropic.MessageParam[]` format for UI compatibility. This also serves as fallback if SDK session files are lost.
3. **Register custom tools via SDK `tool()` helper** — Zod schemas, handlers return `CallToolResult`. No external MCP server needed.
4. **Disable SDK built-in tools** — only expose our custom tools to prevent sandbox escape (no built-in `Bash`, `Read`, `Edit`)
5. **System prompt via `--append-system-prompt`** or written to a session-specific temp CLAUDE.md — inject live context (calendar, Linear, Slack, todos, memories)
6. **AbortController for `schedule_followup`** — tool handler calls `abort()` to stop the SDK loop gracefully

---

## Implementation Phases

### Phase 1: Foundation — SDK Integration & DB Migration

**Goal:** Get a basic SDK-powered agent running with one tool, session resume working.

**Files:**
- `src/lib/db.ts` — Add `sdk_session_id TEXT` column to `agent_sessions`
- `src/lib/agentRunner.ts` — New `processTaskSDK()` function alongside existing code
- `package.json` — Add `@anthropic-ai/claude-agent-sdk` dependency

**Tasks:**
- [ ] `npm install @anthropic-ai/claude-agent-sdk`
- [ ] Add migration in `src/lib/db.ts`: `ALTER TABLE agent_sessions ADD COLUMN sdk_session_id TEXT`
- [ ] Create `processTaskSDK()` that calls `query()` with a simple prompt
- [ ] Capture `session_id` from SDK result message, store in `sdk_session_id` column
- [ ] Create `continueSessionSDK()` that uses `query({ resume: sdkSessionId })`
- [ ] Verify session resume works: first query → follow-up → Claude remembers context
- [ ] Add fallback: if `resume` fails (file missing), log warning and fall back to message-replay via existing `continueSession()`
- [ ] Pass `ANTHROPIC_API_KEY` via `env` option to SDK subprocess

**Success criteria:** Agent can run a simple task and resume it without replaying messages.

---

### Phase 2: Custom Tool Migration

**Goal:** Convert all 25+ tools from `chatTools.ts` to SDK-compatible format.

**Files:**
- `src/lib/agentTools.ts` (new) — SDK tool definitions using `tool()` helper with Zod schemas
- `src/lib/chatTools.ts` — Keep existing `executeTool()` as the shared implementation layer
- `src/lib/agentRunner.ts` — Wire up SDK tools

**Tasks:**
- [ ] Create `src/lib/agentTools.ts` with a `buildAgentTools(context)` function
- [ ] The `context` parameter carries `sessionId`, `AbortController`, and DB reference
- [ ] Each tool wraps the existing `executeTool()` switch cases — Zod schema → call `executeTool()` → return `CallToolResult`
- [ ] Convert tool input schemas from raw JSON Schema to Zod (e.g., `z.object({ source: z.string(), source_id: z.string() })`)
- [ ] Handle `schedule_followup` specially: after inserting the row, call `abortController.abort()` to stop the SDK loop
- [ ] Handle `complete_todo` specially: marks task done, then aborts
- [ ] Verify all tools work: dismiss, merge PR, reply Slack, browse web, execute code, save memory, search code, etc.
- [ ] Disable SDK built-in tools: pass only custom tools, no `allowedTools` for built-ins

**Tool inventory to convert:**

| Tool | Complexity | Notes |
|------|-----------|-------|
| `dismiss_item` | Low | Simple DB write |
| `snooze_item` | Low | Simple DB write |
| `update_linear_status` | Low | API call + local patch |
| `assign_linear_issue` | Low | API call + local patch |
| `reply_slack` | Low | API call |
| `react_slack` | Low | API call |
| `complete_todo` | Medium | DB write + abort signal |
| `schedule_followup` | Medium | DB write + abort signal |
| `merge_pr` | Low | API call + dismiss |
| `enable_auto_merge` | Low | API call |
| `add_reviewer` | Low | API call |
| `search_code` | Low | Calls searchRepo |
| `read_file` | Low | Reads from repo cache |
| `list_files` | Low | Lists from repo cache |
| `browse_web` | Medium | Playwright, returns text |
| `click_element` | Low | Playwright action |
| `type_text` | Low | Playwright action |
| `take_screenshot` | Medium | Playwright, returns image? |
| `execute_code` | Medium | Sandboxed exec, timeout |
| `save_memory` | Low | DB write |
| `delete_memory` | Low | DB delete |
| `create_todo` | Low | DB write |
| `web_search` | Low | API call |
| `web_fetch` | Low | HTTP fetch |

**Success criteria:** All existing tools work through the SDK. Agent can complete a multi-tool task.

---

### Phase 3: System Prompt & Context Injection

**Goal:** Inject dynamic context (calendar, Linear, Slack, todos, memories) into SDK sessions.

**Files:**
- `src/lib/agentRunner.ts` — Context injection before each `query()`
- `src/lib/chatTools.ts` — Reuse `buildSystemPrompt()` output

**Tasks:**
- [ ] Before each `query()`, call `buildSystemPrompt()` to get the full context string
- [ ] Pass context via the SDK's `systemPrompt` option or `--append-system-prompt` CLI flag
- [ ] Include `agent_prompt` (task-specific instructions) in the prompt
- [ ] Include `agent_max_rounds` as `maxTurns` option
- [ ] Verify context is visible to the agent: ask it "what Linear issues do I have?" and confirm it sees them
- [ ] On resume, rebuild and re-inject context (it may have changed since last run)

**Success criteria:** Agent sees live work-item context in every session, including resumed ones.

---

### Phase 4: UI Compatibility — Message Streaming & Display

**Goal:** Keep the session viewer working with real-time updates during SDK execution.

**Files:**
- `src/lib/agentRunner.ts` — Consume SDK stream, write to DB
- `src/app/page.tsx` — Minimal changes (existing message parser should work if format is preserved)

**Tasks:**
- [ ] In the SDK `query()` async iterable loop, capture messages as they arrive
- [ ] Convert SDK message types (`SDKAssistantMessage`, `SDKToolUseMessage`, `SDKToolResultMessage`) to the existing `Anthropic.MessageParam[]` format
- [ ] Write converted messages to `agent_sessions.messages` column after each turn
- [ ] Write tool calls to `agent_sessions.tool_calls` column in existing format
- [ ] Call `notifyChange()` after each write to trigger UI polling
- [ ] Verify the session viewer renders correctly: user messages, assistant responses, tool calls, tool results
- [ ] Verify the `AgentSessionInline` component shows real-time progress (not just final result)

**Success criteria:** UI shows live session progress identical to current behavior.

---

### Phase 5: Cleanup & Cutover

**Goal:** Remove the old manual tool loop, clean up dual code paths.

**Files:**
- `src/lib/agentRunner.ts` — Remove old `processTask()` and `continueSession()`
- `src/lib/chatTools.ts` — Remove SDK-incompatible code paths if any

**Tasks:**
- [ ] Remove old `processTask()` function (replaced by `processTaskSDK()`)
- [ ] Remove old `continueSession()` function (replaced by `continueSessionSDK()`)
- [ ] Rename SDK functions to drop the `SDK` suffix
- [ ] Remove `import Anthropic from '@anthropic-ai/sdk'` from agentRunner if no longer needed
- [ ] Keep `@anthropic-ai/sdk` in package.json — still used by chat route and chatTools types
- [ ] Update `recoverStaleSessions()` to handle SDK session recovery
- [ ] Test full flow: create task → agent runs → follow-up → scheduled followup → completion
- [ ] Test edge cases: server restart mid-session, missing SDK session file, concurrent triggers

**Success criteria:** No dual code paths. All agent functionality works through the SDK.

---

## Risk Analysis & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| SDK session files deleted/missing | Follow-ups fail | Fall back to message-replay from `messages` column |
| SDK subprocess survives Next.js hot reload | Orphaned processes, concurrency bugs | Track PID, kill on module teardown |
| SDK doesn't support `systemPrompt` directly | Context injection fails | Use `--append-system-prompt` CLI flag or embed in prompt |
| Turn budget warning lost | Agent stops abruptly at maxTurns | Accept graceful degradation; rely on model's own judgment |
| Tool handler `abort()` race condition | Extra tool calls after schedule_followup | Accept: at most one extra turn before abort takes effect |
| Two agents running simultaneously | Conflicting writes | Keep `processing` boolean; SDK subprocess is awaited |

## Dependencies

- `@anthropic-ai/claude-agent-sdk` npm package
- `claude` CLI must be installed on the machine (the SDK spawns it as a subprocess)
- `zod` for tool input schemas (already a transitive dependency via other packages)

## Future Considerations

- **Prompt caching** — even with SDK resume, the system prompt is re-processed. Could add `cache_control` breakpoints for the context portion.
- **Extended thinking** — SDK supports `effort` levels; could expose as a setting for complex tasks.
- **Subagents** — SDK supports `Agent` tool for spawning specialized subagents; could replace the monolithic tool set with focused agents.
- **MCP server for tools** — if tool count grows further, extract to a proper MCP server for better separation.

## References

### Internal
- `src/lib/agentRunner.ts` — Current agent loop implementation
- `src/lib/chatTools.ts` — Tool definitions and executor
- `src/lib/db.ts:114-127` — agent_sessions schema
- `src/app/page.tsx:896-950` — Session viewer UI
- `~/clanker-town/packages/session-worker/src/worker.ts` — Reference implementation with SDK

### External
- [Claude Agent SDK Overview](https://platform.claude.com/docs/en/agent-sdk/overview)
- [Agent SDK Sessions](https://platform.claude.com/docs/en/agent-sdk/sessions)
- [Agent SDK TypeScript Reference](https://platform.claude.com/docs/en/agent-sdk/typescript)
- [Agent SDK Hooks](https://platform.claude.com/docs/en/agent-sdk/hooks)
- [@anthropic-ai/claude-agent-sdk npm](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk)
- [Claude Code CLI Reference](https://code.claude.com/docs/en/cli-reference)
