# @orthacms/publishing-admin

> **Layout: layered (ADR-0003), light.** `domain/` holds the set codec, the
> record builder and the pick algebra (framework-free, unit-tested);
> `application/` the two data hooks (`usePublishContext`, `usePublishRun`);
> `presentation/` the page, its components, the slot contracts and the hooks
> that loop over them. There is no server package and no aggregate — the
> plugin owns no state the server keeps.

The **Publish Manager** — one workspace page for publishing a set of records
**together**: the records that were selected, their other translations, and
the drafts they link to. It is the "deep publish" the plain bulk Publish is
not: that one acts on the rows you ticked, which are one locale of each record
and nothing they depend on.

## What it contributes

| Surface                     | Where                      | What it does                                                             |
| --------------------------- | -------------------------- | ------------------------------------------------------------------------ |
| The page (`publish`)        | `WORKSPACE_ROUTE_SLOT`     | `/workspaces/:id/publish?type=…&ids=…`; lazy; `order: 90`, never landing |
| **Open in Publish Manager** | `RECORDS_BULK_ACTION_SLOT` | the selection, for a publishable type, outside the trash                 |
| **Open in Publish Manager** | `ENTRY_MENU_SLOT`          | the open record, `publish` group                                         |

**No nav item, on purpose.** The page is always _about_ a set and is opened on
one; a sidebar entry would lead to the page's empty state, which only explains
how to get a set.

Both menu items need `content:publish`; the page states it plainly without it.

## The set travels in the URL

`domain/publishSet` — `?type=<name>&ids=<a,b,c>`, one type and up to
`PUBLISH_SET_MAX_IDS` (100, content's `BULK_MAX_IDS`) ids. A reload, Back and a
pasted link reopen the same set, and there is no storage to expire or leak
between tabs. A selection over the cap gets the bulk item **disabled with the
cap in its label**, not silently cut. A hand-edited URL degrades instead
(blanks and duplicates dropped, cut at the cap).

## How the page is built

1. **Content describes the set** — `fetchPublishContext` →
   `POST /content/:type/bulk/publish/context`: each entry (title, status,
   `publishedAt`, locale + group), and the **unpublished records it links to**
   that this workspace could publish (one hop, owning relations, publishable
   own-granted types, live own rows — `content:I-57`).
2. **`buildRecords`** turns that into **records**: one per translation group
   (or per entry on a type without locales), selected first, then linked ones,
   each carrying how it was reached (`via`). Two selected locales of one group
   are one record.
3. **Expansions** (`PUBLISH_EXPANSION_SLOT`) add cells — i18n adds each
   localized record's other translations and defines the locales.
   `withExpandedCells` never lets an expansion overwrite a cell the context
   already gave.
4. **Annotations** (`PUBLISH_ANNOTATION_SLOT`) add per-entry notes —
   protection's approval status.
5. **Sections** — one per type, the set's own type first: a heading with a
   toggle for the whole type, a **locale bar** on a localized type, then one
   **collapsible card per record**.

## The layout — cards, not a matrix

A records × locales table was the first version, and it stops working at the
number of languages real deployments run: twenty columns is a horizontal scroll
in which the record names, the only thing that says whose row you are in, have
scrolled away. So the page is one column wide **whatever the locale count**:

- **The locale bar** — one chip per configured locale (`EN 1/2`): a tri-state
  checkbox picking that locale for every record of the type that has something
  to publish in it, and how many of those are picked. Chips **wrap**, so twenty
  locales cost a second line. A locale with nothing to publish anywhere is a
  dashed chip, disabled but readable — faded text fails AA contrast.
- **A card per record** (`PublishRecordCard`, a `Collapsible`, open by
  default; **Expand all / Collapse all** in the action bar). The header is the
  record at a glance: its checkbox, name and editor link, how a link reached it,
  a strip of its locales tinted by state (decoration — the rows say it in
  words), "1 of 2 picked" and "1 entry needs fixes". The body stacks its entries
  as rows, then names the locales it has **no** translation in on one line
  ("Not translated: Français, Español, …") rather than a dash per locale.
- **An entry row** (`PublishEntryRow`) — checkbox (only on an option), code and
  language, the status badge, plugin notes, what the dry run says, and its
  **field checklist**: the failing fields always on screen, every field (passed
  ones included) on demand. A field translated per locale wears a **globe**, read
  from the type's schema, so "the German title is missing" reads differently
  from "a shared field is missing everywhere".

## Picks — `domain/publishPicks`

A pick is one (record, axis) pair; only an **option** can be picked — an entry
that exists and is not already `published`. A live entry is stated in its cell
and never offered: the dry run would only say "already published". Toggles
exist at four levels — **cell** (an entry row), **record** (a card), **axis**
(a locale chip: one locale for every record of a type) and **section** — plus
three presets:
**Everything** (the start), **Selected only** (exactly the selected entries —
what plain bulk publish does) and **Clear**.

`reconcilePicks` carries picks across every change of the records (an
expansion landing after first paint, the re-read after a commit): a pick
survives while its cell is still an option, an option that is new follows the
preset, and an option the reader saw and left unticked stays unticked. Without
it, a late translation would either wipe what was ticked or slip in unannounced.

## The check runs by itself — `usePublishRun`

- **The dry run is automatic.** Once the records have settled (the context read
  and every expansion landed), the page runs content's `previewBulkPublish` over
  **every option of the set**, picked or not (`optionBatches`), per type — and
  again whenever the options change (after a commit, or when a translation
  arrives). A verdict belongs to the entry, not to the pick, so ticking boxes
  never invalidates it, and every locale shows what it is missing before the
  reader has decided anything. **Re-check** asks again on demand.
- **Publish** commits through `commitBulkPublish`, per type, sending only what
  the check found `publishable`, **linked drafts first** (`publishBatches`):
  nothing in the database needs that order, but a reader of the site would
  otherwise see an article go live before the author page it links to, and a
  run that fails part-way leaves the linking record unpublished rather than the
  linked one.
- Batches run **sequentially**; a transport failure stops the run there and the
  outcome names where — publishing the article after its author's batch failed
  is what the order exists to prevent.
- After a commit: `refreshEntryCaches` once per type touched, then `version`
  is bumped, which re-reads the context and every slot read keyed on it.
- The outcome is an `Alert` (it is an event the reader caused): how many went
  live, which did not and why — a guard's `guard-refused` reads "held by a
  publish rule", distinct from a check that no longer passes.

Every gate is content's — validation, required relations, publish guards and
partial success are exactly a plain bulk publish's. This plugin adds no
endpoint, owns no tables and bypasses nothing.

## The two slots

Both hook-style, boot-frozen, called for every registered item on every render
(see `presentation/slots/publishingSlots`). Items gate their own fetching and
return `null` when they have nothing to say about the set.

- **`PUBLISH_EXPANSION_SLOT`** — `useExpansion(records, { workspaceId, version })`
  → `{ cells: Map<recordKey, PublishCell[]>, axes, isPending, isError, refetch }`.
  Filled by `@orthacms/i18n-admin` (translations).
- **`PUBLISH_ANNOTATION_SLOT`** — `useAnnotations(entries, { workspaceId, version })`
  → `{ byEntry: Map<entryId, PublishAnnotation>, … }`; an annotation is a short
  label, a tone, a description, and `blocking` when the commit will refuse it.
  Filled by `@orthacms/protection-admin` (approvals).

**Put `version` in your query key** — it is bumped after every commit, the one
moment the manager knows your answer is stale. A contribution whose read fails
is named on the page with a retry ("Translations couldn't load"), never folded
into "fewer cells": a translation that did not load and one that does not exist
must not look alike.

## Accessibility

- Every checkbox has a name that says what it picks ("Publish Winter boots,
  Deutsch (Modified)", "Publish Deutsch for every Localized posts record").
  The status, notes and check result are tied to the entry's checkbox with
  `aria-describedby`, so a list of identical boxes is not told apart by colour
  alone. A card's fold toggle names the record ("Show the entries of …"); an
  entry's failing fields are a labelled list ("What Winter boots, Deutsch is
  missing"), and its full checklist toggle names the entry too.
- The running count / check summary is a `role="status"` live region.
- Each type's section is a labelled region; the locale chips are a labelled
  group.
- Pinned by an axe scan in `apps/admin-e2e/src/content/publish-manager.spec.ts`.

## Commands

- `npx nx typecheck @orthacms/publishing-admin`
- `npx nx lint @orthacms/publishing-admin`
- `npx nx test @orthacms/publishing-admin`
