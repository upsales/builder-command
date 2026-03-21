import { getAllRepoIndexes, getRepoIndex, getModuleIndex, indexRepoBackground, isIndexing } from "@/lib/repo-index";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const repo = searchParams.get("repo");

  if (repo) {
    const index = getRepoIndex(repo);
    if (!index) return Response.json({ error: "Not indexed" }, { status: 404 });
    const modules = getModuleIndex(repo);
    return Response.json({ ...index, modules });
  }

  const indexes = getAllRepoIndexes();
  return Response.json(indexes.map(idx => ({
    repo: idx.repo,
    summary: idx.summary,
    status: idx.status,
    indexed_at: idx.indexed_at,
    commit_sha: idx.commit_sha,
    indexing: isIndexing(idx.repo),
  })));
}

export async function POST(request: Request) {
  const { repo } = await request.json();
  if (!repo || typeof repo !== "string") {
    return Response.json({ error: "repo required" }, { status: 400 });
  }

  if (isIndexing(repo)) {
    return Response.json({ status: "already_indexing", repo });
  }

  indexRepoBackground(repo);
  return Response.json({ status: "indexing_started", repo });
}
