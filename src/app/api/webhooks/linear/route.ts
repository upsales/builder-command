import { NextRequest, NextResponse } from "next/server";
import { getProfile, upsertItem, removeStaleItems, getItems } from "@/lib/items";
import { notifyChange } from "@/lib/changeNotifier";

export async function POST(request: NextRequest) {
  const body = await request.json();

  // Linear sends a webhook verification request
  if (body.type === "url_verification") {
    return NextResponse.json({ challenge: body.challenge });
  }

  const profile = getProfile();
  if (!profile?.linear_email) {
    return NextResponse.json({ ok: true });
  }

  const action = body.action; // "create", "update", "remove"
  const data = body.data;
  const type = body.type; // "Issue", "Comment", etc.

  if (type === "Issue" && data) {
    const identifier = data.identifier ?? data.id;
    const title = data.title ?? "";
    const url = data.url ?? "";
    const state = data.state?.name ?? "";
    const assignee = data.assignee?.email ?? data.assignee?.name ?? "";

    // Only track issues assigned to the user
    if (assignee && assignee.toLowerCase() !== profile.linear_email.toLowerCase()) {
      // Issue not assigned to us — remove if we had it
      if (action === "update") {
        const items = getItems().filter(i => i.source === "linear");
        const sourceIds = items
          .filter(i => i.source_id !== identifier)
          .map(i => i.source_id);
        // Just upsert with current data, stale removal will handle it on next full sync
      }
      return NextResponse.json({ ok: true });
    }

    if (action === "remove") {
      // Issue deleted — will be cleaned up on next sync
      return NextResponse.json({ ok: true });
    }

    // Upsert the issue
    upsertItem({
      source: "linear",
      source_id: identifier,
      title: `[${identifier}] ${title}`,
      url,
      raw_data: JSON.stringify({
        id: data.id,
        identifier,
        title,
        url,
        state,
        stateId: data.state?.id,
        priority: data.priority,
        assignee: assignee,
        assigneeId: data.assignee?.id,
        labels: data.labels?.map((l: { name: string }) => l.name) ?? [],
      }),
    });

    notifyChange();
  }

  return NextResponse.json({ ok: true });
}
