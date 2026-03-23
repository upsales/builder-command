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
  status: "queued" | "running" | "waiting" | "completed" | "failed" | "cancelled" | "aborted" | "stale" | "parked";
  sessionType: string;
  sessionSubtype: string | null;
  sessionMode: string | null;
  branch: string | null;
  prUrl: string | null;
  prNumber: number | null;
  prMergedAt: string | null;
  linearUrl: string | null;
  summary: string | null;
  needsReply: boolean;
  testingStatus: string | null;
  totalCostUsd: number | null;
  runtimeState: string | null;
  profileName: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  url: string;
}

export async function fetchSessions(filterEmail?: string): Promise<ClankerSession[]> {
  const res = await fetch(`${CLANKER_URL}/api/sessions?limit=50`, {
    headers: headers(),
  });
  if (!res.ok) {
    throw new Error(`Clanker API error: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  let sessions: unknown[] = Array.isArray(data) ? data : ([
    ...(data.active ?? []), ...(data.waiting ?? []), ...(data.completed ?? []),
    ...(data.failed ?? []), ...(data.aborted ?? []), ...(data.stale ?? []),
    ...(data.parked ?? []), ...(data.sessions ?? []), ...(data.items ?? []),
  ]);
  // Filter by user email if provided
  const email = filterEmail || process.env.CLANKER_USER_EMAIL;
  if (email) {
    sessions = sessions.filter((s: unknown) => {
      const raw = s as Record<string, unknown>;
      return String(raw.profileEmail ?? "").toLowerCase() === email.toLowerCase();
    });
  }
  return sessions.map((s: unknown) => {
    const raw = s as Record<string, unknown>;
    // Map API status to our status enum
    const apiStatus = String(raw.status ?? "queued");
    const status = apiStatus === "active" ? "running" : apiStatus as ClankerSession["status"];
    return {
      id: String(raw.id ?? ""),
      prompt: String(raw.title ?? raw.prompt ?? ""),
      repo: raw.repoName ? String(raw.repoName) : (raw.repo ? String(raw.repo) : null),
      status: status ?? "queued",
      sessionType: String(raw.sessionType ?? raw.session_type ?? "code"),
      sessionSubtype: raw.sessionSubtype ? String(raw.sessionSubtype) : null,
      sessionMode: raw.sessionMode ? String(raw.sessionMode) : null,
      branch: raw.branch ? String(raw.branch) : null,
      prUrl: raw.prUrl ? String(raw.prUrl) : (raw.pr_url ? String(raw.pr_url) : null),
      prNumber: raw.prNumber ? Number(raw.prNumber) : (raw.pr_number ? Number(raw.pr_number) : null),
      prMergedAt: raw.prMergedAt ? String(raw.prMergedAt) : null,
      linearUrl: raw.linearUrl ? String(raw.linearUrl) : null,
      summary: raw.summary ? String(raw.summary) : null,
      needsReply: Boolean(raw.needsReply),
      testingStatus: raw.testingStatus ? String(raw.testingStatus) : null,
      totalCostUsd: raw.totalCostUsd ? Number(raw.totalCostUsd) : null,
      runtimeState: raw.runtimeState ? String(raw.runtimeState) : null,
      profileName: raw.profileName ? String(raw.profileName) : null,
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
