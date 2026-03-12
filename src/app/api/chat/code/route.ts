import { spawn } from "child_process";
import { getRepoPath, isRepoReady, fetchPRBranch } from "@/lib/repo-cache";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { prompt, repo, prNumber, sessionId } = await request.json();

  if (!repo) {
    return Response.json({ error: "repo is required" }, { status: 400 });
  }

  if (!isRepoReady(repo)) {
    return Response.json({ error: "Repo is not cloned yet. Please wait for cloning to finish." }, { status: 409 });
  }

  const repoPath = getRepoPath(repo)!;

  // Fetch PR branch if available
  let fullPrompt = prompt;
  if (prNumber && !sessionId) {
    await fetchPRBranch(repo, prNumber);
    fullPrompt = `${prompt}\n\nContext: You are reviewing PR #${prNumber} in ${repo}. The PR branch is checked out as pr-${prNumber}. Use \`git diff origin/main...pr-${prNumber}\` to see changes, and explore the code with your tools.`;
  }

  const claudePath = process.env.HOME + "/.local/bin/claude";

  const args = [
    "-p", fullPrompt,
    "--output-format", "stream-json",
    "--verbose",
    "--allowed-tools", "Read",
    "--allowed-tools", "Grep",
    "--allowed-tools", "Glob",
    "--allowed-tools", "Bash(git:*)",
    "--permission-mode", "plan",
    "--append-system-prompt", `You are a code expert embedded in Builder Command. The user is asking about code in ${repo}. Use your tools to search and read actual code — don't guess. Be concise, use markdown, reference specific files and line numbers.`,
    "--model", "sonnet",
    "--max-budget-usd", "0.50",
  ];

  if (sessionId) {
    args.push("--resume", sessionId);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cleanEnv = { ...process.env, FORCE_COLOR: "0" } as any;
  delete cleanEnv.CLAUDECODE;
  delete cleanEnv.CLAUDE_CODE_ENTRYPOINT;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const proc = spawn(claudePath, args, {
        cwd: repoPath,
        env: cleanEnv,
        stdio: ["pipe", "pipe", "pipe"],
      });

      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: "connected" })}\n\n`));

      let buffer = "";

      proc.stdout.on("data", (chunk: Buffer) => {
        buffer += chunk.toString();
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const msg = JSON.parse(line);

            if (msg.session_id) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ sessionId: msg.session_id })}\n\n`));
            }

            if (msg.type === "assistant" && msg.message?.content) {
              for (const block of msg.message.content) {
                if (block.type === "text" && block.text) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: block.text })}\n\n`));
                }
                if (block.type === "tool_use" && block.name) {
                  const input = (block.input ?? {}) as Record<string, string>;
                  const toolLabels: Record<string, string> = {
                    Read: `Reading ${input.file_path?.split("/").pop() ?? "file"}...`,
                    Grep: `Searching for "${input.pattern ?? "..."}"...`,
                    Glob: `Finding "${input.pattern ?? "..."}"...`,
                    Bash: `Running: ${(input.command ?? "").slice(0, 60)}...`,
                  };
                  const label = toolLabels[block.name] ?? `${block.name}...`;
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ tool: block.name, label })}\n\n`));
                }
              }
            }

            if (msg.type === "content_block_delta" && msg.delta?.type === "text_delta" && msg.delta.text) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: msg.delta.text })}\n\n`));
            }
          } catch {
            // skip non-JSON
          }
        }
      });

      proc.stderr.on("data", () => {
        // ignore stderr noise from hooks etc
      });

      proc.on("close", () => {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      });

      proc.on("error", (err) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: err.message })}\n\n`));
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
