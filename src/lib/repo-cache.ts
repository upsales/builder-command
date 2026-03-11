import { exec, execSync } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";

const execAsync = promisify(exec);

const REPOS_DIR = path.join(process.cwd(), "data", "repos");

function ensureReposDir() {
  if (!fs.existsSync(REPOS_DIR)) {
    fs.mkdirSync(REPOS_DIR, { recursive: true });
  }
}

function repoLocalPath(repo: string): string {
  return path.join(REPOS_DIR, repo.replace("/", "__"));
}

// Track which repos are currently cloning and which are ready
const cloningRepos = new Set<string>();
const readyRepos = new Set<string>();

/** Check if a repo is cloned and ready. */
export function isRepoReady(repo: string): boolean {
  if (readyRepos.has(repo)) return true;
  const localPath = repoLocalPath(repo);
  if (fs.existsSync(path.join(localPath, ".git"))) {
    // Verify it has actual commits (not a broken clone)
    try {
      const head = fs.readFileSync(path.join(localPath, ".git", "HEAD"), "utf-8").trim();
      if (head) {
        readyRepos.add(repo);
        return true;
      }
    } catch { /* not ready */ }
  }
  return false;
}

/** Check if a repo is currently being cloned. */
export function isRepoCloning(repo: string): boolean {
  return cloningRepos.has(repo);
}

/** Get the local path for a repo (only if ready). */
export function getRepoPath(repo: string): string | null {
  if (!isRepoReady(repo)) return null;
  return repoLocalPath(repo);
}

/** Get status of all tracked repos. */
export function getRepoStatuses(): Record<string, "ready" | "cloning" | "unknown"> {
  const statuses: Record<string, "ready" | "cloning" | "unknown"> = {};
  for (const repo of readyRepos) statuses[repo] = "ready";
  for (const repo of cloningRepos) statuses[repo] = "cloning";
  return statuses;
}

/** Start cloning a repo in the background. Returns immediately. */
export function cloneRepoBackground(repo: string): void {
  if (isRepoReady(repo) || cloningRepos.has(repo)) return;

  ensureReposDir();
  const localPath = repoLocalPath(repo);

  // If there's a broken clone, remove it
  if (fs.existsSync(localPath)) {
    fs.rmSync(localPath, { recursive: true, force: true });
  }

  const token = process.env.GITHUB_TOKEN;
  const url = token
    ? `https://x-access-token:${token}@github.com/${repo}.git`
    : `https://github.com/${repo}.git`;

  cloningRepos.add(repo);
  console.log(`[repo-cache] Starting background clone of ${repo}`);

  execAsync(`git clone --depth 50 --no-single-branch "${url}" "${localPath}"`, {
    timeout: 300000, // 5 min for large repos
  }).then(() => {
    cloningRepos.delete(repo);
    readyRepos.add(repo);
    console.log(`[repo-cache] Finished cloning ${repo}`);
  }).catch((err) => {
    cloningRepos.delete(repo);
    console.error(`[repo-cache] Failed to clone ${repo}:`, err.message);
    // Clean up partial clone
    if (fs.existsSync(localPath)) {
      fs.rmSync(localPath, { recursive: true, force: true });
    }
  });
}

/** Fetch a PR branch (async). */
export async function fetchPRBranch(repo: string, prNumber: number): Promise<void> {
  const localPath = repoLocalPath(repo);
  if (!fs.existsSync(path.join(localPath, ".git"))) return;
  try {
    await execAsync(`git fetch origin pull/${prNumber}/head:pr-${prNumber} --force`, {
      cwd: localPath,
      timeout: 30000,
    });
  } catch {
    // PR ref fetch failed, not critical
  }
}

/** Sync clone/update a repo. Returns the local path. Used by chat tools. */
export function ensureRepo(repo: string): string {
  ensureReposDir();
  const localPath = repoLocalPath(repo);
  if (fs.existsSync(path.join(localPath, ".git"))) {
    return localPath;
  }
  const token = process.env.GITHUB_TOKEN;
  const url = token
    ? `https://x-access-token:${token}@github.com/${repo}.git`
    : `https://github.com/${repo}.git`;
  execSync(`git clone --depth 50 --no-single-branch "${url}" "${localPath}"`, {
    timeout: 120000,
    stdio: "pipe",
  });
  readyRepos.add(repo);
  return localPath;
}

/** Search for a pattern in a cloned repo. */
export function searchRepo(repo: string, query: string, branch?: string): string {
  const localPath = repoLocalPath(repo);
  if (!fs.existsSync(path.join(localPath, ".git"))) return "(repo not cloned yet)";
  const ref = branch ?? "HEAD";
  try {
    const result = execSync(
      `git grep -n -I --max-count=30 -C 2 "${query.replace(/"/g, '\\"')}" ${ref} -- "*.ts" "*.tsx" "*.js" "*.jsx" "*.py" "*.rb" "*.go" "*.rs" "*.java" "*.css" "*.scss" "*.json" "*.yml" "*.yaml" "*.md"`,
      { cwd: localPath, timeout: 10000, encoding: "utf-8", maxBuffer: 1024 * 1024 },
    );
    return result.length > 15000 ? result.slice(0, 15000) + "\n... (truncated)" : result;
  } catch (e) {
    const error = e as { status?: number };
    if (error.status === 1) return "(no matches found)";
    return `(search error: ${e instanceof Error ? e.message : String(e)})`;
  }
}

/** Read a specific file from a cloned repo at a given ref. */
export function readRepoFile(repo: string, filePath: string, branch?: string): string {
  const localPath = repoLocalPath(repo);
  if (!fs.existsSync(path.join(localPath, ".git"))) return "(repo not cloned yet)";
  const ref = branch ?? "HEAD";
  try {
    const content = execSync(`git show ${ref}:${filePath}`, {
      cwd: localPath, timeout: 5000, encoding: "utf-8", maxBuffer: 1024 * 1024,
    });
    return content.length > 20000 ? content.slice(0, 20000) + "\n... (truncated)" : content;
  } catch {
    return "(file not found)";
  }
}

/** List files in a cloned repo directory. */
export function listRepoFiles(repo: string, dir: string, branch?: string): string {
  const localPath = repoLocalPath(repo);
  if (!fs.existsSync(path.join(localPath, ".git"))) return "(repo not cloned yet)";
  const ref = branch ?? "HEAD";
  try {
    const result = execSync(`git ls-tree --name-only ${ref} ${dir ? dir + "/" : ""}`, {
      cwd: localPath, timeout: 5000, encoding: "utf-8",
    });
    return result || "(empty directory)";
  } catch {
    return "(directory not found)";
  }
}

/** Fetch PR context with diff and file contents. */
export async function getPRCodeContext(repo: string, prNumber: number) {
  const localPath = repoLocalPath(repo);
  if (!fs.existsSync(path.join(localPath, ".git"))) {
    return { diff: "", files: [], baseBranch: "main", headBranch: `pr-${prNumber}` };
  }
  await fetchPRBranch(repo, prNumber);
  let baseBranch = "origin/main";
  try {
    execSync("git rev-parse origin/main", { cwd: localPath, timeout: 5000, stdio: "pipe" });
  } catch {
    baseBranch = "origin/master";
  }
  let diff = "";
  try {
    diff = execSync(`git diff ${baseBranch}...pr-${prNumber}`, {
      cwd: localPath, timeout: 10000, encoding: "utf-8", maxBuffer: 5 * 1024 * 1024,
    });
    if (diff.length > 30000) diff = diff.slice(0, 30000) + "\n... (truncated)";
  } catch { diff = "(diff unavailable)"; }
  return { diff, files: [], baseBranch: baseBranch.replace("origin/", ""), headBranch: `pr-${prNumber}` };
}
