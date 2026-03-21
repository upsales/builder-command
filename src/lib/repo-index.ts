import { getDb } from "./db";
import { getRepoPath, isRepoReady } from "./repo-cache";
import { execSync } from "child_process";
import Anthropic from "@anthropic-ai/sdk";

// --- Types ---

export interface RepoIndex {
  repo: string;
  summary: string;
  architecture: string | null;
  patterns: string | null;
  key_modules: string | null;
  dependencies: string | null;
  fragile_areas: string | null;
  ownership: string | null;
  indexed_at: string;
  commit_sha: string | null;
  status: string;
}

export interface ModuleIndex {
  id: number;
  repo: string;
  module_path: string;
  description: string;
  exports: string | null;
  dependencies: string | null;
  coupling_notes: string | null;
}

// Track which repos are currently being indexed
const indexingRepos = new Set<string>();

// --- Queries ---

export function getRepoIndex(repo: string): RepoIndex | null {
  const db = getDb();
  return db.prepare("SELECT * FROM repo_index WHERE repo = ?").get(repo) as RepoIndex | undefined ?? null;
}

export function getAllRepoIndexes(): RepoIndex[] {
  const db = getDb();
  return db.prepare("SELECT * FROM repo_index ORDER BY indexed_at DESC").all() as RepoIndex[];
}

export function getModuleIndex(repo: string): ModuleIndex[] {
  const db = getDb();
  return db.prepare("SELECT * FROM repo_index_modules WHERE repo = ? ORDER BY module_path").all(repo) as ModuleIndex[];
}

export function isIndexing(repo: string): boolean {
  return indexingRepos.has(repo);
}

// --- Repo analysis helpers ---

function getRepoHeadSha(repoPath: string): string | null {
  try {
    return execSync("git rev-parse HEAD", { cwd: repoPath, timeout: 5000, encoding: "utf-8", stdio: "pipe" }).trim();
  } catch { return null; }
}

function getRepoTree(repoPath: string): string {
  try {
    // Get full file tree, filtered to code files
    const result = execSync(
      'git ls-tree -r --name-only HEAD | grep -E "\\.(ts|tsx|js|jsx|py|rb|go|rs|java|kt|swift|c|cpp|h|css|scss|json|yaml|yml|toml|md)$" | head -500',
      { cwd: repoPath, timeout: 10000, encoding: "utf-8", maxBuffer: 512 * 1024 }
    );
    return result || "(empty)";
  } catch { return "(unable to list files)"; }
}

function getRepoPackageInfo(repoPath: string): string {
  // Try to read package.json, Cargo.toml, go.mod, requirements.txt, etc.
  const manifests = [
    "package.json", "Cargo.toml", "go.mod", "requirements.txt",
    "pyproject.toml", "Gemfile", "pom.xml", "build.gradle",
  ];
  const results: string[] = [];
  for (const manifest of manifests) {
    try {
      const content = execSync(`git show HEAD:${manifest}`, {
        cwd: repoPath, timeout: 5000, encoding: "utf-8", maxBuffer: 256 * 1024,
      });
      const truncated = content.length > 3000 ? content.slice(0, 3000) + "\n...(truncated)" : content;
      results.push(`--- ${manifest} ---\n${truncated}`);
    } catch { /* file doesn't exist */ }
  }
  return results.join("\n\n") || "(no manifest files found)";
}

function getRepoReadme(repoPath: string): string {
  for (const name of ["README.md", "readme.md", "README.rst", "README"]) {
    try {
      const content = execSync(`git show HEAD:${name}`, {
        cwd: repoPath, timeout: 5000, encoding: "utf-8", maxBuffer: 256 * 1024,
      });
      return content.length > 4000 ? content.slice(0, 4000) + "\n...(truncated)" : content;
    } catch { /* try next */ }
  }
  return "(no README found)";
}

function sampleKeyFiles(repoPath: string, tree: string): string {
  // Pick a representative sample of files to read for deeper understanding
  const lines = tree.split("\n").filter(Boolean);
  const priorities: { pattern: RegExp; weight: number }[] = [
    { pattern: /^src\/(index|main|app|server)\.(ts|js|tsx|jsx)$/, weight: 10 },
    { pattern: /(config|setup)\.(ts|js|json)$/, weight: 8 },
    { pattern: /^src\/lib\//, weight: 7 },
    { pattern: /^src\/app\//, weight: 6 },
    { pattern: /routes?\.(ts|js)$/, weight: 6 },
    { pattern: /schema\.(ts|js|prisma|graphql)$/, weight: 8 },
    { pattern: /types?\.(ts|d\.ts)$/, weight: 5 },
    { pattern: /middleware/, weight: 5 },
    { pattern: /^src\//, weight: 3 },
    { pattern: /^lib\//, weight: 3 },
  ];

  const scored = lines.map(file => {
    let score = 0;
    for (const p of priorities) {
      if (p.pattern.test(file)) score += p.weight;
    }
    // Boost shallow files (closer to root = more architectural)
    const depth = file.split("/").length;
    score += Math.max(0, 5 - depth);
    return { file, score };
  }).sort((a, b) => b.score - a.score);

  // Read top 15 files
  const selected = scored.slice(0, 15);
  const results: string[] = [];
  for (const { file } of selected) {
    try {
      let content = execSync(`git show HEAD:${file}`, {
        cwd: repoPath, timeout: 5000, encoding: "utf-8", maxBuffer: 128 * 1024,
      });
      if (content.length > 2000) content = content.slice(0, 2000) + "\n...(truncated)";
      results.push(`--- ${file} ---\n${content}`);
    } catch { /* skip */ }
  }
  return results.join("\n\n") || "(no files read)";
}

// --- Main indexing function ---

export async function indexRepo(repo: string): Promise<RepoIndex | null> {
  if (indexingRepos.has(repo)) {
    console.log(`[repo-index] Already indexing ${repo}, skipping`);
    return getRepoIndex(repo);
  }

  const repoPath = getRepoPath(repo);
  if (!repoPath) {
    console.log(`[repo-index] Repo ${repo} not cloned, cannot index`);
    return null;
  }

  const currentSha = getRepoHeadSha(repoPath);
  const existing = getRepoIndex(repo);
  if (existing && existing.status === "ready" && existing.commit_sha === currentSha) {
    console.log(`[repo-index] Repo ${repo} already indexed at ${currentSha}`);
    return existing;
  }

  indexingRepos.add(repo);
  const db = getDb();

  // Mark as indexing
  db.prepare(
    "INSERT INTO repo_index (repo, summary, status, commit_sha) VALUES (?, '', 'indexing', ?) ON CONFLICT(repo) DO UPDATE SET status = 'indexing', commit_sha = ?"
  ).run(repo, currentSha, currentSha);

  try {
    console.log(`[repo-index] Starting index of ${repo}...`);

    // Gather repo context
    const tree = getRepoTree(repoPath);
    const packageInfo = getRepoPackageInfo(repoPath);
    const readme = getRepoReadme(repoPath);
    const fileSamples = sampleKeyFiles(repoPath, tree);

    // Use Claude to analyze the repo
    const client = new Anthropic();
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4000,
      messages: [{
        role: "user",
        content: `Analyze this codebase and produce a structured understanding. Be concise but thorough.

## Repository: ${repo}

## README
${readme}

## File Tree
${tree}

## Package/Dependency Info
${packageInfo}

## Key File Contents
${fileSamples}

Respond in this exact JSON format:
{
  "summary": "1-2 sentence overview of what this project is and does",
  "architecture": "Description of the architecture pattern (monolith, microservices, etc.), key layers, and how data flows. 3-5 sentences.",
  "patterns": "Coding patterns used: state management, error handling, testing approach, API patterns. 2-4 sentences.",
  "key_modules": "JSON array of the most important modules/directories with their purpose, e.g. [{\"path\": \"src/lib\", \"role\": \"Core business logic\"}]",
  "dependencies": "Key external dependencies and what they're used for. Focus on the important ones, not every package.",
  "fragile_areas": "Areas that look tightly coupled, complex, or likely to break if modified. Be specific about file paths and why.",
  "ownership": "If discernible from code structure, who/what teams own which areas. Otherwise note 'Not discernible from code'.",
  "modules": [
    {
      "module_path": "src/lib/db.ts",
      "description": "What this module does",
      "exports": "Key exports: functionA, functionB, ClassC",
      "dependencies": "What it imports from",
      "coupling_notes": "What depends on this, what would break if changed"
    }
  ]
}

Only return valid JSON. No markdown fences.`
      }]
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    // Extract JSON — handle potential markdown fences
    const jsonStr = text.replace(/^```json?\n?/, "").replace(/\n?```$/, "").trim();
    const analysis = JSON.parse(jsonStr);

    // Persist the high-level index
    db.prepare(`
      UPDATE repo_index SET
        summary = ?, architecture = ?, patterns = ?, key_modules = ?,
        dependencies = ?, fragile_areas = ?, ownership = ?,
        indexed_at = datetime('now'), commit_sha = ?, status = 'ready'
      WHERE repo = ?
    `).run(
      analysis.summary,
      analysis.architecture,
      analysis.patterns,
      typeof analysis.key_modules === "string" ? analysis.key_modules : JSON.stringify(analysis.key_modules),
      analysis.dependencies,
      analysis.fragile_areas,
      analysis.ownership,
      currentSha,
      repo,
    );

    // Persist module-level entries
    const upsertModule = db.prepare(`
      INSERT INTO repo_index_modules (repo, module_path, description, exports, dependencies, coupling_notes)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(repo, module_path) DO UPDATE SET
        description = excluded.description, exports = excluded.exports,
        dependencies = excluded.dependencies, coupling_notes = excluded.coupling_notes
    `);

    if (Array.isArray(analysis.modules)) {
      const insertMany = db.transaction((modules: typeof analysis.modules) => {
        for (const mod of modules) {
          upsertModule.run(
            repo, mod.module_path, mod.description,
            mod.exports ?? null, mod.dependencies ?? null, mod.coupling_notes ?? null
          );
        }
      });
      insertMany(analysis.modules);
    }

    console.log(`[repo-index] Finished indexing ${repo} (${analysis.modules?.length ?? 0} modules)`);
    indexingRepos.delete(repo);
    return getRepoIndex(repo);

  } catch (err) {
    console.error(`[repo-index] Failed to index ${repo}:`, err);
    db.prepare("UPDATE repo_index SET status = 'error' WHERE repo = ?").run(repo);
    indexingRepos.delete(repo);
    return null;
  }
}

/** Trigger indexing in the background. Returns immediately. */
export function indexRepoBackground(repo: string): void {
  if (indexingRepos.has(repo) || !isRepoReady(repo)) return;
  const existing = getRepoIndex(repo);
  const repoPath = getRepoPath(repo);
  if (existing?.status === "ready" && repoPath) {
    const currentSha = getRepoHeadSha(repoPath);
    if (existing.commit_sha === currentSha) return; // Already up to date
  }
  indexRepo(repo).catch(err => console.error(`[repo-index] Background index failed for ${repo}:`, err));
}

/** Query the index for a specific repo — returns a formatted summary for the agent. */
export function queryRepoIndex(repo: string, question?: string): string {
  const index = getRepoIndex(repo);
  if (!index || index.status !== "ready") {
    if (index?.status === "indexing") return `Repository ${repo} is currently being indexed. Try again in a moment.`;
    return `Repository ${repo} has not been indexed yet. Use clone_repo first, then the index will be built automatically.`;
  }

  const modules = getModuleIndex(repo);

  let result = `# Codebase Index: ${repo}
**Indexed at:** ${index.indexed_at} (commit: ${index.commit_sha?.slice(0, 8) ?? "unknown"})

## Summary
${index.summary}

## Architecture
${index.architecture}

## Patterns
${index.patterns}

## Key Modules
${index.key_modules}

## Dependencies
${index.dependencies}

## Fragile Areas
${index.fragile_areas}

## Ownership
${index.ownership}`;

  if (modules.length > 0) {
    result += `\n\n## Module Details (${modules.length} indexed)`;
    for (const mod of modules) {
      result += `\n\n### ${mod.module_path}`;
      result += `\n${mod.description}`;
      if (mod.exports) result += `\nExports: ${mod.exports}`;
      if (mod.coupling_notes) result += `\nCoupling: ${mod.coupling_notes}`;
    }
  }

  return result;
}

/** Get a compact summary of all indexed repos for system prompt injection. */
export function getIndexedReposSummary(): string {
  const indexes = getAllRepoIndexes().filter(i => i.status === "ready");
  if (indexes.length === 0) return "";

  return indexes.map(idx => {
    const modules = getModuleIndex(idx.repo);
    const keyMods = modules.slice(0, 5).map(m => `  - ${m.module_path}: ${m.description}`).join("\n");
    return `### ${idx.repo}
${idx.summary}
Architecture: ${idx.architecture?.split(".")[0] ?? "Unknown"}.
Fragile: ${idx.fragile_areas?.split(".")[0] ?? "None noted"}.
${keyMods ? `Key modules:\n${keyMods}` : ""}`;
  }).join("\n\n");
}
