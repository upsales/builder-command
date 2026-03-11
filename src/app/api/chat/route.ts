import Anthropic from "@anthropic-ai/sdk";
import { tools, executeTool, buildSystemPrompt } from "@/lib/chatTools";

const client = new Anthropic();

export async function POST(request: Request) {
  const { messages, codeContext } = await request.json();

  const systemPrompt = buildSystemPrompt(codeContext);

  // Build the messages for the API, converting our format to Anthropic format
  const apiMessages: Anthropic.MessageParam[] = messages.map((m: { role: string; content: string }) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      let currentMessages = apiMessages;
      let maxToolRounds = 5;

      while (maxToolRounds > 0) {
        maxToolRounds--;

        const stream = client.messages.stream({
          model: "claude-sonnet-4-20250514",
          max_tokens: 2048,
          system: systemPrompt,
          tools,
          messages: currentMessages,
        });

        // Stream text deltas in real-time
        let hasToolUse = false;
        const toolResults: Anthropic.ToolResultBlockParam[] = [];

        stream.on("text", (text) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
        });

        const response = await stream.finalMessage();

        // Process tool calls after stream completes
        for (const block of response.content) {
          if (block.type === "tool_use") {
            hasToolUse = true;
            const toolLabel = {
              dismiss_item: "Dismissing item...",
              snooze_item: "Snoozing item...",
              merge_pr: "Merging PR...",
              enable_auto_merge: "Enabling auto-merge...",
              add_reviewer: "Requesting review...",
              update_linear_status: "Updating Linear status...",
              assign_linear_issue: "Assigning issue...",
              reply_slack: "Sending Slack reply...",
              react_slack: "Adding reaction...",
              create_todo: "Creating todo...",
              complete_todo: "Completing todo...",
              search_code: "Searching code...",
              read_file: "Reading file...",
              list_files: "Listing files...",
              clone_repo: "Cloning repository...",
              web_fetch: "Fetching web page...",
              api_fetch: "Calling API...",
            }[block.name] ?? `Running ${block.name}...`;

            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ tool: block.name, status: "running", label: toolLabel })}\n\n`));

            const result = await executeTool(block.name, block.input as Record<string, unknown>);

            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ tool: block.name, status: "done", result })}\n\n`));

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

        // Continue the conversation with tool results
        currentMessages = [
          ...currentMessages,
          { role: "assistant" as const, content: response.content },
          { role: "user" as const, content: toolResults },
        ];
      }

      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
