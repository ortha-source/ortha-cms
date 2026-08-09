# 0009 — The copilot applies its changes directly

- **Status:** Proposed
- **Date:** 2026-08-09
- **Deciders:** Engineering

> Amends [ADR-0005](0005-copilot-authority-model.md). §5 (writes produce
> proposals a human accepts) and §6 (direct apply is a per-workspace, per-tool
> opt-in) are **replaced** by this record. Everything else in ADR-0005 stands
> unchanged and is, if anything, load-bearing now: §1 (no copilot identity),
> §2–3 (the profile, recomputed per run and enforced at offer and execution),
> §7 (no publish tool), §8 (untrusted content), §9 (audit) and §10 (off by
> default, per-deployment).

## Context

ADR-0005 §5 made every copilot write a `copilot_proposals` row that a human
accepted through a card in the chat panel. §6 added an escape hatch: a
per-workspace, per-tool opt-in an admin could tick to skip the click.

Both shipped. What we learned from having them:

- **The opt-in screen is the feature nobody uses.** It defaults to every box
  unticked, it is behind an admin-only permission, and its own copy has to open
  by explaining that it is _not_ a permissions screen — because a page of empty
  checkboxes is read as a list of things you are forbidden to do. A
  configuration surface whose main job is apologising for the default is the
  wrong surface.
- **The review step is not review.** One request produces one card per change:
  "add alt text to every image in this article" is one sentence and twelve
  approvals. Nobody reads the twelfth. Clicking Apply twelve times is a queue
  being cleared, and a UI that rewards clearing it fast produces worse scrutiny
  than no ceremony at all — while still costing every user the ceremony.
- **It taught the wrong thing about authority.** Users reasonably read "Ortha AI
  needs your approval" as "Ortha AI could otherwise do more than you can". The
  opposite is true and always was: a run holds exactly the caller's permissions
  (§1–3), so a viewer's copilot is provably read-only whatever the policy says.
  The approval step obscured the guarantee it was supposed to express.
- **The pressure valve pushed the wrong way.** §6's opt-in is per tool, so a
  workspace tired of clicking turns on auto-apply for _every_ tool at once —
  arriving at this decision anyway, less deliberately, and with a screen and a
  table to maintain on the way.

What has not changed is the risk ADR-0005 was written about: entry bodies are
user-authored and attacker-influenceable, so a prompt injection can steer tool
selection. We accept that risk explicitly below rather than pretend it went
away.

## Decision

**A `propose` tool's change is applied the moment it is drafted.** The caller's
own permissions are the only gate.

1. **No approval step.** The run engine persists the `copilot_proposals` row and
   immediately applies it through the owning plugin's `ProposalApplier`. There
   is no `accept`, no `reject`, and no state in which a change sits waiting.

2. **The row stays, and is now the whole paper trail.** It is still written
   _before_ the apply, by the engine rather than the binder, so ADR-0005 §5's
   "undoable, never invisible" survives the loss of the human step — the change
   is recorded whether or not the write then succeeds. A binder that wrote
   directly instead of returning a draft would be a change with no receipt.

3. **`pending` now means the apply failed.** A failed apply reopens the row with
   its error, the run event carries the message, and the card says the change
   did not happen. Nothing retries it: the user asks again.

4. **The per-workspace policy is deleted** — `copilot_workspace_policies`, the
   `GET/PUT /api/copilot/policy` routes, the settings page and its nav entry.
   `copilot:configure` is removed from `PERMISSIONS` too; it gated nothing else.

5. **Offer-time filtering loses its second gate.** `resolveCapabilityProfile`
   decides on declared permissions alone; the `apply-not-enabled` withheld
   reason is gone. An `apply`-effect tool is offered exactly when a `read` one
   with the same `requires` would be.

6. **The kill switches stay, and are now the whole of the operator's control**:
   ADR-0005 §10's per-deployment `enabled` flag, `copilot:use` per role, and the
   workspace's content grants.

## Consequences

**Easier:**

- The product behaves the way its own copy already described: Ortha AI does what
  your role lets you do, and says what it did.
- One authority model to reason about instead of two. "What may this run do" has
  a single answer — the caller's grants — checked at offer and at execution.
- A whole surface deleted: a table, a migration, two routes, a permission key, a
  page, a nav entry, a query hook, two mutations and the accept boundary's
  concurrency handling.
- Bulk work stops being a clicking exercise, which removes the incentive that
  was pushing workspaces toward blanket auto-apply.

**Harder / the cost we accept, stated plainly:**

- **A successful prompt injection now writes.** Under §5 it cost the attacker a
  declined card; now it lands, bounded by the current user's permissions. It is
  still audited (§9), still revision-backed, and still cannot publish (§7) or
  reach another workspace — but "recoverable" and "noticed" are different
  things, and ADR-0005 said so while rejecting this as a default. We are
  choosing it as the default anyway, with eyes open, because the review step it
  replaces was not delivering the noticing it promised.
- **The audit log is now the only detection mechanism**, which raises the
  priority of surfacing it: a workspace should be able to see what the copilot
  changed without opening a chat thread. That is follow-up work, not shipped
  here, and it is the mitigation this decision leans on.
- **Undo is per entry, through revisions.** There is no "undo everything that
  run did", and a run that touched a dozen entries needs a dozen restores.
- A deployment that genuinely wants review has no setting for it. Its lever is
  `copilot:use` per role, or the global kill switch.

**What this rules out:** the proposal as a _decision_ — nothing may pause on a
human again without a new record. It does **not** rule out a future
deployment-level (not per-workspace, not per-tool) review mode; if one lands it
should be config next to the model providers, where operator decisions live.

## Alternatives considered

- **Keep the mechanism, flip the default to on.** The smallest change: every box
  ticked out of the box. Rejected because it keeps the screen, the table, the
  permission and the second authority model in exchange for a default — and the
  screen was the thing users pointed at.
- **Move the opt-in to host config** (`ortha.config.ts`, beside the model
  providers) and delete only the UI. Genuinely attractive: it keeps
  propose-then-apply available for a cautious deployment while removing the
  surface nobody used, and it makes the choice an operator's rather than an
  editor's. Rejected for now because it leaves two code paths and two sets of
  copy for a mode we expect nobody to enable — and because reintroducing it
  later is a config key plus the applier call that already exists. This is the
  option to revisit first if the injection cost above proves real.
- **Approve only high-blast-radius changes** (deletes, bulk edits over N
  entries). Keeps a step where it earns its place. Rejected for v1 as a rule
  nobody can predict: "why did this one ask me?" is a worse experience than
  either consistent behaviour, and the threshold would need tuning we have no
  data for.
- **Keep proposals and add "Apply all".** What we built immediately before this
  decision. It helps, and it is what showed that the step was ceremony: with one
  button clearing twelve cards, the cards were doing nothing the button could
  not.
