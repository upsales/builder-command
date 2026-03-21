# Plan: Review Follow-Through + E2E Validation + Auto-Review Trigger

## What we're building

Three improvements, each building on existing infrastructure:

### 1. Review Follow-Through (agent prompt + webhook enhancement)

**Problem:** Agent reviews PR once, gives feedback, but doesn't follow up. User has to manually check if clanker fixed the issues and re-review.

**Solution:** Two parts:

**A. Enhanced PR Review workflow in agent prompt** (`agentRunner.ts` lines 331-338)

Replace the current one-shot review instructions with a full review cycle:

```
## PR Review Workflow
When asked to review a PR:
1. Use get_pr_details to understand the PR (author, description, linked issues, existing reviews)
2. Use get_pr_diff to read the code changes
3. If the PR links to a Linear ticket, compare the changes against the ticket requirements.
   Flag anything the ticket asks for that the PR doesn't address.
4. Clone repo + read surrounding code if needed to understand context
5. Look for: bugs, logic errors, security issues, performance problems, missing edge cases,
   deviation from existing patterns, incomplete ticket requirements
6. Submit your review:
   - If issues found: submit_pr_review with event="REQUEST_CHANGES", include inline comments
   - If looks good: submit_pr_review with event="APPROVE"
   - Be constructive: explain WHY and suggest fixes
7. FOLLOW-THROUGH: If you requested changes, schedule_followup with delay="15m" and
   instruction="Re-review PR #{number} in {repo} — I previously requested changes. Check if
   the issues were addressed. If fixed, APPROVE. If partially fixed, REQUEST_CHANGES again
   with remaining issues. If no new commits, schedule_followup again with delay='30m'."
8. NEVER merge automatically — only APPROVE. The user decides when to merge.
```

**B. Webhook auto-trigger for re-review** (`webhooks/github/route.ts`)

When a PR gets a `synchronize` event (new commits pushed) AND the agent previously reviewed it with REQUEST_CHANGES, auto-create an agent task to re-review:

```typescript
// In the webhook handler, after existing logic:
if (event === "pull_request" && action === "synchronize") {
  // Check if we have a previous agent review session for this PR
  // If so, create a re-review task automatically
}
```

**Files to modify:**
- `src/lib/agentRunner.ts` — Update PR Review Workflow prompt section (lines 331-338)
- `src/app/api/webhooks/github/route.ts` — Add synchronize handler for auto re-review

### 2. Webhook-Triggered Auto-Review for Clanker PRs

**Problem:** When clanker creates a new PR, user has to manually trigger a review.

**Solution:** Detect clanker PRs on the `opened` webhook event and auto-create a review task.

**Detection:** The user said clanker PRs have multiple signals (bot author, branch pattern, labels, PR body format). We'll add a configurable setting for this.

**Implementation:**

Add a new setting `auto_review_config` (stored in DB settings table) with:
```json
{
  "enabled": true,
  "match": {
    "authors": ["clanker-bot", "clanker[bot]"],
    "branchPatterns": ["clanker/*"],
    "labels": ["clanker"]
  }
}
```

In the webhook handler:
```typescript
if (event === "pull_request" && action === "opened") {
  const config = getAutoReviewConfig();
  if (config.enabled && matchesClankerPR(pr, config.match)) {
    // Create agent task: "Review PR #{number} in {repo}"
    // with source=github, source_id=review-{repo}-{number}
  }
}
```

**Files to modify:**
- `src/app/api/webhooks/github/route.ts` — Add auto-review on PR opened
- `src/lib/db.ts` or `src/lib/items.ts` — Helper to read auto_review_config setting
- `src/app/page.tsx` — Add UI to configure auto-review settings (optional, can use settings modal)

### 3. E2E Smoke Test Workflow

**Problem:** No automated way to verify deploys work. User manually checks preview URLs.

**Solution:** Add a `verify_deploy` tool and an E2E workflow to the agent prompt. The agent uses `browse_web` (already available via Playwright) to navigate to the deploy preview and run basic checks.

**A. New tool: `get_deploy_preview_url`** (`chatTools.ts`)

Fetches the deploy preview URL from GitHub deployment status API:
```typescript
{
  name: "get_deploy_preview_url",
  description: "Get the deploy preview URL for a PR from GitHub deployment statuses (Vercel, Netlify, etc.)",
  input_schema: {
    properties: {
      repo: { type: "string" },
      pr_number: { type: "number" },
    }
  }
}
```

Implementation: Call GitHub API `GET /repos/{owner}/{repo}/deployments?environment=Preview&ref={branch}` then get deployment status URL.

**B. E2E workflow in agent prompt** (`agentRunner.ts`)

```
## E2E Deploy Verification
When asked to verify a deploy, or as part of a thorough PR review:
1. Use get_deploy_preview_url to find the preview URL (if available)
2. Use browse_web to navigate to the preview URL
3. Take a screenshot and verify the page loads without errors
4. If the PR has specific UI changes, navigate to the relevant pages and verify them
5. Check the browser console for errors (via browse_web screenshot)
6. If no preview URL: note that manual verification is needed
7. Report findings in the PR comment or review
```

**Files to modify:**
- `src/lib/chatTools.ts` — Add `get_deploy_preview_url` tool definition + handler
- `src/lib/integrations/github.ts` — Add `fetchDeployPreviewUrl()` function
- `src/lib/agentRunner.ts` — Add E2E workflow section to agent prompt

---

## Implementation Order

1. **Review follow-through prompt** — Pure prompt change, highest impact, zero risk
2. **Webhook re-review trigger** — Small code change, enables the follow-through loop
3. **Webhook auto-review for new PRs** — Config + webhook code, enables hands-off review
4. **E2E deploy verification** — New tool + prompt, enables automated smoke tests

## Constraints
- No auto-merge — agent can only APPROVE, user merges manually
- No destructive DB changes — settings stored in existing `settings` table
- Leverage existing tools (browse_web, schedule_followup, submit_pr_review) — minimal new code
