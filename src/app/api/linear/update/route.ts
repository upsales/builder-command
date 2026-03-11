import { NextRequest, NextResponse } from "next/server";
import { updateIssueState, updateIssueAssignee } from "@/lib/integrations/linear";

export async function POST(request: NextRequest) {
  const { issueId, stateId, assigneeId } = await request.json();

  if (stateId !== undefined) {
    await updateIssueState(issueId, stateId);
  }
  if (assigneeId !== undefined) {
    await updateIssueAssignee(issueId, assigneeId);
  }

  return NextResponse.json({ ok: true });
}
