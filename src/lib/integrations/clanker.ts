const CLANKER_URL = process.env.CLANKER_URL || "https://clanker.upsales.com";
const CLANKER_API_KEY = process.env.CLANKER_API_KEY || "";

function headers(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (CLANKER_API_KEY) h["X-API-Key"] = CLANKER_API_KEY;
  return h;
}

export interface ClankerSession {
  id: string;
  prompt: string;
  repo: string | null;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  sessionType: string;
  branch: string | null;
  prUrl: string | null;
  prNumber: number | null;
  summary: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  url: string;
}

export async function fetchSessions(): Promise<ClankerSession[]> {
  const res = await fetch(`${CLANKER_URL}/api/sessions?limit=50`, {
    headers: headers(),
  });
  if (!res.ok) {
    throw new Error(`Clanker API error: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  const sessions: unknown[] = Array.isArray(data) ? data : (data.sessions ?? data.items ?? []);
  return sessions.map((s: unknown) => {
    const raw = s as Record<string, unknown>;
    return {
      id: String(raw.id ?? ""),
      prompt: String(raw.prompt ?? raw.title ?? ""),
      repo: raw.repo ? String(raw.repo) : null,
      status: (raw.status as ClankerSession["status"]) ?? "queued",
      sessionType: String(raw.sessionType ?? raw.session_type ?? "code"),
      branch: raw.branch ? String(raw.branch) : null,
      prUrl: raw.prUrl ? String(raw.prUrl) : (raw.pr_url ? String(raw.pr_url) : null),
      prNumber: raw.prNumber ? Number(raw.prNumber) : (raw.pr_number ? Number(raw.pr_number) : null),
      summary: raw.summary ? String(raw.summary) : null,
      createdAt: String(raw.createdAt ?? raw.created_at ?? new Date().toISOString()),
      updatedAt: String(raw.updatedAt ?? raw.updated_at ?? new Date().toISOString()),
      completedAt: raw.completedAt ? String(raw.completedAt) : (raw.completed_at ? String(raw.completed_at) : null),
      url: `${CLANKER_URL}/session/${raw.id}`,
    };
  });
}

export async function fetchSession(sessionId: string): Promise<ClankerSession | null> {
  const res = await fetch(`${CLANKER_URL}/api/sessions/${sessionId}`, {
    headers: headers(),
  });
  if (!res.ok) return null;
  const raw = await res.json() as Record<string, unknown>;
  return {
    id: String(raw.id ?? ""),
    prompt: String(raw.prompt ?? raw.title ?? ""),
    repo: raw.repo ? String(raw.repo) : null,
    status: (raw.status as ClankerSession["status"]) ?? "queued",
    sessionType: String(raw.sessionType ?? raw.session_type ?? "code"),
    branch: raw.branch ? String(raw.branch) : null,
    prUrl: raw.prUrl ? String(raw.prUrl) : (raw.pr_url ? String(raw.pr_url) : null),
    prNumber: raw.prNumber ? Number(raw.prNumber) : (raw.pr_number ? Number(raw.pr_number) : null),
    summary: raw.summary ? String(raw.summary) : null,
    createdAt: String(raw.createdAt ?? raw.created_at ?? new Date().toISOString()),
    updatedAt: String(raw.updatedAt ?? raw.updated_at ?? new Date().toISOString()),
    completedAt: raw.completedAt ? String(raw.completedAt) : (raw.completed_at ? String(raw.completed_at) : null),
    url: `${CLANKER_URL}/session/${raw.id}`,
  };
}

export async function createSession(opts: {
  prompt: string;
  repo?: string;
  sessionType?: string;
  createPrAutomatically?: boolean;
  linearUrl?: string;
  profileId?: string;
  profileName?: string;
  profileEmail?: string;
}): Promise<ClankerSession> {
  const res = await fetch(`${CLANKER_URL}/api/sessions`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(opts),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Clanker create session failed: ${res.status} ${err}`);
  }
  const raw = await res.json() as Record<string, unknown>;
  return {
    id: String(raw.id ?? ""),
    prompt: String(raw.prompt ?? opts.prompt),
    repo: raw.repo ? String(raw.repo) : (opts.repo ?? null),
    status: (raw.status as ClankerSession["status"]) ?? "queued",
    sessionType: String(raw.sessionType ?? opts.sessionType ?? "code"),
    branch: raw.branch ? String(raw.branch) : null,
    prUrl: raw.prUrl ? String(raw.prUrl) : null,
    prNumber: raw.prNumber ? Number(raw.prNumber) : null,
    summary: raw.summary ? String(raw.summary) : null,
    createdAt: String(raw.createdAt ?? raw.created_at ?? new Date().toISOString()),
    updatedAt: String(raw.updatedAt ?? raw.updated_at ?? new Date().toISOString()),
    completedAt: raw.completedAt ? String(raw.completedAt) : null,
    url: `${CLANKER_URL}/session/${raw.id}`,
  };
}

export async function fetchRepos(): Promise<{ name: string }[]> {
  const res = await fetch(`${CLANKER_URL}/api/repos`, { headers: headers() });
  if (!res.ok) return [];
  return res.json();
}
