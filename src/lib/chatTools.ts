import Anthropic from "@anthropic-ai/sdk";
import { getItems, getProfile, dismissItem, snoozeItem, upsertItem } from "@/lib/items";
import { getDb } from "@/lib/db";
import { mergePR, enableAutoMerge, addReviewer } from "@/lib/integrations/github";
import { updateIssueState, updateIssueAssignee, fetchSingleIssue } from "@/lib/integrations/linear";
import { notifyChange } from "@/lib/changeNotifier";
import { sendReply, addReaction } from "@/lib/integrations/slack";
import { searchRepo, readRepoFile, listRepoFiles, ensureRepo } from "@/lib/repo-cache";
import { browse, click, type as browserType, screenshot } from "@/lib/browser";
import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join, resolve, relative } from "path";
import { execSync, execFile } from "child_process";

const SELF_REPO_PATH = process.cwd();

export const tools: Anthropic.Tool[] = [
  {
    name: "dismiss_item",
    description: "Dismiss/clear an item from the user's queue. Use when they say to clear, dismiss, or remove something.",
    input_schema: {
      type: "object" as const,
      properties: {
        source: { type: "string", enum: ["linear", "github", "slack", "calendar"], description: "Item source" },
        source_id: { type: "string", description: "The source_id of the item" },
      },
      required: ["source", "source_id"],
    },
  },
  {
    name: "snooze_item",
    description: "Snooze an item so it disappears and comes back later. Use when the user wants to defer something.",
    input_schema: {
      type: "object" as const,
      properties: {
        source: { type: "string", enum: ["linear", "github", "slack", "calendar"] },
        source_id: { type: "string", description: "The source_id of the item" },
        duration: { type: "string", enum: ["1h", "2h", "4h", "tomorrow", "next_week"], description: "How long to snooze" },
      },
      required: ["source", "source_id", "duration"],
    },
  },
  {
    name: "merge_pr",
    description: "Merge a GitHub pull request.",
    input_schema: {
      type: "object" as const,
      properties: {
        repo: { type: "string", description: "Repository in owner/name format" },
        pr_number: { type: "number", description: "PR number" },
      },
      required: ["repo", "pr_number"],
    },
  },
  {
    name: "enable_auto_merge",
    description: "Enable auto-merge on a PR so it merges when checks pass.",
    input_schema: {
      type: "object" as const,
      properties: {
        repo: { type: "string", description: "Repository in owner/name format" },
        pr_number: { type: "number", description: "PR number" },
      },
      required: ["repo", "pr_number"],
    },
  },
  {
    name: "add_reviewer",
    description: "Request a review from someone on a GitHub PR.",
    input_schema: {
      type: "object" as const,
      properties: {
        repo: { type: "string", description: "Repository in owner/name format" },
        pr_number: { type: "number", description: "PR number" },
        reviewer: { type: "string", description: "GitHub username of the reviewer" },
      },
      required: ["repo", "pr_number", "reviewer"],
    },
  },
  {
    name: "update_linear_status",
    description: "Change the status of a Linear issue.",
    input_schema: {
      type: "object" as const,
      properties: {
        issue_id: { type: "string", description: "Linear issue ID (UUID)" },
        state_id: { type: "string", description: "Linear state ID to set" },
      },
      required: ["issue_id", "state_id"],
    },
  },
  {
    name: "assign_linear_issue",
    description: "Assign a Linear issue to someone.",
    input_schema: {
      type: "object" as const,
      properties: {
        issue_id: { type: "string", description: "Linear issue ID (UUID)" },
        assignee_id: { type: "string", description: "Linear user ID to assign, or null to unassign" },
      },
      required: ["issue_id"],
    },
  },
  {
    name: "reply_slack",
    description: "Send a reply in a Slack thread. Use when the user asks to reply to a Slack message.",
    input_schema: {
      type: "object" as const,
      properties: {
        channel: { type: "string", description: "Slack channel ID" },
        text: { type: "string", description: "Message text to send" },
        thread_ts: { type: "string", description: "Thread timestamp to reply to" },
      },
      required: ["channel", "text", "thread_ts"],
    },
  },
  {
    name: "react_slack",
    description: "Add an emoji reaction to a Slack message.",
    input_schema: {
      type: "object" as const,
      properties: {
        channel: { type: "string", description: "Slack channel ID" },
        timestamp: { type: "string", description: "Message timestamp" },
        reaction: { type: "string", description: "Emoji name (e.g. 'thumbsup', 'white_check_mark')" },
      },
      required: ["channel", "timestamp", "reaction"],
    },
  },
  {
    name: "create_todo",
    description: "Create a new todo item for the user.",
    input_schema: {
      type: "object" as const,
      properties: {
        text: { type: "string", description: "Todo text" },
        persistent: { type: "boolean", description: "If true, the todo persists across days. If false, it's for today only." },
      },
      required: ["text"],
    },
  },
  {
    name: "complete_todo",
    description: "Mark a todo item as done.",
    input_schema: {
      type: "object" as const,
      properties: {
        todo_id: { type: "string", description: "Todo ID" },
      },
      required: ["todo_id"],
    },
  },
  {
    name: "search_code",
    description: "Search for code patterns in a GitHub repository. The repo must have been loaded via code context first, or use clone_repo first.",
    input_schema: {
      type: "object" as const,
      properties: {
        repo: { type: "string", description: "Repository in owner/name format" },
        query: { type: "string", description: "Search pattern (supports regex)" },
        branch: { type: "string", description: "Git ref to search (default: HEAD)" },
      },
      required: ["repo", "query"],
    },
  },
  {
    name: "read_file",
    description: "Read a specific file from a cloned GitHub repository. Use repo='self' to read Builder Command's own source code.",
    input_schema: {
      type: "object" as const,
      properties: {
        repo: { type: "string", description: "Repository in owner/name format, or 'self' for Builder Command codebase" },
        path: { type: "string", description: "File path within the repo" },
        branch: { type: "string", description: "Git ref (default: HEAD)" },
      },
      required: ["repo", "path"],
    },
  },
  {
    name: "list_files",
    description: "List files in a directory of a cloned GitHub repository.",
    input_schema: {
      type: "object" as const,
      properties: {
        repo: { type: "string", description: "Repository in owner/name format" },
        directory: { type: "string", description: "Directory path (empty string for root)" },
        branch: { type: "string", description: "Git ref (default: HEAD)" },
      },
      required: ["repo"],
    },
  },
  {
    name: "clone_repo",
    description: "Clone or update a GitHub repository for code exploration. Must be called before search_code, read_file, or list_files if the repo hasn't been loaded via PR code context.",
    input_schema: {
      type: "object" as const,
      properties: {
        repo: { type: "string", description: "Repository in owner/name format" },
      },
      required: ["repo"],
    },
  },
  {
    name: "web_fetch",
    description: "Fetch a web page and return its text content. Use this to browse websites, verify deployments, check URLs, or gather information from the internet.",
    input_schema: {
      type: "object" as const,
      properties: {
        url: { type: "string", description: "The URL to fetch" },
        method: { type: "string", enum: ["GET", "POST"], description: "HTTP method (default: GET)" },
        headers: { type: "object", description: "Optional request headers as key-value pairs" },
        body: { type: "string", description: "Optional request body (for POST)" },
      },
      required: ["url"],
    },
  },
  {
    name: "api_fetch",
    description: `Make authenticated API calls to Linear or GitHub. Auth headers are added automatically.

Linear API (GraphQL): POST https://api.linear.app/graphql with { "query": "..." }
Example queries:
- Issue by ID: { issue(id: "uuid") { id identifier title description state { name } assignee { name } labels { nodes { name } } attachments { nodes { url title sourceType } } comments { nodes { body user { displayName } createdAt } } } }
- Search issues: { issueSearch(query: "search text", first: 5) { nodes { id identifier title state { name } } } }
- Workflow states: { workflowStates(first: 50) { nodes { id name type } } }
- Teams: { teams { nodes { id name key } } }

GitHub API (REST): GET/POST https://api.github.com/...
Example endpoints:
- PR details: GET /repos/{owner}/{repo}/pulls/{number}
- PR reviews: GET /repos/{owner}/{repo}/pulls/{number}/reviews
- PR files: GET /repos/{owner}/{repo}/pulls/{number}/files
- PR diff: GET /repos/{owner}/{repo}/pulls/{number} (Accept: application/vnd.github.diff)
- Issues: GET /repos/{owner}/{repo}/issues
- Issue comments: GET /repos/{owner}/{repo}/issues/{number}/comments`,
    input_schema: {
      type: "object" as const,
      properties: {
        url: { type: "string", description: "Full API URL (e.g. https://api.linear.app/graphql or https://api.github.com/repos/owner/repo/pulls/1)" },
        method: { type: "string", enum: ["GET", "POST"], description: "HTTP method (default: GET)" },
        body: { type: "string", description: "Request body as JSON string (for POST requests)" },
        accept: { type: "string", description: "Accept header override (e.g. 'application/vnd.github.diff' for PR diffs)" },
      },
      required: ["url"],
    },
  },
  {
    name: "browse_web",
    description: `Browse a website using a real browser (Playwright). Unlike web_fetch, this renders JavaScript and returns the fully-rendered page content plus a screenshot. Use this for SPAs, dashboards, or any site that needs JS to load.

Actions:
- "navigate": Go to a URL, wait for JS to render, return text + screenshot + links
- "click": Click a link/button by CSS selector or visible text
- "type": Type text into an input field
- "screenshot": Take a screenshot of the current page`,
    input_schema: {
      type: "object" as const,
      properties: {
        action: { type: "string", enum: ["navigate", "click", "type", "screenshot"], description: "Browser action to perform" },
        url: { type: "string", description: "URL to navigate to (for 'navigate' action)" },
        selector: { type: "string", description: "CSS selector or visible text to click/type into (for 'click' and 'type' actions)" },
        text: { type: "string", description: "Text to type (for 'type' action)" },
      },
      required: ["action"],
    },
  },
  {
    name: "execute_code",
    description: `Execute code in a sandboxed subprocess and return stdout/stderr. Use this as a general-purpose problem-solving tool — data processing, calculations, text parsing, API prototyping, or anything the other tools don't cover.

Supported languages: javascript (Node.js), python (Python 3).
- 30-second timeout, 1MB output limit
- Code runs in a temporary workspace (data/workspace/)
- Can read/write files in that workspace
- Has access to Node.js/Python standard libraries`,
    input_schema: {
      type: "object" as const,
      properties: {
        language: { type: "string", enum: ["javascript", "python"], description: "Language to execute" },
        code: { type: "string", description: "Code to execute" },
      },
      required: ["language", "code"],
    },
  },
  {
    name: "write_file",
    description: "Write content to a file in the agent workspace (data/workspace/). Use this to save outputs, create scripts, generate reports, etc.",
    input_schema: {
      type: "object" as const,
      properties: {
        path: { type: "string", description: "File path relative to workspace (e.g. 'output.json', 'scripts/analyze.py')" },
        content: { type: "string", description: "File content to write" },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "edit_file",
    description: "Find and replace text in a file in the agent workspace (data/workspace/). Use for targeted edits to existing files.",
    input_schema: {
      type: "object" as const,
      properties: {
        path: { type: "string", description: "File path relative to workspace" },
        find: { type: "string", description: "Text to find (exact match)" },
        replace: { type: "string", description: "Text to replace with" },
      },
      required: ["path", "find", "replace"],
    },
  },
];

const WORKSPACE_DIR = join(process.cwd(), "data", "workspace");

function ensureWorkspace(): string {
  if (!existsSync(WORKSPACE_DIR)) {
    mkdirSync(WORKSPACE_DIR, { recursive: true });
  }
  return WORKSPACE_DIR;
}

function safeWorkspacePath(filePath: string): string {
  const workspace = ensureWorkspace();
  const resolved = resolve(workspace, filePath);
  // Prevent path traversal outside workspace
  if (!resolved.startsWith(workspace)) {
    throw new Error("Path traversal not allowed — must stay within data/workspace/");
  }
  return resolved;
}

function executeCodeSandboxed(language: string, code: string): Promise<string> {
  return new Promise((res) => {
    const workspace = ensureWorkspace();
    const cmd = language === "python" ? "python3" : "node";
    const args = language === "python" ? ["-c", code] : ["-e", code];

    execFile(cmd, args, {
      cwd: workspace,
      timeout: 30_000,
      maxBuffer: 1024 * 1024, // 1MB
      env: { ...process.env, NODE_PATH: "", PYTHONDONTWRITEBYTECODE: "1" },
    }, (error: Error & { killed?: boolean } | null, stdout: string, stderr: string) => {
      let output = "";
      if (stdout) output += stdout;
      if (stderr) output += (output ? "\n--- stderr ---\n" : "") + stderr;
      if (error && !stdout && !stderr) {
        output = `Error: ${error.message}`;
      }
      if (error && "killed" in error && error.killed) {
        output += "\n[Process killed — exceeded 30s timeout]";
      }
      const maxLen = 50_000;
      if (output.length > maxLen) {
        output = output.slice(0, maxLen) + `\n... [truncated, ${output.length} chars total]`;
      }
      res(output || "(no output)");
    });
  });
}

// Execute a tool call and return the result
export async function executeTool(name: string, input: Record<string, unknown>): Promise<string> {
  try {
    switch (name) {
      case "dismiss_item": {
        dismissItem(input.source as string, input.source_id as string);
        const db = getDb();
        const xp = { slack: 5, github: 15, linear: 10, calendar: 5 }[input.source as string] ?? 5;
        db.prepare("INSERT INTO xp_log (action, source, xp, label) VALUES (?, ?, ?, ?)").run("dismiss", input.source, xp, `Cleared ${input.source} item`);
        return `Dismissed ${input.source} item ${input.source_id}. +${xp} XP`;
      }
      case "snooze_item": {
        const now = new Date();
        const durations: Record<string, number> = {
          "1h": 3600000, "2h": 7200000, "4h": 14400000,
          "tomorrow": (() => { const t = new Date(now); t.setDate(t.getDate() + 1); t.setHours(9, 0, 0, 0); return t.getTime() - now.getTime(); })(),
          "next_week": (() => { const m = new Date(now); m.setDate(m.getDate() + ((8 - m.getDay()) % 7 || 7)); m.setHours(9, 0, 0, 0); return m.getTime() - now.getTime(); })(),
        };
        const ms = durations[input.duration as string];
        const snoozeUntil = new Date(now.getTime() + ms).toISOString().replace("T", " ").slice(0, 19);
        snoozeItem(input.source as string, input.source_id as string, snoozeUntil);
        return `Snoozed until ${snoozeUntil}`;
      }
      case "merge_pr": {
        const result = await mergePR(input.repo as string, input.pr_number as number);
        if (result.success) {
          const db = getDb();
          db.prepare("INSERT INTO xp_log (action, source, xp, label) VALUES (?, ?, ?, ?)").run("merge_pr", "github", 50, `Merged PR #${input.pr_number}`);
          // Dismiss both possible source_id formats (review- and pr-) since the PR is now merged
          const repo = input.repo as string;
          const prNum = input.pr_number as number;
          dismissItem("github", `pr-${repo}-${prNum}`);
          dismissItem("github", `review-${repo}-${prNum}`);
          notifyChange();
        }
        return result.success ? `PR #${input.pr_number} merged! +50 XP` : `Failed: ${result.message}`;
      }
      case "enable_auto_merge": {
        const result = await enableAutoMerge(input.repo as string, input.pr_number as number);
        return result.success ? `Auto-merge enabled on PR #${input.pr_number}` : `Failed: ${result.message}`;
      }
      case "add_reviewer": {
        await addReviewer(input.repo as string, input.pr_number as number, [input.reviewer as string]);
        return `Requested review from ${input.reviewer} on PR #${input.pr_number}`;
      }
      case "update_linear_status": {
        await updateIssueState(input.issue_id as string, input.state_id as string);
        const updated = await fetchSingleIssue(input.issue_id as string);
        if (updated) {
          upsertItem({ source: "linear", source_id: updated.identifier, title: `[${updated.identifier}] ${updated.title}`, url: updated.url, raw_data: JSON.stringify(updated) });
          notifyChange();
        }
        return `Updated Linear issue status`;
      }
      case "assign_linear_issue": {
        await updateIssueAssignee(input.issue_id as string, (input.assignee_id as string) ?? null);
        const updated = await fetchSingleIssue(input.issue_id as string);
        if (updated) {
          upsertItem({ source: "linear", source_id: updated.identifier, title: `[${updated.identifier}] ${updated.title}`, url: updated.url, raw_data: JSON.stringify(updated) });
          notifyChange();
        }
        return `Updated Linear issue assignment`;
      }
      case "reply_slack": {
        const profile = getProfile();
        if (!profile?.slack_token) return "Error: Slack not connected";
        await sendReply(profile.slack_token, input.channel as string, input.text as string, input.thread_ts as string);
        const db = getDb();
        db.prepare("INSERT INTO xp_log (action, source, xp, label) VALUES (?, ?, ?, ?)").run("reply_slack", "slack", 10, "Replied in Slack");
        return `Sent Slack reply. +10 XP`;
      }
      case "react_slack": {
        const profile = getProfile();
        if (!profile?.slack_token) return "Error: Slack not connected";
        await addReaction(profile.slack_token, input.channel as string, input.timestamp as string, input.reaction as string);
        return `Added :${input.reaction}: reaction`;
      }
      case "create_todo": {
        const db = getDb();
        const id = crypto.randomUUID();
        const date = input.persistent ? null : new Date().toISOString().slice(0, 10);
        db.prepare("INSERT INTO daily_todos (id, date, text) VALUES (?, ?, ?)").run(id, date, input.text);
        return `Created todo: "${input.text}"`;
      }
      case "complete_todo": {
        const db = getDb();
        db.prepare("UPDATE daily_todos SET done = 1, completed_at = ? WHERE id = ?").run(new Date().toISOString(), input.todo_id);
        db.prepare("INSERT INTO xp_log (action, source, xp, label) VALUES (?, ?, ?, ?)").run("complete_todo", "todo", 20, "Completed todo");
        return `Marked todo as done. +20 XP`;
      }
      case "search_code": {
        if (input.repo === "self") {
          try {
            const result = execSync(`grep -rn --include="*.ts" --include="*.tsx" --include="*.css" "${(input.query as string).replace(/"/g, '\\"')}" src/`, {
              cwd: SELF_REPO_PATH, timeout: 5000, encoding: "utf-8", maxBuffer: 512 * 1024,
            });
            return result.length > 10000 ? result.slice(0, 10000) + "\n... (truncated)" : result;
          } catch (e) {
            const err = e as { stdout?: string };
            return err.stdout || "(no matches found)";
          }
        }
        return searchRepo(input.repo as string, input.query as string, input.branch as string | undefined);
      }
      case "read_file": {
        if (input.repo === "self") {
          try {
            const filePath = join(SELF_REPO_PATH, input.path as string);
            const content = readFileSync(filePath, "utf-8");
            return content.length > 20000 ? content.slice(0, 20000) + "\n... (truncated)" : content;
          } catch { return "(file not found)"; }
        }
        return readRepoFile(input.repo as string, input.path as string, input.branch as string | undefined);
      }
      case "list_files": {
        if (input.repo === "self") {
          try {
            const dir = join(SELF_REPO_PATH, (input.directory as string) ?? "");
            const entries = readdirSync(dir).filter(e => !e.startsWith(".") && e !== "node_modules" && e !== "data");
            return entries.map(e => {
              const isDir = statSync(join(dir, e)).isDirectory();
              return isDir ? e + "/" : e;
            }).join("\n");
          } catch { return "(directory not found)"; }
        }
        return listRepoFiles(input.repo as string, (input.directory as string) ?? "", input.branch as string | undefined);
      }
      case "clone_repo": {
        ensureRepo(input.repo as string);
        return `Repository ${input.repo} cloned/updated and ready for code exploration.`;
      }
      case "web_fetch": {
        const url = input.url as string;
        const method = (input.method as string) ?? "GET";
        const headers = (input.headers as Record<string, string>) ?? {};
        const body = input.body as string | undefined;
        const resp = await fetch(url, {
          method,
          headers: { "User-Agent": "BuilderAgent/1.0", ...headers },
          body: method === "POST" ? body : undefined,
        });
        const contentType = resp.headers.get("content-type") ?? "";
        let text: string;
        if (contentType.includes("text/html")) {
          const html = await resp.text();
          text = html
            .replace(/<script[\s\S]*?<\/script>/gi, "")
            .replace(/<style[\s\S]*?<\/style>/gi, "")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim();
        } else {
          text = await resp.text();
        }
        const maxLen = 8000;
        const truncated = text.length > maxLen ? text.slice(0, maxLen) + `\n\n... [truncated, ${text.length} chars total]` : text;
        return `HTTP ${resp.status} ${resp.statusText}\nContent-Type: ${contentType}\n\n${truncated}`;
      }
      case "api_fetch": {
        const url = input.url as string;
        const method = (input.method as string) ?? "GET";
        const body = input.body as string | undefined;
        const accept = input.accept as string | undefined;
        const headers: Record<string, string> = {
          "User-Agent": "BuilderAgent/1.0",
          "Content-Type": "application/json",
        };
        if (accept) headers["Accept"] = accept;
        if (url.includes("api.linear.app")) {
          headers["Authorization"] = process.env.LINEAR_API_KEY ?? "";
        } else if (url.includes("api.github.com")) {
          headers["Authorization"] = `Bearer ${process.env.GITHUB_TOKEN ?? ""}`;
          if (!accept) headers["Accept"] = "application/vnd.github+json";
        }
        const resp = await fetch(url, {
          method,
          headers,
          body: method === "POST" ? body : undefined,
        });
        let text = await resp.text();
        const maxLen = 10000;
        if (text.length > maxLen) text = text.slice(0, maxLen) + `\n\n... [truncated, ${text.length} chars total]`;
        return `HTTP ${resp.status}\n${text}`;
      }
      case "browse_web": {
        const action = input.action as string;
        switch (action) {
          case "navigate": {
            const result = await browse(input.url as string);
            const textPreview = result.text.length > 8000 ? result.text.slice(0, 8000) + "\n... (truncated)" : result.text;
            const linksText = result.links.slice(0, 30).map(l => `- [${l.text}](${l.href})`).join("\n");
            return `Page: ${result.title}\nURL: ${result.url}\n\n--- Page Text ---\n${textPreview}\n\n--- Links ---\n${linksText}\n\n[Screenshot attached as image]`;
          }
          case "click": {
            const result = await click(input.selector as string);
            const textPreview = result.text.length > 8000 ? result.text.slice(0, 8000) + "\n... (truncated)" : result.text;
            return `Clicked. Now on: ${result.title} (${result.url})\n\n--- Page Text ---\n${textPreview}\n\n[Screenshot attached as image]`;
          }
          case "type": {
            const result = await browserType(input.selector as string, input.text as string);
            return result;
          }
          case "screenshot": {
            const result = await screenshot();
            return `Screenshot of ${result.title} (${result.url}) [attached as image]`;
          }
          default:
            return `Unknown browse action: ${action}`;
        }
      }
      case "execute_code": {
        const language = input.language as string;
        const code = input.code as string;
        return await executeCodeSandboxed(language, code);
      }
      case "write_file": {
        const filePath = safeWorkspacePath(input.path as string);
        const dir = filePath.substring(0, filePath.lastIndexOf("/"));
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
        writeFileSync(filePath, input.content as string, "utf-8");
        return `Wrote ${(input.content as string).length} bytes to workspace/${input.path}`;
      }
      case "edit_file": {
        const filePath = safeWorkspacePath(input.path as string);
        if (!existsSync(filePath)) return `Error: File not found — workspace/${input.path}`;
        const content = readFileSync(filePath, "utf-8");
        const find = input.find as string;
        if (!content.includes(find)) return `Error: Text not found in file`;
        const updated = content.replace(find, input.replace as string);
        writeFileSync(filePath, updated, "utf-8");
        return `Edited workspace/${input.path} — replaced ${find.length} chars`;
      }
      default:
        return `Unknown tool: ${name}`;
    }
  } catch (e) {
    return `Error: ${e instanceof Error ? e.message : String(e)}`;
  }
}

// Get ALL slack items for conversation context
export function getAllSlackItems() {
  const db = getDb();
  return db.prepare(
    `SELECT * FROM items WHERE source = 'slack' ORDER BY created_at DESC`
  ).all() as { source: string; source_id: string; title: string; raw_data: string | null }[];
}

// Build the system prompt with current work items context
export function buildSystemPrompt(codeContext?: { repo: string; prNumber?: number; baseBranch?: string; headBranch?: string; diff?: string; files?: { path: string; content: string }[] }): string {
  const profile = getProfile();
  const items = getItems();
  const allSlackItems = getAllSlackItems();
  const db = getDb();

  const linearItems = items.filter((i) => i.source === "linear");
  const githubItems = items.filter((i) => i.source === "github");
  const slackItems = items.filter((i) => i.source === "slack");
  const calendarItems = items.filter((i) => i.source === "calendar");

  const todayDate = new Date().toISOString().slice(0, 10);
  const todos = db.prepare(
    "SELECT id, text, done, date FROM daily_todos WHERE date = ? OR date IS NULL OR (done = 0 AND date < ?) ORDER BY done, sort_order"
  ).all(todayDate, todayDate) as { id: string; text: string; done: number; date: string | null }[];

  const slackByChannel = new Map<string, { sender: string; text: string; isMe: boolean }[]>();
  for (const item of allSlackItems) {
    const raw = JSON.parse(item.raw_data ?? "{}");
    const ch = raw.channelName ?? "unknown";
    if (!slackByChannel.has(ch)) slackByChannel.set(ch, []);
    slackByChannel.get(ch)!.push({
      sender: raw.senderName ?? raw.sender ?? "unknown",
      text: raw.text ?? "",
      isMe: raw.sender === profile?.slack_user_id,
    });
  }

  const conversationContext = Array.from(slackByChannel.entries())
    .slice(0, 15)
    .map(([channel, msgs]) => {
      const myMsgs = msgs.filter((m) => m.isMe);
      const otherMsgs = msgs.filter((m) => !m.isMe);
      const lines = msgs.slice(0, 20).map((m) =>
        `  ${m.isMe ? "[USER]" : m.sender}: ${m.text.substring(0, 150)}`
      ).join("\n");
      return `### ${channel} (${myMsgs.length} of my messages, ${otherMsgs.length} from others)\n${lines}`;
    }).join("\n\n");

  const linearContext = linearItems.map((i) => {
    const raw = JSON.parse(i.raw_data ?? "{}");
    return `- source_id="${i.source_id}" linear_id="${raw.id}" identifier=${raw.identifier} | ${raw.title} — state: ${raw.state} (stateId: ${raw.stateId}), priority: ${["None", "Urgent", "High", "Medium", "Low"][raw.priority ?? 0]}${raw.assignee ? `, assignee: ${raw.assignee} (assigneeId: ${raw.assigneeId})` : ""}${raw.labels?.length ? `, labels: ${raw.labels.join(", ")}` : ""}`;
  }).join("\n");

  const githubContext = githubItems.map((i) => {
    const raw = JSON.parse(i.raw_data ?? "{}");
    const type = i.source_id.startsWith("review-") ? "Review" : "My PR";
    const checks = raw.checks ?? [];
    const failing = checks.filter((c: { conclusion: string }) => c.conclusion === "failure").length;
    return `- source_id="${i.source_id}" | [${type}] ${raw.title} — repo: ${raw.repo}, #${raw.id}${raw.draft ? " DRAFT" : ""}${raw.mergeable ? " MERGEABLE" : ""}${failing > 0 ? ` ${failing} FAILING` : ""}${raw.mergeableState === "dirty" ? " CONFLICTS" : ""}, reviewers: ${(raw.reviewers ?? []).join(", ") || "none"}`;
  }).join("\n");

  const slackContext = slackItems.slice(0, 40).map((i) => {
    const raw = JSON.parse(i.raw_data ?? "{}");
    return `- source_id="${i.source_id}" channel="${raw.channel}" thread_ts="${raw.threadTs ?? raw.timestamp}" | #${raw.channelName} — ${raw.senderName}: ${raw.text?.substring(0, 150)}`;
  }).join("\n");

  const calendarContext = calendarItems.map((i) => {
    const raw = JSON.parse(i.raw_data ?? "{}");
    return `- source_id="${i.source_id}" | ${raw.allDay ? "All day" : new Date(raw.start).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })} ${raw.title}${raw.location ? ` @ ${raw.location}` : ""}${raw.responseStatus === "needsAction" ? " [NEEDS RESPONSE]" : ""}`;
  }).join("\n");

  const todoContext = todos.map((t) => `- id="${t.id}" [${t.done ? "x" : " "}] ${t.text}${t.date ? "" : " (persistent)"}`).join("\n");

  let systemPrompt = `You are a powerful work assistant embedded in "Builder Command". You can see all the user's work items AND take actions on their behalf using tools. Be proactive — if the user asks you to do something, DO it with tools rather than just describing how.

## Your Capabilities
You can: dismiss/snooze items, merge PRs, enable auto-merge, request reviewers, change Linear status, assign Linear issues, reply in Slack, react to Slack messages, create/complete todos, search/read code from GitHub repos, browse the web (fetch any URL), browse websites with a real browser via browse_web (renders JavaScript, takes screenshots — use this for SPAs and dashboards), call Linear and GitHub APIs directly with auto-auth via api_fetch, **execute arbitrary code** (JavaScript or Python) via execute_code for data processing/calculations/parsing/anything the other tools don't cover, and **write/edit files** in a workspace directory (data/workspace/) to save outputs, scripts, or reports.

## Current Work Items

### Calendar (${calendarItems.length} events)
${calendarContext || "No events"}

### Linear Issues (${linearItems.length})
${linearContext || "No issues"}

### GitHub PRs (${githubItems.length})
${githubContext || "No PRs"}

### Slack Messages (${slackItems.length} active)
${slackContext || "No messages"}

### My Todos
${todoContext || "No todos"}

## Slack Conversation History
${conversationContext}

## Guidelines
- Profile: GitHub: ${profile?.github_username ?? "not set"}, Linear: ${profile?.linear_email ?? "not set"}
- **Take action** when the user asks. Don't just say "you could merge it" — call merge_pr.
- When dismissing/snoozing, use the source and source_id from the item context above.
- For Slack replies, use the channel ID and thread_ts from the item context. Match the user's communication style.
- When the user asks about code, clone the repo first if needed, then search/read files.
- **Builder Command codebase**: This app's own code lives at ${process.cwd()}. If the user asks about how Builder Command works, use read_file to explore the codebase. Key paths: src/app/page.tsx (UI), src/lib/ (backend logic), src/app/api/ (API routes).
- **Be extremely concise.** 1-3 sentences max unless the user asks for detail. No fluff, no preamble, no restating what they said. Lead with the answer or action. Use bullet points for lists, not paragraphs.
- When code context is provided, you have the actual source code — reference specific files and lines.`;

  if (codeContext) {
    systemPrompt += `

## Code Context
Repository: ${codeContext.repo}
${codeContext.prNumber ? `PR #${codeContext.prNumber} (${codeContext.baseBranch} <- ${codeContext.headBranch})` : ""}

### Diff
\`\`\`diff
${codeContext.diff}
\`\`\`

### Changed Files (${codeContext.files?.length ?? 0} files)
${(codeContext.files ?? []).map((f) => `#### ${f.path}\n\`\`\`\n${f.content}\n\`\`\``).join("\n\n")}
`;
  }

  return systemPrompt;
}
