# `@orthacms/segments-admin`

The **segments UI** — two surfaces and no more.

```
src/lib/
  domain/types.ts               Segment, EntryAccess, and the three-state algebra
  infrastructure/               the gateway port + its HTTP impl + query keys
  application/hooks.ts          the TanStack hooks
  presentation/
    segmentsPlugin/             the factory
    pages/SegmentsPage/         the directory at /segments
    components/
      EntryAccessChip/          the entry header badge
      EntryAccessTab/           the Access tab — where every decision is made
      SegmentStateControl/      one audience's three-state control
      SegmentDialog/            create / edit an audience
```

## What it contributes

| Surface            | Where               | What it is for                   |
| ------------------ | ------------------- | -------------------------------- |
| Audience directory | `/segments`         | the vocabulary                   |
| Entry header chip  | `ENTRY_HEADER_SLOT` | is this entry restricted         |
| **Access** tab     | `ENTRY_TAB_SLOT`    | every decision, one per audience |

There is nothing between the directory and the entry — no rule library, no
assignment screen — because there is nothing in the model between them.

## The decisions that are easy to get wrong

**Three states, not a checkbox.** "Not set" is a real, distinct answer: an
audience nobody mentioned reads the entry when nothing else is allowed and does
not when something else is. A two-state control makes those outcomes look
identical and leaves "not mentioned" unreachable once a row has been touched.

**`withState` removes before it adds.** A segment in both lists is a state the
server accepts and the reader resolves as _denied_ — while the editor's screen
says allowed. The order of those two operations is what makes it unreachable,
and it is the one thing here with a unit test.

**The draft is local until Save.** Each toggle is a small change and the set of
them is one decision — "these three see it, that one does not" — so writing on
every click would publish intermediate answers to real readers on the way to the
intended one.

**The save response seeds the cache rather than invalidating it.** The server
returns the lists it stored, so there is nothing a refetch would learn — and a
refetch would blank the control the editor is still looking at.

**Two permission gates on the tab, and they are different.** `readOnly` says the
caller may not edit the entry's _values_; `segments:manage` says they may not
change who reads it. An editor with `content:update` and neither should be able
to rewrite the article and not to publish it to a new audience.

**The chip renders nothing when no audience exists.** With none the feature is
inert server-side, so a badge claiming anything about access would be a claim
about a system that is not running.

**The workspace is in the entry cache key.** It reaches the server only as
`apiClient`'s ambient `X-Workspace-Id` header, which is never sent on a cache
hit — so without it one workspace would read another's answer.

**The tab slug is content's, not ours.** `ENTRY_TAB_SLOT` drops an item naming a
slug outside `ENTRY_TAB_SLUGS`, because the route table would match the segment
while `entryTabFromPath` could not resolve it. `access` is declared in
`content/admin`'s `ENTRY_TAB` for that reason.

## What is not here yet

- **A records column** showing which entries in a collection are restricted.
- **A bulk action** setting the same audiences on a selection.
- **An admin-e2e suite** — the flows worth pinning are the chip's two states and
  the tab's set-and-save.

## Commands

- `npx nx test @orthacms/segments-admin`
- `npx nx typecheck @orthacms/segments-admin` / `npx nx lint @orthacms/segments-admin`
