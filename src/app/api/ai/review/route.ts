import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { fetchPRDiff } from "@/lib/integrations/github";

const client = new Anthropic();

export async function POST(request: NextRequest) {
  const { repo, prNumber, title, body } = await request.json();

  const diff = await fetchPRDiff(repo, prNumber);

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1500,
    messages: [{
      role: "user",
      content: `Review this PR and provide a concise summary to help with code review.

## PR: ${title}
${body ? `### Description\n${body.slice(0, 1000)}` : ""}

## Diff
\`\`\`diff
${diff}
\`\`\`

## Provide
1. **Summary** — what this PR does in 1-2 sentences
2. **Key changes** — bullet list of the most important changes (files, logic changes)
3. **Concerns** — any potential issues, bugs, security concerns, or things the reviewer should look closely at
4. **Suggestion** — your overall impression (looks good / needs attention / has issues)

Be concise. Focus on substance, not formatting. If the diff is trivial, say so.`,
    }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  return NextResponse.json({ review: text });
}
