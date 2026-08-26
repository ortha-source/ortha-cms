---
name: qa-pass-ticket
description: Working an Ortha CMS "QA · <package>" ticket (Linear ORT-*, project "OrthaCMS Phase 2 (QA)") — the ~40 same-structured tickets that verify one package against its generated test artifact. Covers triaging the package kind, reproducing findings against a live stack (server = curl+psql, admin = agent-browser, domain/provider = unit coverage), the tick-only-what-passes rule, the results-comment contract, post-merge re-verification, and the fix-then-PR loop when a finding needs code. Use when the user names an ORT-* QA ticket or asks to run/verify/close a package QA pass.
user-invocable: true
allowed-tools: Read, Edit, Write, Glob, Grep, Bash, Agent
---

# Ortha CMS QA-pass tickets

A **QA-pass ticket** is a Linear issue titled `QA · <package> — <path>` in the
project **OrthaCMS Phase 2 (QA)** (label `qa-pass`). Each verifies exactly one
workspace package against a **generated test artifact** — `docs/testing/<package>.md`
(readable in the checkout; the ticket links the GitHub copy at its top, on the
`claude/package-test-artifacts-*` branch). The ticket body is a condensed copy of
that artifact.

There are ~40 of them and they share one shape, so this skill is the repeatable
playbook. **Two are done as reference** — `ORT-54` (identity-server) and
`ORT-57` (identity-admin); read their comment threads for the tone and depth
expected.

## Ticket anatomy

Every ticket is a checklist in four sections, each a `- [ ]` box:

- **🐞 Findings to triage** — the bugs the artifact author already suspects.
  Each is `BUG-<package>-NN`, severity-ranked. These become real work.
- **Feature tests** (`F1`…`Fn`) — documented behaviour, many with step tables.
- **Edge cases** (`EC-01`…) — boundary and negative paths.
- **♿ Accessibility** (`A11Y-<package>-NN`) — WCAG/508 findings (admin/UI only).

The artifact carries a `file:line` citation behind every claim. **The claims are
static analysis, not observed behaviour** — your job is to observe.

## The three rules that never change

1. **Verify against a running system; never trust the artifact.** A box is a
   claim about the app nobody has watched. Reproduce it. The artifact is often
   right, sometimes stale, occasionally wrong — treat every step as a hypothesis.
2. **A tick means _passing_, not _executed_.** Only check `[x]` on a box you
   confirmed behaves as documented. A failing or blocked step stays unchecked and
   is explained in the comment. Never tick a box whose behaviour _is_ an open bug
   (e.g. the "inert control" feature tests are the bug — leave them unticked).
3. **Separate findings from unexercised checks.** "I ran it and it's wrong" and
   "I didn't run it" are different states and the comment must say which. Do not
   let an unexercised box read as a pass.

## Step 0 — triage the package kind (the biggest time lever)

The ~40 packages are **not uniform**. Decide the harness before booting anything:

| Kind | Examples | How to verify |
| -- | -- | -- |
| **server plugin** | identity-server, media-server, workspaces-server | Live boot + **curl + psql**. Reboot with env for config-dependent steps. |
| **admin plugin** | identity-admin, users-admin, content-admin | **agent-browser** against the dev stack. Fiber-tree cache introspection, video/screenshot evidence. |
| **domain / provider / utils / tools / bootstrap** | copilot-domain, provider-fake, utils-server, tools-server | **Mostly unit-test territory** — little or no live surface. Confirm the package's own `nx test` covers the claims; don't spin up a browser. `design-system` has no test files at all; `copilot-domain` is framework-free. |
| **app / e2e-harness** | app-server, admin-e2e | Assemble/run the whole thing; the "package" is the composition root or the test harness itself. |

If the kind is domain/provider/utils, most of the ticket is confirming unit
coverage and reading source — a 20-minute pass, not a live-stack expedition. Say
so in the comment rather than over-producing.

## Bringing the stack up

Needs Postgres (`docker compose up -d`) and a `.env` (already present in dev).

- **Whole stack:** `npm run dev` (admin `:4200` + API `:3000`). Wait for both:
  `/api/auth/me` returns any code (401 = up, unauthenticated) and `:4200` returns
  200.
- **API only, with env control** (server tickets need this — throttle limits,
  `NODE_ENV=production`, `TRUST_PROXY`, a changed root password): run the **built
  bundle directly**, not `nx serve`. Build once (`nx build server`), then
  `node --enable-source-maps apps/server/dist/main.js` with the env you want.
  This sidesteps two traps below and lets you reboot per-step in seconds.

Credentials: `ORTHA_ROOT_ADMIN_EMAIL` / `_PASSWORD` from `.env` provision the
root admin on boot. **Never echo them** — source `.env` into the subshell and
reference `$ORTHA_ROOT_ADMIN_PASSWORD`. There are no committed dev credentials.

## Gotchas that will cost you an hour if you don't know them

- **`admin-e2e` needs NO real API.** It mocks `/api` with `page.route`. If a
  server is live on `:3000`, the Vite proxy answers anything the mocks miss,
  `mockSignedIn` stops working, and **every page-level spec fails on a redirect
  to sign-in** — looking exactly like a broad regression when it is not.
  Measured: one spec = 14 failed with the API up, 15 passed with `:3000` down.
  **Free `:3000` and `:4200` before running admin-e2e.**
- **`pgrep -f` matches your own shell.** `pkill -f "dist/main.js"` or
  `for p in $(pgrep -f "nx serve")` will happily kill the command you are
  currently running (the pattern appears in your own `bash -c`). Kill by **port**
  instead: `ss -ltnp | grep ':3000' | grep -oP 'pid=\K[0-9]+'`, and guard any
  `pgrep` loop with `[ "$pid" != "$$" ]`.
- **`nx serve server` can deadlock two instances** waiting on each other's Nx
  lock, and leaves `dist/main.js` stale. Running the built bundle directly avoids
  it (see above). If you must use the watcher, know `node --watch` cannot recover
  from a missing `dist/main.js`.
- **agent-browser recordings truncate on `open`.** A full navigation during a
  take ends the video early on the pre-navigation frame. Navigate _before_
  `record start`, drive with `reload`, and verify the last frame with
  `ffmpeg -sseof -0.5 ... -frames:v 1`. (Fedora ffmpeg has no libx264 — WebM/VP8
  only, which Linear plays fine.)
- **Restart with `LOGIN_RATE_LIMIT` high for functional server tests**
  (`LOGIN_RATE_LIMIT=100000`), or a timing/loop step will exhaust the 10/min
  bucket and poison later steps with spurious 429s. Restore the default before
  finishing.

## Verification patterns by kind

### Server plugin — curl + psql

- Read the OpenAPI doc for schema-correct request bodies:
  `curl -s localhost:3000/reference/json` — it enumerates every path and DTO, so
  you build bodies from the contract instead of guessing.
- Mutations pass `OriginGuard`: send `-H 'Origin: http://localhost:4200'` or they
  403. Session is an httpOnly cookie: `-c jar.txt` on login, `-b jar.txt` after.
- **Assert DB state, not just status codes.** `docker exec ortha-postgres psql -U
  ortha -d ortha_cms -t -A -c "…"`. The valuable findings are "the row was
  written / not written / left untouched", which the HTTP response won't show.
- Config-dependent steps (throttle bucketing, `Secure` cookie, byte-vs-char
  limits) → reboot with the env, run, reboot back.

### Admin plugin — agent-browser

- Drive `:4200` only (the proxy keeps the cookie first-party); load the
  `agent-browser` skill first.
- Sign in through the UI, or seed via the API (`POST /api/users/invites` returns
  the raw token in the response — that's how you get a second account).
- **Cache / state findings** (e.g. "logout leaves the previous user's data")
  can't be seen from the DOM. Reach the TanStack QueryClient by walking the React
  fiber tree (`__reactFiber$…` → find an object with `getQueryCache`) and dump the
  cache in one `eval`. This whole class of check must happen **in one page load**
  — a reload resets the cache and hides the bug.
- Capture **video per finding** (small, ~50–200 KB WebM) and attach to the ticket
  (see the results contract). Verify the last frame shows the end state.

### Domain / provider / utils — unit coverage

- `nx test <project>`; read the specs against the artifact's claims. If a claimed
  rule has no test, that's the finding. If the package has no test target output,
  note it (design-system).

## The results contract — what to write back

**Tick** only the boxes you verified passing. Then post **one comment** with this
shape (see ORT-54 / ORT-57 for worked examples):

1. **One line of method** — what you ran it against (live stack? which harness?).
2. **🐞 Findings table** — each bug: Confirmed / Refuted / Confirmed-but-broader,
   with the concrete evidence (status codes, DB deltas, the exact repro). If a
   bug is worse or narrower than written, say so — the BUG-01 "memory-only, not
   rendered" qualifier on ORT-57 is the model.
3. **New findings** the artifact missed, at the same evidence bar.
4. **Corrections to the artifact** — stale expected values, off-by-one
   cross-references, steps that describe pre-fix behaviour. These are real value;
   list them so the next reader isn't misled.
5. **What's ticked** (grouped) and **what's not**, with _why_ for the not:
   unit-only, not-browser-reachable, belongs to a sibling ticket, deferred.
6. **A close/no-close recommendation.**

**Attach evidence to the ticket** with the Linear MCP upload flow:
`prepare_attachment_upload` → `PUT` the bytes to the signed URL (send every
signed header verbatim, use within 60s, one file at a time) →
`create_attachment_from_upload`.

## The loops

- **Post-merge re-verification.** When a fix PR merges, `git checkout main &&
  pull`, re-run the exact original repro against the merged code, then tick the
  bug boxes and post a short "verified on `main` @ `<sha>`" comment. Do **not**
  tick a bug box before its fix is verified on main — a QA tick means "confirmed
  fixed", not "someone wrote a fix".
- **Fix-then-PR, when a finding needs code.** Some tickets you'll also fix (the
  a11y findings on ORT-57). Branch, follow the target package's `AGENTS.md`
  conventions, **add the e2e/unit test that would have caught it**,
  typecheck + lint + run the affected suite, open a PR with the repo template
  (`/open-pr`), then re-verify after merge. Keep QA (this skill) and the fix as
  separate acts — tick on verification, not on authorship.

## Sequencing across the series

- **Do the server ticket before its admin twin.** The artifacts cross-reference:
  an admin finding ("bcrypt truncates the passphrase") is really the server's
  bug, and admin steps that force a 400/500 depend on server behaviour. We
  deferred F18/EC-05/EC-08 from ORT-57 to ORT-54 for exactly this reason. Pair
  `X-server` → `X-admin`.
- **Spin genuinely-new work into its own ticket** — never fold it into a QA
  "done". Password reset not existing, or a signed-in user being silently
  re-identified by an invite link, are product gaps, not QA boxes.
- **Closing standard.** A QA pass exists to surface defects. When every _finding_
  is fixed and verified, the ticket is closable even with unexercised checks
  remaining — but say so explicitly, and if the remaining checks are considered
  required coverage, move them to a follow-up sweep ticket rather than holding the
  ticket open. Most leftovers are unit-test territory or not-browser-reachable.

## Definition of done for one ticket

- Every 🐞 finding reproduced (or refuted with evidence), and re-verified on
  `main` if a fix merged.
- Every box you could reach is ticked-if-passing; the rest is accounted for in
  the comment.
- Artifact corrections and any new findings recorded.
- Evidence attached; a close/no-close recommendation given.
- New product gaps filed as their own tickets.
- Environment restored (default env, servers stopped, test data noted).
