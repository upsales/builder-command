import { NextRequest, NextResponse } from "next/server";
import { mergePR, enableAutoMerge, addReviewer, fetchCollaborators } from "@/lib/integrations/github";
import { getDb } from "@/lib/db";

export async function POST(request: NextRequest) {
  const { action, repo, prNumber, reviewers } = await request.json();

  if (action === "merge") {
    const result = await mergePR(repo, prNumber);
    if (result.success) {
      const db = getDb();
      db.prepare("INSERT INTO xp_log (action, source, xp, label) VALUES (?, ?, ?, ?)").run("merge_pr", "github", 50, `Merged PR #${prNumber}`);
    }
    return NextResponse.json(result);
  }

  if (action === "auto_merge") {
    const result = await enableAutoMerge(repo, prNumber);
    return NextResponse.json(result);
  }

  if (action === "add_reviewer") {
    await addReviewer(repo, prNumber, reviewers);
    return NextResponse.json({ ok: true });
  }

  if (action === "collaborators") {
    const collabs = await fetchCollaborators(repo);
    return NextResponse.json(collabs);
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
