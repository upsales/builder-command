#!/usr/bin/env node
/**
 * Standalone MCP stdio server for Builder Command agent tools.
 * Spawned as a separate process by the SDK — avoids Next.js bundling issues.
 * Communicates with the parent process via a simple HTTP callback for tool execution.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const CALLBACK_URL = process.env.BC_TOOL_CALLBACK_URL;
if (!CALLBACK_URL) {
  console.error("BC_TOOL_CALLBACK_URL not set");
  process.exit(1);
}

async function callTool(name: string, args: Record<string, unknown>): Promise<string> {
  const res = await fetch(CALLBACK_URL!, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, args }),
  });
  return res.text();
}

const server = new McpServer({ name: "bc-tools", version: "1.0.0" });

// Register all tools
server.tool("dismiss_item", "Dismiss/clear an item from the user's queue.", { source: z.enum(["linear", "github", "slack", "calendar"]), source_id: z.string() },
  async (args) => ({ content: [{ type: "text", text: await callTool("dismiss_item", args) }] }));

server.tool("snooze_item", "Snooze an item so it reappears later.", { source: z.enum(["linear", "github", "slack", "calendar"]), source_id: z.string(), duration: z.enum(["1h", "2h", "4h", "tomorrow", "next_week"]) },
  async (args) => ({ content: [{ type: "text", text: await callTool("snooze_item", args) }] }));

server.tool("merge_pr", "Merge a GitHub pull request.", { repo: z.string(), pr_number: z.number() },
  async (args) => ({ content: [{ type: "text", text: await callTool("merge_pr", args) }] }));

server.tool("enable_auto_merge", "Enable auto-merge on a PR so it merges when checks pass.", { repo: z.string(), pr_number: z.number() },
  async (args) => ({ content: [{ type: "text", text: await callTool("enable_auto_merge", args) }] }));

server.tool("add_reviewer", "Request a review from someone on a GitHub PR.", { repo: z.string(), pr_number: z.number(), reviewer: z.string() },
  async (args) => ({ content: [{ type: "text", text: await callTool("add_reviewer", args) }] }));

server.tool("update_linear_status", "Change the status of a Linear issue.", { issue_id: z.string(), state_id: z.string() },
  async (args) => ({ content: [{ type: "text", text: await callTool("update_linear_status", args) }] }));

server.tool("assign_linear_issue", "Assign a Linear issue to someone.", { issue_id: z.string(), assignee_id: z.string().optional() },
  async (args) => ({ content: [{ type: "text", text: await callTool("assign_linear_issue", args) }] }));

server.tool("reply_slack", "Send a reply in a Slack thread.", { channel: z.string(), text: z.string(), thread_ts: z.string() },
  async (args) => ({ content: [{ type: "text", text: await callTool("reply_slack", args) }] }));

server.tool("react_slack", "Add an emoji reaction to a Slack message.", { channel: z.string(), timestamp: z.string(), reaction: z.string() },
  async (args) => ({ content: [{ type: "text", text: await callTool("react_slack", args) }] }));

server.tool("create_todo", "Create a new todo item for the user.", { text: z.string(), persistent: z.boolean().optional() },
  async (args) => ({ content: [{ type: "text", text: await callTool("create_todo", args) }] }));

server.tool("complete_todo", "Mark a todo item as done.", { todo_id: z.string() },
  async (args) => ({ content: [{ type: "text", text: await callTool("complete_todo", args) }] }));

server.tool("search_code", "Search for code patterns in a GitHub repository.", { repo: z.string(), query: z.string(), branch: z.string().optional() },
  async (args) => ({ content: [{ type: "text", text: await callTool("search_code", args) }] }));

server.tool("read_file", "Read a file from a cloned repo. Use repo='self' for Builder Command's own code.", { repo: z.string(), path: z.string(), branch: z.string().optional() },
  async (args) => ({ content: [{ type: "text", text: await callTool("read_file", args) }] }));

server.tool("list_files", "List files in a directory of a cloned repository.", { repo: z.string(), directory: z.string().optional(), branch: z.string().optional() },
  async (args) => ({ content: [{ type: "text", text: await callTool("list_files", args) }] }));

server.tool("clone_repo", "Clone or update a GitHub repository for code exploration.", { repo: z.string() },
  async (args) => ({ content: [{ type: "text", text: await callTool("clone_repo", args) }] }));

server.tool("web_fetch", "Fetch a web page and return its text content.", { url: z.string(), method: z.enum(["GET", "POST"]).optional(), body: z.string().optional() },
  async (args) => ({ content: [{ type: "text", text: await callTool("web_fetch", args) }] }));

server.tool("api_fetch", "Make authenticated API calls to Linear or GitHub. Auth headers added automatically. Linear: POST https://api.linear.app/graphql. GitHub REST: GET/POST https://api.github.com/repos/{owner}/{repo}/pulls/{number}/files etc.", { url: z.string(), method: z.enum(["GET", "POST"]).optional(), body: z.string().optional(), accept: z.string().optional() },
  async (args) => ({ content: [{ type: "text", text: await callTool("api_fetch", args) }] }));

server.tool("browse_web", "Browse a website using a real browser (Playwright). Renders JavaScript, returns text + screenshot.", { action: z.enum(["navigate", "click", "type", "screenshot"]), url: z.string().optional(), selector: z.string().optional(), text: z.string().optional() },
  async (args) => ({ content: [{ type: "text", text: await callTool("browse_web", args) }] }));

server.tool("save_memory", "Save a fact or preference to persistent memory.", { content: z.string(), category: z.enum(["user", "team", "workflow", "repo", "general"]).optional() },
  async (args) => ({ content: [{ type: "text", text: await callTool("save_memory", args) }] }));

server.tool("delete_memory", "Delete a memory that is no longer relevant.", { memory_id: z.string() },
  async (args) => ({ content: [{ type: "text", text: await callTool("delete_memory", args) }] }));

server.tool("execute_code", "Execute code in a sandboxed subprocess. 30s timeout.", { language: z.enum(["javascript", "python"]), code: z.string() },
  async (args) => ({ content: [{ type: "text", text: await callTool("execute_code", args) }] }));

server.tool("write_file", "Write content to a file in the agent workspace (data/workspace/).", { path: z.string(), content: z.string() },
  async (args) => ({ content: [{ type: "text", text: await callTool("write_file", args) }] }));

server.tool("edit_file", "Find and replace text in a file in the agent workspace.", { path: z.string(), find: z.string(), replace: z.string() },
  async (args) => ({ content: [{ type: "text", text: await callTool("edit_file", args) }] }));

server.tool("schedule_followup", "Schedule yourself to wake up later and continue working. Session ends after this call.", { delay: z.enum(["5m", "10m", "15m", "30m", "1h", "2h", "4h"]), instruction: z.string() },
  async (args) => ({ content: [{ type: "text", text: await callTool("schedule_followup", args) }] }));

// Start the server
const transport = new StdioServerTransport();
await server.connect(transport);
