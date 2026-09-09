# `@orthacms/protection-admin`

Publication protection as the person editing an entry meets it. **Three
contributions into the Content Library's slots and no page of its own** — the
reviewer queue and the settings tab are a later piece.

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
    slots/publishGuard/        the verdict     (ENTRY_PUBLISH_GUARD_SLOT)
```

Layered per [ADR-0003](../../../docs/adr/0003-tactical-ddd-inside-plugins.md).

## What it contributes

| Surface         | Where                       | What it says                       |
| --------------- | --------------------------- | ---------------------------------- |
| Review chip     | `ENTRY_HEADER_SLOT`         | "Needs review · 0 of 2"            |
| Review block    | `ENTRY_SIDEBAR_WIDGET_SLOT` | who approved what, and the actions |
| Publish verdict | `ENTRY_PUBLISH_GUARD_SLOT`  | whether Publish is held, and why   |

**All three render nothing on an unprotected type**, on a create form, and on a
non-publishable one. `reviewScopeOf` is the single place that decides, so the
three cannot disagree about when the feature applies at all. An installation
with no rule is the admin it was before this package existed.

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
