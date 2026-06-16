---
description: Push the current branch and open a PR against main, always filling the repo PR template — including a diff-tailored manual testing checklist.
argument-hint: "[base branch]   (optional; default: main)"
---

# Open PR

Push the current branch and open a pull request whose body follows the repo's
`.github/PULL_REQUEST_TEMPLATE.md` — **with the Manual testing checklist filled
in from the actual diff**, never left as the skeleton. This is the whole point
of the command: a reviewer should get a concrete, clickable QA list every time.

Base branch: **$ARGUMENTS** (default `main`).

## Context

Current branch:

!`git rev-parse --abbrev-ref HEAD`

Commits vs main:

!`git log --oneline main..HEAD 2>/dev/null || echo "(none)"`

Diff stat (committed + working tree):

!`git diff main...HEAD --stat 2>/dev/null; git status --short`

Existing PR for this branch, if any:

!`gh pr view --json url,state 2>/dev/null || echo "(gh unavailable or no PR — see Create step)"`

## Steps

1. **Stop if there's nothing to PR** — branch already merged, or no commits vs
   base. If there are uncommitted changes, ask whether to commit them first
   (don't commit silently); a PR off a dirty tree omits that work.

2. **Push** the branch (`git push -u origin HEAD` if it has no upstream).

3. **Read** `.github/PULL_REQUEST_TEMPLATE.md` — it is the source of truth for
   the body's shape. Keep its sections; fill them.

4. **Build the body from the diff**, not from memory:
   - **Summary** — the user-facing flows and the server endpoints/schema the
     diff touches (read the diff, name real files/routes).
   - **Test plan** — check the `nx typecheck`/`lint` boxes you actually ran;
     leave the CI boxes unchecked.
   - **Manual testing checklist — the required part.** Replace the template's
     placeholder sections with one section per changed area, each a few concrete
     `- [ ]` steps (what to click → what to expect). Always include:
       - the happy path for every new/changed flow;
       - edge cases — validation limits, empty/loading/**error ≠ empty** states,
         permission-gated variants (read-only / lower-role), pagination/count
         boundaries after a mutation;
       - a ⭐ check for **every bug this PR fixes** — the exact repro, now
         passing (especially regressions e2e can't easily cover);
       - accessibility/keyboard — tab order, accessible names, dialog focus
         trap + return, toast/live-region announcements.
     Open with a one-line **Setup:** naming the data/accounts a reviewer needs.
     Delete template sections that genuinely don't apply; never ship the
     untouched skeleton.

5. **Create the PR** against the base with the title following the repo's commit
   convention (e.g. `feat(users): …`). Prefer `gh pr create`. If `gh` is not
   installed, fall back to the GitHub REST API with the stored credential —
   without printing the token:

   ```bash
   TOKEN=$(printf 'protocol=https\nhost=github.com\n\n' | git credential fill 2>/dev/null | sed -n 's/^password=//p')
   PAYLOAD=$(python3 -c 'import json; print(json.dumps({"title":"…","head":"<branch>","base":"main","body":open("/tmp/pr_body.md").read()}))')
   curl -sS -X POST -H "Authorization: token ${TOKEN}" -H "Accept: application/vnd.github+json" \
     https://api.github.com/repos/<owner>/<repo>/pulls -d "$PAYLOAD"
   ```

   If a PR already exists for the branch, **update** its body instead of
   creating a duplicate (`gh pr edit` / `PATCH …/pulls/:n`).

6. **Report** the PR URL.

End the PR body with:
🤖 Generated with [Claude Code](https://claude.com/claude-code)
