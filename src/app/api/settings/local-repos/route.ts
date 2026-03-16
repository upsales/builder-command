import { NextRequest, NextResponse } from "next/server";
import { scanLocalRepos, getLocalRepos, setLocalRepos } from "@/lib/repo-cache";

// GET — scan disk and return found repos + saved selections
export async function GET() {
  const found = scanLocalRepos();
  const saved = getLocalRepos();
  return NextResponse.json({ found, saved });
}

// POST — save selected repo → localPath mappings
export async function POST(request: NextRequest) {
  const { repos } = await request.json();
  if (!repos || typeof repos !== "object") {
    return NextResponse.json({ error: "repos must be an object mapping repo to localPath" }, { status: 400 });
  }
  setLocalRepos(repos);
  return NextResponse.json({ saved: repos });
}
