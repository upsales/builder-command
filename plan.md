# Agent Code Execution: Closing the Loop

## The Gap

The agent today can **read** repos and **execute code** in a sandbox, but it can't do the actual engineering workflow:

1. **No git workflow tools** — Can't create branches, commit, push
2. **No PR creation** — Can't open PRs from the code it writes
3. **No PR review/approval** — Can't approve PRs or leave review comments
4. **Code edits are sandboxed** — `write_file`/`edit_file` only work in `data/workspace/`, not in cloned repos
5. **No CI awareness** — Can't check if tests pass before declaring "done"

## Implementation Plan

### Step 1: Git workflow tools in `chatTools.ts`

Add these new tools to the agent's toolbox:

**`git_create_branch`** — Create a branch on a cloned repo
- Input: `repo`, `branch_name`, `base_branch` (default: main)
- Runs: `git checkout -b {branch} origin/{base}` in the repo dir

**`git_commit`** — Stage and commit changes
- Input: `repo`, `message`, `files` (array of paths, or `"all"`)
- Runs: `git add` + `git commit` in the repo dir

**`git_push`** — Push a branch to origin
- Input: `repo`, `branch_name`
- Runs: `git push origin {branch}` using the GITHUB_TOKEN for auth

**`repo_write_file`** — Write a file directly in a cloned repo (not workspace)
- Input: `repo`, `path`, `content`, `branch` (optional — checkout first)
- Writes directly to the repo working tree

**`repo_edit_file`** — Find-and-replace in a repo file
- Input: `repo`, `path`, `find`, `replace`

### Step 2: PR creation & review tools in `github.ts` + `chatTools.ts`

**`create_pr`** — Open a pull request
- Input: `repo`, `head_branch`, `base_branch`, `title`, `body`
- Uses Octokit to create the PR
- Returns: PR number + URL

**`approve_pr`** — Submit an approving review
- Input: `repo`, `pr_number`, `body` (optional comment)
- Uses GitHub Reviews API: `POST /repos/{owner}/{repo}/pulls/{number}/reviews` with `event: "APPROVE"`

**`request_changes_pr`** — Submit a "request changes" review
- Input: `repo`, `pr_number`, `body`
- Same API with `event: "REQUEST_CHANGES"`

**`comment_pr`** — Leave a comment on a PR (not a review)
- Input: `repo`, `pr_number`, `body`
- Uses Issues API (comments)

### Step 3: CI/checks awareness

**`get_pr_checks`** — Get CI status for a PR
- Input: `repo`, `pr_number`
- Returns: check runs with name, status, conclusion
- Already partially available via `fetchPRDetails` but not exposed as a standalone tool

Combined with the existing `schedule_followup`, the agent can:
1. Push code → create PR → schedule followup in 5m
2. Wake up → check CI status → approve if green / flag if red

### Step 4: Auto-review policies (settings-based)

Add a new setting: `auto_review_policy` (stored in `settings` table)

```json
{
  "enabled": true,
  "auto_approve": {
    "max_files_changed": 5,
    "max_lines_changed": 100,
    "allowed_authors": ["dependabot", "renovate"],
    "required_checks_pass": true,
    "excluded_paths": ["src/lib/db.ts", "*.lock"]
  },
  "flag_for_review": {
    "large_pr_threshold": 500,
    "sensitive_paths": ["migrations/", "*.env*", "Dockerfile"]
  }
}
```

New tool: **`evaluate_pr_policy`** — Check a PR against the auto-review policy
- Fetches diff stats, author, file paths, check status
- Returns: "approve" | "flag" with reasons
- The agent calls this, then acts on the result

### Step 5: Wire it all together in the agent prompt

Update `buildAgentAppendPrompt()` to include the new tools and a "code execution workflow" section:

```
## Code Execution Workflow
When implementing features or fixes:
1. clone_repo → git_create_branch
2. Read existing code (search_code, read_file)
3. Make changes (repo_write_file, repo_edit_file)
4. git_commit → git_push → create_pr
5. schedule_followup to check CI
6. On resume: get_pr_checks → approve/flag/fix

## PR Review Workflow
When reviewing PRs:
1. Fetch PR details + diff
2. evaluate_pr_policy to check against auto-review rules
3. If policy says approve → approve_pr
4. If policy says flag → create_todo for user with summary
```

### Step 6: Register tools in MCP server

Update `agent-mcp-server.mts` to register the new tools so the autonomous agent can use them (not just chat).

## Files to modify

| File | Changes |
|------|---------|
| `src/lib/integrations/github.ts` | Add `createPR`, `submitReview`, `commentOnPR`, `getPRChecks` |
| `src/lib/chatTools.ts` | Add 9 new tools + executeTool cases |
| `src/lib/agent-mcp-server.mts` | Register new tools |
| `src/lib/agentRunner.ts` | Update agent prompt with new workflows |
| `src/lib/repo-cache.ts` | Add `getRepoWorkingTree()` helper for direct file writes |
| `src/lib/db.ts` | Add `auto_review_policy` default setting (no schema change needed — uses existing `settings` table) |
| `src/app/api/agent/settings/route.ts` | Expose review policy in settings UI |
