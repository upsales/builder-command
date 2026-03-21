import { Octokit } from "@octokit/rest";

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN!,
});

export interface GithubPR {
  id: number;
  title: string;
  body: string | null | undefined;
  url: string;
  repo: string;
  author: string;
  state: string;
  reviewRequested: boolean;
  draft: boolean;
  mergeable: boolean | null;
  mergeableState: string | null;
  assignees: string[];
  reviewers: string[];
  checks: { name: string; status: string; conclusion: string | null }[];
  comments: { author: string; body: string; createdAt: string; url: string; path?: string; line?: number }[];
  createdAt: string;
  updatedAt: string;
}

export async function fetchPRsNeedingReview(username: string): Promise<GithubPR[]> {
  const { data } = await octokit.search.issuesAndPullRequests({
    q: `is:pr is:open review-requested:${username}`,
    sort: "updated",
    order: "desc",
    per_page: 50,
  });

  return Promise.all(data.items.map((item) => enrichPR(item, true)));
}

export async function fetchMyPRs(username: string): Promise<GithubPR[]> {
  const { data } = await octokit.search.issuesAndPullRequests({
    q: `is:pr is:open author:${username}`,
    sort: "updated",
    order: "desc",
    per_page: 50,
  });

  return Promise.all(data.items.map((item) => enrichPR(item, false)));
}

export async function fetchAssignedPRs(username: string): Promise<GithubPR[]> {
  const { data } = await octokit.search.issuesAndPullRequests({
    q: `is:pr is:open assignee:${username}`,
    sort: "updated",
    order: "desc",
    per_page: 50,
  });

  return Promise.all(data.items.map((item) => enrichPR(item, false)));
}

async function enrichPR(
  item: { number: number; title: string; body?: string | null; html_url: string; repository_url: string; user?: { login: string } | null; state: string; created_at: string; updated_at: string },
  reviewRequested: boolean,
): Promise<GithubPR> {
  const repo = item.repository_url.split("/").slice(-2).join("/");
  const [owner, repoName] = repo.split("/");
  const prNumber = item.number;

  let mergeable: boolean | null = null;
  let mergeableState: string | null = null;
  let reviewers: string[] = [];
  let checks: GithubPR["checks"] = [];
  let comments: GithubPR["comments"] = [];

  try {
    // Get PR details for mergeable status
    const { data: pr } = await octokit.pulls.get({ owner, repo: repoName, pull_number: prNumber });
    mergeable = pr.mergeable;
    mergeableState = pr.mergeable_state;

    // Get requested reviewers
    const { data: reviewData } = await octokit.pulls.listRequestedReviewers({ owner, repo: repoName, pull_number: prNumber });
    reviewers = [
      ...reviewData.users.map((u) => u.login),
      ...reviewData.teams.map((t) => t.slug),
    ];

    // Also get completed reviews
    const { data: reviews } = await octokit.pulls.listReviews({ owner, repo: repoName, pull_number: prNumber });
    for (const r of reviews) {
      if (r.user && !reviewers.includes(r.user.login)) {
        reviewers.push(r.user.login);
      }
    }
  } catch { /* ignore enrichment failures */ }

  try {
    // Get check runs
    const { data: pr } = await octokit.pulls.get({ owner, repo: repoName, pull_number: prNumber });
    const { data: checkRuns } = await octokit.checks.listForRef({
      owner,
      repo: repoName,
      ref: pr.head.sha,
      per_page: 30,
    });
    checks = checkRuns.check_runs.map((c) => ({
      name: c.name,
      status: c.status,
      conclusion: c.conclusion,
    }));
  } catch { /* ignore */ }

  try {
    // Get review comments + issue comments
    const { data: issueComments } = await octokit.issues.listComments({
      owner, repo: repoName, issue_number: prNumber, per_page: 20,
    });
    const { data: reviewComments } = await octokit.pulls.listReviewComments({
      owner, repo: repoName, pull_number: prNumber, per_page: 20,
    });

    comments = [
      ...issueComments.map((c) => ({
        author: c.user?.login ?? "unknown",
        body: c.body ?? "",
        createdAt: c.created_at,
        url: c.html_url,
      })),
      ...reviewComments.map((c) => ({
        author: c.user.login,
        body: c.body,
        createdAt: c.created_at,
        url: c.html_url,
        path: c.path,
        line: c.line ?? undefined,
      })),
    ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  } catch { /* ignore */ }

  return {
    id: item.number,
    title: item.title,
    body: item.body,
    url: item.html_url,
    repo,
    author: item.user?.login ?? "unknown",
    assignees: (item.assignees ?? []).map((a: { login: string }) => a.login),
    state: item.state,
    reviewRequested,
    draft: item.draft ?? false,
    mergeable,
    mergeableState,
    reviewers,
    checks,
    comments,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
  };
}

export async function mergePR(repo: string, prNumber: number): Promise<{ success: boolean; message: string }> {
  const [owner, repoName] = repo.split("/");
  try {
    await octokit.pulls.merge({ owner, repo: repoName, pull_number: prNumber });
    return { success: true, message: "PR merged successfully" };
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : String(e) };
  }
}

export async function enableAutoMerge(repo: string, prNumber: number): Promise<{ success: boolean; message: string }> {
  const [owner, repoName] = repo.split("/");
  try {
    // Get the PR's node ID for GraphQL
    const { data: pr } = await octokit.pulls.get({ owner, repo: repoName, pull_number: prNumber });
    const nodeId = pr.node_id;

    // Enable auto-merge via GraphQL (REST API doesn't support this)
    await octokit.graphql(`
      mutation($prId: ID!) {
        enablePullRequestAutoMerge(input: { pullRequestId: $prId, mergeMethod: SQUASH }) {
          pullRequest { id }
        }
      }
    `, { prId: nodeId });
    return { success: true, message: "Auto-merge enabled" };
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : String(e) };
  }
}

export async function addReviewer(repo: string, prNumber: number, reviewers: string[]): Promise<void> {
  const [owner, repoName] = repo.split("/");
  await octokit.pulls.requestReviewers({
    owner,
    repo: repoName,
    pull_number: prNumber,
    reviewers,
  });
}

export async function fetchPRDiff(repo: string, prNumber: number): Promise<string> {
  const [owner, repoName] = repo.split("/");
  try {
    const { data } = await octokit.pulls.get({
      owner,
      repo: repoName,
      pull_number: prNumber,
      mediaType: { format: "diff" },
    });
    // data is the diff string when using diff media type
    const diff = data as unknown as string;
    // Truncate very large diffs
    return diff.length > 15000 ? diff.slice(0, 15000) + "\n\n... (diff truncated)" : diff;
  } catch (e) {
    return `Error fetching diff: ${e instanceof Error ? e.message : String(e)}`;
  }
}

export async function fetchPRDetails(repo: string, prNumber: number): Promise<string> {
  const [owner, repoName] = repo.split("/");
  try {
    const { data: pr } = await octokit.pulls.get({ owner, repo: repoName, pull_number: prNumber });
    const { data: reviews } = await octokit.pulls.listReviews({ owner, repo: repoName, pull_number: prNumber });
    const { data: comments } = await octokit.issues.listComments({ owner, repo: repoName, issue_number: prNumber });
    const { data: files } = await octokit.pulls.listFiles({ owner, repo: repoName, pull_number: prNumber, per_page: 100 });

    const reviewSummary = reviews.map(r => `  ${r.user?.login}: ${r.state}`).join("\n");
    const commentSummary = comments.slice(-10).map(c => `  ${c.user?.login}: ${c.body?.slice(0, 200)}`).join("\n");
    const fileSummary = files.map(f => `  ${f.status} ${f.filename} (+${f.additions} -${f.deletions})`).join("\n");

    return `PR #${prNumber}: ${pr.title}
Author: ${pr.user?.login}
State: ${pr.state}, Merged: ${pr.merged}
Base: ${pr.base.ref} ← Head: ${pr.head.ref}
Mergeable: ${pr.mergeable}, Merge state: ${pr.mergeable_state}
Changed files: ${pr.changed_files}, +${pr.additions} -${pr.deletions}
Body:\n${(pr.body ?? "").slice(0, 1000)}

Reviews:\n${reviewSummary || "  None"}

Recent comments:\n${commentSummary || "  None"}

Files changed:\n${fileSummary}`;
  } catch (e) {
    return `Error: ${e instanceof Error ? e.message : String(e)}`;
  }
}

export async function fetchRepoIssues(repo: string, state: "open" | "closed" | "all" = "open"): Promise<string> {
  const [owner, repoName] = repo.split("/");
  try {
    const { data } = await octokit.issues.listForRepo({ owner, repo: repoName, state, per_page: 20 });
    return data.filter(i => !i.pull_request).map(i =>
      `#${i.number}: ${i.title} [${i.state}] by ${i.user?.login} — ${i.labels.map(l => typeof l === "string" ? l : l.name).join(", ")}`
    ).join("\n") || "No issues found";
  } catch (e) {
    return `Error: ${e instanceof Error ? e.message : String(e)}`;
  }
}

export async function createPR(repo: string, head: string, base: string, title: string, body: string): Promise<{ success: boolean; number?: number; url?: string; message: string }> {
  const [owner, repoName] = repo.split("/");
  try {
    const { data } = await octokit.pulls.create({ owner, repo: repoName, head, base, title, body });
    return { success: true, number: data.number, url: data.html_url, message: `PR #${data.number} created` };
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : String(e) };
  }
}

export async function submitReview(repo: string, prNumber: number, event: "APPROVE" | "REQUEST_CHANGES" | "COMMENT", body?: string): Promise<{ success: boolean; message: string }> {
  const [owner, repoName] = repo.split("/");
  try {
    await octokit.pulls.createReview({ owner, repo: repoName, pull_number: prNumber, event, body: body || undefined });
    return { success: true, message: `Review submitted: ${event}` };
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : String(e) };
  }
}

export async function commentOnPR(repo: string, prNumber: number, body: string): Promise<{ success: boolean; message: string }> {
  const [owner, repoName] = repo.split("/");
  try {
    await octokit.issues.createComment({ owner, repo: repoName, issue_number: prNumber, body });
    return { success: true, message: "Comment posted" };
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : String(e) };
  }
}

export async function getPRChecks(repo: string, prNumber: number): Promise<{ name: string; status: string; conclusion: string | null }[]> {
  const [owner, repoName] = repo.split("/");
  const { data: pr } = await octokit.pulls.get({ owner, repo: repoName, pull_number: prNumber });
  const { data: checkRuns } = await octokit.checks.listForRef({ owner, repo: repoName, ref: pr.head.sha, per_page: 50 });
  return checkRuns.check_runs.map(c => ({ name: c.name, status: c.status, conclusion: c.conclusion }));
}

export async function fetchCollaborators(repo: string): Promise<string[]> {
  const [owner, repoName] = repo.split("/");
  try {
    const { data } = await octokit.repos.listCollaborators({ owner, repo: repoName, per_page: 100 });
    return data.map((c) => c.login);
  } catch {
    return [];
  }
}
