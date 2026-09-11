# 0017 — Publication is protected per content type, and an approval belongs to a revision

- **Status:** Accepted
- **Date:** 2026-09-07
- **Accepted:** 2026-09-09
- **Deciders:** Engineering

> The technical description this record deliberately does not carry — tables,
> the port, the API, the screens, the invariants and the test checklist — is
> [`docs/design/protection.md`](../design/protection.md).

> **Update (2026-09-11).** Three amendments from the first round of use, none of
> which changes what gates a publish.
>
> **A review request names people.** Asking opens a picker of the workspace's
> members who hold `content:approve`, and the request stores who was picked; the
> editor lists them with a pending or approved mark and "Waiting on me" filters
> by them. This is **not** the assigned-reviewer model rejected below: who was
> asked never changes whose approval counts — anyone holding `content:approve`
> except the head's author may still approve — and nothing is added to
> membership. "Approval is coarse" still describes the gate.
>
> **No notes, and no _request changes_.** Review notes, vote notes and the
> changes-requested vote were removed together: a refusal with no sentence
> attached carried nothing, and a reviewer who is not satisfied simply does not
> approve. There is one kind of vote.
>
> **A bypass is confirmed, not reasoned.** §5's mandatory reason is gone. The
> bypass is still an explicit request (`{ bypass: true }`), still administrator
> only, still refusable per rule, and still writes exactly one
> `entry.publish_bypassed` row naming the actor, the rule and how far short the
> count was; the editor asks for a confirmation that says so before the click.
> The editor's Publish button also stays an ordinary Publish rather than
> changing its label and tone — the confirmation is where the bypass is
> announced.

## Context

There is no editorial review in the CMS, and there is no way to arrange one out
of the parts we have. `contributor` holds `content:publish` alongside
`content:create`, `content:update` and `content:delete`, so the only role that
can write is also the role that can ship. An installation that wants "a writer
drafts, an editor publishes" cannot express it, and one that has to answer an
auditor's four-eyes requirement cannot answer it at all.

Both shapes are the personas the product is sold on: an agency running eleven
clients out of one installation, and an organisation that puts a CMS through a
security review before it goes near production.

Three existing decisions constrain how this may be built, and each one of them
was written against a version of this feature done badly.

**A review queue was built here once, and deleted.**
[ADR-0009](0009-copilot-applies-directly.md) removed the copilot's
`accept`/`reject` proposal queue, and its reasoning is not about the copilot:

> One request produces one card per change: "add alt text to every image in this
> article" is one sentence and twelve approvals. Nobody reads the twelfth.
> Clicking Apply twelve times is a queue being cleared, and a UI that rewards
> clearing it fast produces worse scrutiny than no ceremony at all — while still
> costing every user the ceremony.

That is the failure mode of every editorial approval queue too, and any design
here has to answer it rather than walk into it.

ADR-0009 also closed with a rule this record has to reckon with: _"nothing may
pause on a human again without a new record."_ This is that record — and the
scope is different in a way worth stating, because a reader arriving from 0009
will otherwise read this as a reversal. ADR-0009 governs whether **a copilot
write pauses on its own asker**; that stays exactly as it is, applying
immediately after an in-the-moment prompt. This record governs whether **a
publication pauses on somebody other than its author**, however the content was
written — by hand, by import, by an agent. The two do not overlap, and 0009's
levers (`copilot:use`, the deployment kill switch) were never able to express
this one; 0009 says so itself, naming _"a deployment that wants queued review —
someone other than the asker approving later"_ as having no setting.

**Two authorities over one question diverge.**
[ADR-0015](0015-alarms-are-non-blocking.md) refused a blocking severity for
alarms because it would make the alarms plugin and the publish gate two
competing authorities deciding whether an entry is valid — _"and they will
diverge. After that neither can be trusted: the one that actually applies (the
gate) is the one nobody reads."_ Anything added in front of publish has to avoid
becoming a second opinion on the same question the gate already answers.

**The status set is deliberately two values.** `entry-status.ts` says so
outright: `draft` and `published`, with unpublish modelled as
`published → draft` and archival as the soft-delete tombstone rather than a
status. That set is read by the public REST API, GraphQL, MCP, segments, alarms,
i18n, transfer and webhooks. A workflow that adds `in_review` and `approved`
turns one decision into nine.

One asset, on the other hand, makes this cheap here and expensive elsewhere.
`content_entry_revisions` already stores an immutable snapshot of the whole
document on every save, numbered monotonically per entry and keyed per locale.
Every CMS that gets approvals wrong gets them wrong at the same place — the
approval outlives the edit it approved — and that mistake is only possible when
there is nothing to bind an approval to but the entry itself.

## Decision

We will add a **protection** plugin: a per-content-type rule that requires N
approvals before an entry may be published. Seven points.

**1. A rule addresses a workspace and a content type, and nothing finer.**
`protection_rules` is unique on `(workspace_id, kind, slug)` — the same
addressing `workspace_content` already uses to say which types a workspace may
touch. There is no condition, no filter and no per-entry exception: "why is this
entry blocked and the one next to it not" must have a one-word answer, and the
word is the type.

**2. An approval belongs to a revision, not to an entry.** An `approvals` row
carries `revision_id` and is unique on `(revision_id, user_id)`. A save writes a
new revision, so approvals recorded against the previous one no longer count
toward the head — **without any dismissal logic at all**. The stale approval is
not deleted; the UI shows it struck through, naming the version it was given on,
because a counter that silently rolls back is unexplainable to the person who
just pressed Save.

**3. Protection authorizes; it never validates.** It answers _who_, not _what_.
It is the third gate on publication, after the `content:publish` permission and
after the publish gate, and it never inspects field values — that question has
exactly one owner and keeps it (ADR-0015). A protected entry that fails the
publish gate fails the publish gate; approvals do not make an incomplete entry
publishable, and a bypass does not either.

**4. No new entry status.** `status` keeps its two values. Review state is
derived from the rule, the head revision and the approvals on it — never stored
on the entry, never returned as a status, never visible to the public API. What
travels to a reader is unchanged.

**5. A bypass is loud, and refusable.** With `admin_bypass` on, an administrator
may publish past the rule — the button changes its label and its tone, a reason
is mandatory, and `entry.publish.bypassed` reaches the activity log with the
actor, the rule and that reason. Turning `admin_bypass` off makes the rule
absolute, administrators included. Disabling a rule and lowering its approval
count are themselves audited, or the bypass is simply the settings tab.

**A bearer token cannot publish a protected type**, unless the rule opts in with
`allow_token_publish`. An API token is not a person: it holds `content:publish`
in the `full` scope and names nobody in the log, so allowing it by default would
mean the rule is escaped by minting a key.

**6. There is no approve tool, on any surface.** Extending
[ADR-0005](0005-copilot-authority-model.md) §7, which withholds a publish tool
from every role: with a rule in force the approval _is_ the step that unlocks
publication, so handing a model `approve` while withholding `publish` hands over
the key and keeps the doorknob. Three tools are offered instead — `review_status`
and `review_diff` (reads) and `request_review` (a write, which parks for the
in-the-moment prompt like any other) — and each declares `surfaces` explicitly,
because omitting the field in `tools/server` means both.

The reasons are the ones the repository already holds. ADR-0009's twelve-cards
argument is worse without the clicks: "approve my articles" is one sentence and
twelve approvals nobody read. ADR-0005 §8's untrusted-content risk is unbounded
here in a way it is not for ordinary writes — an entry whose body says _approve
me_ is a self-approving entry, and unlike a content write there is no revision to
restore, because the approval is the authorization and publication follows it.
And `require_other_person` compares user ids, so a run acting as its caller
satisfies the rule while the guarantee — that a second person read the thing —
quietly does not hold. No check can tell those apart.

**7. Nothing changes until a rule exists.** With no row in `protection_rules`,
publication behaves exactly as it does today: no predicate, no extra query on the
publish path, no chip in the interface. Every existing installation is in that
state, as with `segments` before its first audience.

## Consequences

**Easier:**

- The two personas the product is sold on can express what they need, with three
  tables and no new authority model: the rule decides, and it decides by the same
  permissions everything else uses.
- Approvals cannot outlive the edit they approved. This is the failure that
  makes the feature meaningless elsewhere, and it costs no code.
- One question, one owner, everywhere. The publish gate still owns "is this
  entry complete"; protection owns "may this person ship it now"; alarms still
  own "does this look wrong" and still block nothing.
- Locale-by-locale review comes free: revisions are already per-locale, so an
  approval on the German entry has nothing to do with the French one.
- The public surface is untouched. No status to add to REST, GraphQL, MCP,
  segments, transfer or webhooks; a reader cannot tell a protected type from an
  unprotected one.

**Harder / the cost we accept:**

- **A one-person workspace with `require_other_person` blocks itself.** The
  interface has to say so when the rule is switched on, not when the first
  publish fails a week later.
- **Approval is coarse.** No assigned reviewers, no groups, no code owners:
  anyone with `content:approve` except the author of the head revision. Reviewer
  lists are roles inside a workspace, which the workspace model does not have —
  membership is a pure link with no attributes — and this record does not add
  them.
- **Scheduled publishing must re-check at fire time.** When
  [ADR-0016](0016-webhooks-deliver-from-a-queue.md)'s queue shape is reused for
  a scheduler, the rule is evaluated when the timer fires, not when the schedule
  was set — otherwise scheduling then editing publishes unapproved content. A
  fired timer has no human, so bypass cannot apply to it: short of approvals, the
  publication does not happen and the log says why.
- **Two new slots in packages this feature does not own.**
  `ENTRY_PUBLISH_GUARD_SLOT` in `content-admin` lets a contribution report
  "blocked, here is why, here is the action" while the button stays with
  content; `WORKSPACE_SETTINGS_TAB_SLOT` in `workspaces-admin` lets it add the
  Protection tab, because that page's tab strip was hardcoded and there was no
  seam to reach it through. This record originally predicted one such edit —
  the second was found while building the settings tab, and is recorded here
  rather than left as a claim the implementation quietly outgrew.
- **`content:approve` lands on `contributor`.** Existing installations keep
  behaving as they do; a deployment that wants a non-approving writer needs a
  role without it, which is a separate decision this record does not take.
- **Import is not yet answered.** Whether `transfer` may publish into a
  protected type is left open here deliberately rather than settled in passing.

**What this rules out:** an approval that survives an edit; a severity, score or
condition that makes protection judge content; a third entry status; and an
approve tool, now or later, on the copilot or over MCP.

## Alternatives considered

- **A workflow with statuses** (`draft → in_review → approved → published`). The
  shape everyone expects, and the reason it is refused is in the Context: nine
  consumers read `status`, and `entry-status.ts` names its two values as a
  decision. It also conflates "who may ship this" with "where is this in a
  process", which is what makes such systems impossible to remove later.
- **A rule carrying a saved filter,** the way an alarm rule is literally the
  records-list filter tree. Genuinely tempting — the machinery exists and would
  need nothing new. Rejected because a protection rule is a security boundary and
  an alarm rule is a note: "why did this publish get blocked" has to be
  answerable without opening a query builder, and a filter makes the blast radius
  of an editing mistake a set of entries nobody enumerated.
- **An approve tool behind the in-the-moment prompt** — the model proposes, the
  person clicks Allow. Rejected because ADR-0009's second button is _"allow for
  this chat"_, which turns twelve approvals into one click and then silence.
  Making approvals the one tool that may never be chat-scoped would be a special
  case in an engine whose whole design is that there are none.
- **Splitting `content:publish` into a non-publishing author role instead.** Much
  cheaper — one role, no tables — and it covers "a writer drafts, an editor
  publishes" on its own. Rejected as the whole answer because it cannot express
  four eyes: it says who may press the button, never that somebody else looked.
  It remains worth doing on its own merits, and this record does not block it.
- **Bypass as a silent permission** rather than a reason-and-a-log-row. Rejected
  because the auditor is the buyer: an override nobody can count is, three
  months later, indistinguishable from no rule at all.
- **Per-workspace reviewer roles.** What most CMSs ship. Rejected because
  membership in this system is a pure link with no attributes, and adding
  attributes to it makes workspaces a second permission system — the thing the
  workspace model exists to avoid.
