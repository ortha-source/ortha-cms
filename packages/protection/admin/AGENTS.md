# `@orthacms/protection-admin`

Publication protection as the people who use it meet it: three contributions
into the Content Library's slots, where a requirement is met or missed, one into
workspace settings, where a rule is made, and **one page of its own** — the
reviewer's queue, which is where somebody finds out an approval is wanted.

```
src/lib/
  domain/types.ts              the wire shapes, restated, plus `toneOf`
  infrastructure/
    protectionGateway.ts       the port over /api/protection + its HTTP impl
    protectionKeys.ts          query keys — every one carries the workspace id
  application/hooks.ts         the read, the four votes, and the bypass publish
  presentation/
    protectionPlugin/          the factory
    components/
      ReviewChip/              the header chip  (ENTRY_HEADER_SLOT)
      ReviewerLabel/           an id → a person, from the open workspace
      ReviewSection/           the rail block   (ENTRY_SIDEBAR_WIDGET_SLOT)
        ApprovalRow/             one vote, stale ones struck through
        ReviewActions/           request / approve / request changes
      BypassDialog/            the way past a rule, with a mandatory reason
      ProtectionSettings/      the settings tab (WORKSPACE_SETTINGS_TAB_SLOT)
        RuleEditorDialog/        the six fields, submitted whole
      ReviewQueueTable/        one tab's rows, as a real table
      RequestAge/              how long an ask has waited, in words
      ReviewsSkeleton/         the lazy route's fallback
    pages/ReviewsPage/         the queue      (WORKSPACE_ROUTE_SLOT + NAV)
    slots/publishGuard/        the verdict     (ENTRY_PUBLISH_GUARD_SLOT)
```

Layered per [ADR-0003](../../../docs/adr/0003-tactical-ddd-inside-plugins.md).

## What it contributes

| Surface         | Where                         | What it says                       |
| --------------- | ----------------------------- | ---------------------------------- |
| Review chip     | `ENTRY_HEADER_SLOT`           | "Needs review · 0 of 2"            |
| Review block    | `ENTRY_SIDEBAR_WIDGET_SLOT`   | who approved what, and the actions |
| Publish verdict | `ENTRY_PUBLISH_GUARD_SLOT`    | whether Publish is held, and why   |
| Protection tab  | `WORKSPACE_SETTINGS_TAB_SLOT` | which types are protected, and how |
| Reviews page    | `WORKSPACE_ROUTE_SLOT` + nav  | what is waiting, and on whom       |

**The three entry contributions render nothing on an unprotected type**, on a
create form, and on a non-publishable one. `reviewScopeOf` is the single place
that decides, so the three cannot disagree about when the feature applies at
all. An installation with no rule is the entry editor it was before this
package existed.

**The settings tab is the deliberate exception.** It is where a workspace with
no rule goes to get one, so it has to be visible before there is anything to
see. It is hidden from anybody without `protection:manage` instead — the list
route is administrator-only too, so a visible tab would be a link to a 403.

## The rules worth not re-deriving

**Nothing here counts anything.** The requirement, the tally and the staleness
all arrive computed from `GET /api/protection/entries/:type/:id`, which reads
them from `evaluateProtection` in the kernel. A second count in the client is a
panel that agrees with the API until somebody switches on `countStaleApprovals`
or the four-eyes exclusion bites, and then quietly does not — which is the
failure #257 was amended to prevent, on the server side of the same seam.

**A stale approval stays visible, struck through, naming its version — and says
so in words.** The strike is decoration; the sentence under it ("approved
version 4 — the entry has changed since, so this no longer counts") is the fact.
A reader who sees no line, no colour or no screen gets the same answer.
`ApprovalRow`'s spec pins it, and the mutation that drops the sentence fails it.

**The save is not invalidated — it is keyed.** `EntryReviewScope` carries the
entry's `updatedAt`, so a save produces a new query key and the panel reads
afresh. Protection never reaches into content's save path, and content never
learns protection exists. A vote, by contrast, invalidates **only** the review
key: it moves no value, no relation and no revision, so refreshing the editor
would refetch a record and a whole timeline to learn one number.

**The bypass posts to content's publish route, not to a protection one.** A
bypass is an ordinary publish carrying a reason — content-server's own
`PublishEntryDto` says exactly that — and a protection endpoint that published
would be a second way to publish. What this package owns is the ceremony in
front of it. It is also the one mutation here that calls content's exported
`refreshEntryCaches`, because it is the one that writes the entry.

**The bypass dialog's confirm button is not disabled, and the reason is still
mandatory.** Those are the same decision: a disabled control explains nothing to
anybody and nothing at all to a screen reader, so pressing it with an empty box
refuses the publish and announces why through a `FieldError`. Without a reason
the log holds overrides nobody can account for, which three months later is
indistinguishable from having had no rule.

**The dialog returns focus itself, in `onCloseAutoFocus`.** Radix restores focus
to whatever it captured when the content mounted, and that reference is not
reliable here: the trigger belongs to `content-admin` and is re-rendered as the
verdict changes, so the node Radix holds can be one React has already replaced —
and closing with Escape left focus on `<body>`, putting a keyboard user back at
the top of the page. The trigger is captured in `onSelect` instead, at the
moment of the click, and restored inside Radix's own hook so nothing overwrites
it afterwards. The e2e pins it; it failed before this and passes after.

**A failed read is not an empty one.** "Nobody has reviewed this" is a claim
about the entry; saying it when the truth is "we could not ask" tells somebody
their draft is unreviewed when it may be approved.

**The guard says nothing while the read is in flight or has failed.** Blocking
the button on an unreachable API would make a network fault look like a refused
publish, and the person could not tell them apart. The server refuses regardless,
with the reason — so silence is the honest client-side default.

## Names come from the workspace, not from a request

The API stays id-only. `ReviewerLabel` resolves a reviewer through
`useCurrentWorkspace`, whose members the shell has already loaded — so putting a
name beside a vote costs no request. Somebody who has left is named as such
rather than given a fabricated label: a vote records who looked, and inventing a
name over a gap in the roster misreports the one fact the row carries.

## The settings tab

**The list is the workspace's content grants, not its rules.** A rule is
addressed by `(workspace, kind, slug)` — the same pair `workspace_content`
grants — so no type picker is invented and there is nothing to keep in step: a
type is listed because the workspace may work with it, and its rule is a
property of the row rather than the reason for it. `protectedTypeRows` is the
whole selector, pure and unit-tested.

**A non-publishable type is left out**, because protection guards
`draft → published` and a type that is always live has no transition to hold.
**A rule whose type is no longer granted is kept**, listed separately and
removable — the API returns those on purpose, and dropping them here would
leave a rule nobody can see and nobody can delete.

**The editor submits all six fields, always.** `PUT` replaces rather than
patches, so a form that sent only what it showed would reset the rest to their
defaults and "what does this rule do" would become a question about the order
somebody edited it in.

**The one-member warning is announced, not merely rendered.** ADR-0017 accepts
that a workspace of one person with four eyes required blocks itself, and
requires the interface to say so _when the rule is switched on_ rather than a
week later on the first failed publish. Somebody who has just flipped a toggle
is looking at the toggle, so the warning lives in a `role="status"` live region.
`blocksEveryone` is the predicate; both halves are pinned by tests, and both
mutations fail them.

**The count is a number input, not a stepper.** The mockup draws −/+ around a
value; a pair of buttons around a `<span>` has no value a screen reader can read
back and no keyboard behaviour of its own. A real `type="number"` with a label
gets both for free, and the clamp still runs on what is typed.

**`allow_token_publish`'s helper text says what it actually does.** A token that
is let through still meets the approval count — the flag stops it being refused
outright, it does not exempt it from review (#258). The mockup's caption
predates that decision and is wrong; the interface says the true thing.

## The Reviews page

**It is the only way a reviewer learns there is work.** Approvals can be
recorded the moment a rule exists, but nothing announces one until the mail port
lands (ORT-207), so this page carries the whole feature's discoverability. It is
a page rather than a saved view of a records list because an ask arrives against
whichever type somebody happened to be editing, and a saved view can only ever
ask about the collection it belongs to.

**One request feeds both tabs.** `splitQueue` partitions one fetched window, so
the two counts cannot disagree with each other, switching tabs costs nothing,
and no ask can appear in both for the render where a second request had not yet
landed.

**"Waiting on me" is every ask I did not open** — not an assignment. The feature
has no reviewer lists by design (ADR-0017): anyone with `content:approve` may
review anything but their own head revision, so "could I pick this up" is the
only question with a true answer. The narrower reading — _minus what I have
already voted on_ — is deliberately **not approximated**: the queue line carries
the tally but not who voted, and guessing from `given > 0` would hide a
two-approval rule from the second reviewer the rule exists to involve. It wants
the queue read to name its voters, which is a payload nothing needs yet.

**The age says "overdue" in words, not only in colour.** A greyscale screen, a
colour-blind reader and a screen reader all have to get the same fact — the rule
a queue breaks most easily, because "this one is old" feels like something red
says by itself. The exact moment rides `<time datetime>` so nothing is lost to
the rounding.

**A failed read is not an empty queue.** "Nothing is waiting on you" is a claim
about the workspace; saying it when the truth is "we could not ask" tells a
reviewer they are free when they are not, which is the one thing this page must
never do.
