---
description: Extended PR review — scope to main, run the code-review skill with project invariants, add security + e2e-coverage passes. Defaults to the local branch vs main; pass a PR# or branch to target that instead.
argument-hint: "[PR# | branch]   (optional; default: local HEAD vs main)"
---

# Extended PR review

A project-aware review gate. Keep it **thin**: the **code-review** skill does the
actual bug-finding — your job is to scope it, route it to the right project
invariants, and add the passes the base review doesn't run. The skills stay the
single source of truth; do **not** restate their rules here, read them.

## Scope

Target: **$ARGUMENTS** — a PR number or branch. If empty, review the local branch
against `main`.

Changed files vs main:

!`git diff main...HEAD --stat 2>/dev/null || git diff main...HEAD`

If `$ARGUMENTS` names a PR or branch, review **that** target's diff instead (fetch
the PR / `git diff main...<branch>` as appropriate).

## Steps

1. **Map the change.** From the diff above, list which areas changed and the
   skill that owns each:
   - `packages/*/admin` → **admin-plugin** (+ **accessibility** for any UI)
   - `packages/*/server` → **server-plugin**
   - `packages/design-system` → **shadcn** (+ **accessibility**)
   - `apps/*-e2e` → **admin-e2e** / **server-e2e**

2. **Run the base review.** Invoke the **code-review** skill at **high** effort
   over the same scope (`main...HEAD`, or the given target). Let it do the
   multi-angle finding + verification — don't reimplement it.

3. **Cross-check project invariants.** For each changed area, open the matching
   skill's **"review-critical"** section and confirm the diff honors it (read the
   rules from the skill, don't restate them):
   - **server** → permission-by-constant guards; lock contended invariants
     (no count-then-write); preserve filters/validation when consolidating an
     endpoint; no enumeration signal.
   - **admin** → clamp `page` to `pageCount` after mutations; `isError` has its
     own state (not the empty state); mapper fallbacks must not rewrite data on
     save; permission strings mirror the server's matrix.
   - **UI** → the accessibility non-negotiables (tables, dialogs, landmarks /
     skip link, live regions, labelled controls).

4. **Security pass.** If any server auth / permission / session / token / DTO file
   changed, also run the **security-review** skill over the diff.

5. **Test-coverage gate.** Flag any **new** server controller (an endpoint) or
   admin page/route that has **no** corresponding e2e suite under
   `apps/server-e2e` / `apps/admin-e2e`.

6. **Report.** Merge everything into one deduped list, ranked most-severe first
   (correctness > security > a11y > cleanup), each finding as `file:line` + a
   concrete failure scenario. List any missing tests separately. If the caller
   passed `--comment`, post the findings as inline PR comments through the
   code-review skill.
