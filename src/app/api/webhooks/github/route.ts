import { NextRequest, NextResponse } from "next/server";
import { getProfile, upsertItem } from "@/lib/items";
import { indexRepoBackground } from "@/lib/repo-index";
import { isRepoReady } from "@/lib/repo-cache";

export async function POST(request: NextRequest) {
  const event = request.headers.get("x-github-event");
  const contentType = request.headers.get("content-type") ?? "";
  let body: Record<string, unknown>;
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const form = await request.formData();
    body = JSON.parse(form.get("payload") as string);
  } else {
    body = await request.json();
  }

  const profile = getProfile();
  if (!profile?.github_username) {
    return NextResponse.json({ ok: true });
  }

  if (event === "pull_request") {
    const pr = body.pull_request;
    const action = body.action; // "opened", "closed", "synchronize", "review_requested", etc.
    const repo = body.repository?.full_name ?? "";

    if (!pr) return NextResponse.json({ ok: true });

    // Track PRs where we're the author
    if (pr.user?.login?.toLowerCase() === profile.github_username.toLowerCase()) {
      const sid = `pr-${repo}-${pr.number}`;
      if (action === "closed") {
        // Will be cleaned up on next full sync
      } else {
        upsertItem({
          source: "github",
          source_id: sid,
          title: `My PR: ${pr.title} (${repo}#${pr.number})`,
          url: pr.html_url,
          raw_data: JSON.stringify({
            id: pr.number,
            title: pr.title,
            repo,
            url: pr.html_url,
            draft: pr.draft,
            mergeable: pr.mergeable,
            mergeableState: pr.mergeable_state,
            reviewers: (pr.requested_reviewers ?? []).map((r: { login: string }) => r.login),
            checks: [],
          }),
        });
      }
    }

    // Track PRs where we're requested as reviewer
    const reviewers = (pr.requested_reviewers ?? []).map((r: { login: string }) => r.login.toLowerCase());
    if (reviewers.includes(profile.github_username.toLowerCase())) {
      const sid = `review-${repo}-${pr.number}`;
      upsertItem({
        source: "github",
        source_id: sid,
        title: `Review: ${pr.title} (${repo}#${pr.number})`,
        url: pr.html_url,
        raw_data: JSON.stringify({
          id: pr.number,
          title: pr.title,
          repo,
          url: pr.html_url,
          draft: pr.draft,
          mergeable: pr.mergeable,
          mergeableState: pr.mergeable_state,
          reviewers,
          checks: [],
        }),
      });
    }
  }

  if (event === "pull_request_review") {
    // When someone reviews our PR, update the PR data
    const pr = body.pull_request;
    const repo = body.repository?.full_name ?? "";
    if (pr?.user?.login?.toLowerCase() === profile.github_username.toLowerCase()) {
      const sid = `pr-${repo}-${pr.number}`;
      upsertItem({
        source: "github",
        source_id: sid,
        title: `My PR: ${pr.title} (${repo}#${pr.number})`,
        url: pr.html_url,
        raw_data: JSON.stringify({
          id: pr.number,
          title: pr.title,
          repo,
          url: pr.html_url,
          draft: pr.draft,
          mergeable: pr.mergeable,
          mergeableState: pr.mergeable_state,
          reviewers: (pr.requested_reviewers ?? []).map((r: { login: string }) => r.login),
          checks: [],
        }),
      });
    }
  }

  // Re-index repo on push events if we have it cloned
  if (event === "push") {
    const repo = (body.repository as { full_name?: string })?.full_name;
    if (repo && isRepoReady(repo)) {
      indexRepoBackground(repo);
    }
  }

  return NextResponse.json({ ok: true });
}
