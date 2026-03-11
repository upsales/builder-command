import { NextRequest, NextResponse } from "next/server";
import { getPRCodeContext } from "@/lib/repo-cache";

export async function POST(request: NextRequest) {
  const { repo, prNumber } = await request.json();

  if (!repo || !prNumber) {
    return NextResponse.json({ error: "repo and prNumber required" }, { status: 400 });
  }

  try {
    const context = await getPRCodeContext(repo, prNumber);
    return NextResponse.json({
      diff: context.diff,
      files: context.files,
      baseBranch: context.baseBranch,
      headBranch: context.headBranch,
      fileCount: context.files.length,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
