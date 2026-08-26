# `@orthacms/segments-admin`

The **segmentation UI** — the admin half of
[`@orthacms/segments-server`](../server/AGENTS.md). Layered per
[ADR-0003](../../../docs/adr/0003-tactical-ddd-inside-plugins.md), in the target
mode: `domain / application / infrastructure / presentation`, with the gateway
as a port and the mapper as an anti-corruption layer.

```
src/lib/
  domain/
    entryAccess/            the chain that governs one entry — a description, not a decision
    types/                  segment type, segment, rule, target, explain
  application/              one hook per read, one per write family; useEntryAccess joins three
  infrastructure/
    segmentsGateway/        the port
    httpSegmentsGateway/    the only place apiClient is used
    segmentsMapper/         wire → model
    segmentsKeys/           three cache roots, deliberately
  presentation/
    segmentsPlugin/         the factory — two scopes plus two content slots
    pages/                  SegmentTypesPage (/access), WorkspaceAccessPage (workspace)
    components/             tables, dialogs, the entry chip and the Access tab
```

## What it contributes

| Surface                       | Slot / route          | Scope        |
| ----------------------------- | --------------------- | ------------ |
| Segmentation directory        | `/access`             | installation |
| Access rules + assignments    | `WORKSPACE_ROUTE_SLOT` | workspace    |
| Entry header chip             | `ENTRY_HEADER_SLOT`   | entry editor |
| **Access** tab                | `ENTRY_TAB_SLOT`      | entry editor |

Every surface gates on `access:read`; every write control on `access:manage`.
The split is the point of having two permissions — an editor who cannot *see*
that an article is restricted will publish one believing it is public, while
changing a rule changes what every reader of the site sees.

## The decisions that are easy to get wrong

**The admin describes the chain; it never re-decides it.** `resolveEntryAccess`
answers only what the UI needs — is anything restricting this, which levels
contributed, which one do I edit. Everything else goes through the server's
`explain`, which re-runs the real `evaluate`. A second implementation of the
decision, written to render it, is a second implementation that can disagree
with the one readers actually meet.

**An unloaded rule counts as restricting.** The alternative — reading "I don't
know yet" as open — puts an "Open to everyone" chip on an entry that has a rule
on it, and that is the one direction of the error an editor acts on.

**No active segment type means the chip and the tab say nothing.** With no axis
the whole feature is inert server-side; a badge claiming "Open to everyone" on an
installation with no notion of access is a claim about a system that is not
running.

**Three cache roots, not one.** The catalogue is installation-wide and changes
when an administrator edits an axis; rules, assignments and grants are
workspace-scoped and change far more often. Rooting them together makes a
catalogue invalidation drop a workspace's rules from cache for no reason a reader
could see. And the workspace **must** be in the key path: it reaches the server
only as `apiClient`'s ambient `X-Workspace-Id` header, which is never sent on a
cache hit, so without it workspace A would read workspace B's rules.

**`useEntryAccess` issues no request of its own.** It is mounted by the header
chip, which renders on every entry open in the library. It joins the three lists
the workspace already has cached; a fetch here would be a request per entry
against endpoints whose answers do not change between entries.

**A condition with mode `all` still travels.** Dropping it on the way to the wire
would be indistinguishable from never having authored it — and an absent type
inherits from the level above while an explicit `all` does not. Silently turning
"this level opens the axis" into "this level says nothing" reopens content a
workspace rule had closed.

**The rule draft is deep-copied out of the cache.** TanStack hands out the cached
object itself, so a draft sharing arrays with it would edit the list the table is
rendering — and a cancelled dialog would leave those edits behind with nothing to
refetch them.

**The tab slug is content's, not ours.** `ENTRY_TAB_SLOT` drops an item naming a
slug outside `ENTRY_TAB_SLUGS`, because the route table would match the segment
while `entryTabFromPath` could not resolve it — a tab that navigates and then
renders General under a URL saying otherwise. `access` is declared in
`content/admin`'s `ENTRY_TAB` for that reason.

**Assignments are made where the content is.** The workspace page removes them —
it is the only place all of them are visible at once — but does not create them.
Choosing a target from a dropdown is exactly how a rule ends up on the wrong
collection; the entry editor's tab assigns to the entry it is open on.

## What is not here yet

- **Grants** (the segment side) have a gateway and hooks but no screen. They
  widen access from a segment's own card, which needs the segment directory to
  grow a detail view first.
- **The collection-level assignment surface** — a rule on a whole content type is
  visible on the workspace page and removable there, but is created through the
  API.
- **Impact preview** — "this change hides 412 entries" before the write lands.
- **An admin-e2e suite.** The package has no spec yet; the flows worth pinning
  are the chip's three states, the tab's assign/clear, and the type-retirement
  confirm.

## Commands

- `npx nx typecheck @orthacms/segments-admin`
- `npx nx lint @orthacms/segments-admin`
