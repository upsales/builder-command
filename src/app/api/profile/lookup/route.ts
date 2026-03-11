import { NextRequest, NextResponse } from "next/server";
import { LinearClient } from "@linear/sdk";
import { Octokit } from "@octokit/rest";

export async function GET(request: NextRequest) {
  const source = new URL(request.url).searchParams.get("source");
  const query = new URL(request.url).searchParams.get("q")?.toLowerCase() ?? "";

  if (source === "github") {
    const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN! });

    // Get authenticated user + org members
    const { data: me } = await octokit.users.getAuthenticated();
    const users = [{ username: me.login, name: me.name ?? me.login, avatar: me.avatar_url }];

    // Try to get org members for broader search
    try {
      const { data: orgs } = await octokit.orgs.listForAuthenticatedUser();
      for (const org of orgs.slice(0, 3)) {
        const { data: members } = await octokit.orgs.listMembers({
          org: org.login,
          per_page: 100,
        });
        for (const m of members) {
          if (!users.find((u) => u.username === m.login)) {
            users.push({ username: m.login, name: m.login, avatar: m.avatar_url });
          }
        }
      }
    } catch {
      // org access might not be available
    }

    const filtered = query
      ? users.filter((u) => u.username.toLowerCase().includes(query) || u.name.toLowerCase().includes(query))
      : users;

    return NextResponse.json(filtered);
  }

  if (source === "linear") {
    const client = new LinearClient({ apiKey: process.env.LINEAR_API_KEY! });
    const org = await client.organization;
    const usersRes = await org.users({ first: 100 });

    const users = usersRes.nodes
      .filter((u) => u.active)
      .map((u) => ({ id: u.id, email: u.email, name: u.displayName, avatar: u.avatarUrl }));

    const filtered = query
      ? users.filter((u) => u.name.toLowerCase().includes(query) || (u.email?.toLowerCase().includes(query) ?? false))
      : users;

    return NextResponse.json(filtered);
  }

  return NextResponse.json({ error: "Unknown source" }, { status: 400 });
}
