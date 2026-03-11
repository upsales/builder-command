import { getRepoStatuses, cloneRepoBackground } from "@/lib/repo-cache";

export async function GET() {
  return Response.json(getRepoStatuses());
}

export async function POST(request: Request) {
  const { repos } = await request.json();
  if (Array.isArray(repos)) {
    for (const repo of repos) {
      if (typeof repo === "string") {
        cloneRepoBackground(repo);
      }
    }
  }
  return Response.json({ ok: true, statuses: getRepoStatuses() });
}
