# Publishing — the Publish Manager

One workspace page for publishing a set of records **together**: the records that were
selected, their other translations, and the drafts they link to. It is the "deep publish"
the records list's bulk **Publish** is not — that one acts on exactly the rows that were
ticked, which are one locale of each record and nothing they depend on.

Every claim here was read out of the source. The plugin adds **no endpoint and no table**:
content describes the set and publishes it, i18n and protection add to it through two slots
this plugin declares.

**Packages:** `@orthacms/publishing-admin` (admin only). **Tables owned:** none.
**Configuration:** none. **Server endpoint added for it:** content's
`POST /content/:type/bulk/publish/context`.

## Contents

1. [Business description](#01-business-description)
2. [Composition](#02-composition)
3. [Roles and permissions](#03-roles-and-permissions)
4. [The set and how it travels](#04-the-set-and-how-it-travels)
5. [From a set to a page](#05-from-a-set-to-a-page)
6. [Picks](#06-picks)
7. [Check and publish](#07-check-and-publish)
8. [Extension slots](#08-extension-slots)
9. [HTTP surface it relies on](#09-http-surface-it-relies-on)
10. [Accessibility](#10-accessibility)
11. [Invariants](#11-invariants)
12. [Testing checklist](#12-testing-checklist)
13. [Boundaries of responsibility](#13-boundaries-of-responsibility)

## 01. Business description

An editor ships a story in four languages, with a new author page and two new tags. Before
this page, that was a bulk publish per language list, then one per linked collection — and
the article was live, pointing at an author page nobody could see, between the first and the
last of them. The Publish Manager puts the whole thing on one screen: every record, every
locale, every linked draft, and a single **check → publish** over all of it.

What it is **not**:

- **Not a scheduler, not a release.** Nothing is stored; a set lives in the URL and dies with
  the page. A saved, shareable, scheduled set would need a table and is a separate decision.
- **Not a second publish path.** It calls content's dry run and content's bulk publish, per
  type — validation, required relations, publish guards and partial success are exactly a
  plain bulk publish's.
- **Not transitive.** Linked drafts are one hop: the drafts the selected records link to,
  not the drafts _those_ link to.

## 02. Composition

| Layer           | What lives there                                                                                           |
| --------------- | ---------------------------------------------------------------------------------------------------------- |
| `domain/`       | `publishSet` (URL codec), `publishRecords` (records + sections), `publishPicks` (the pick algebra)         |
| `application/`  | `usePublishContext` (the context read), `usePublishRun` (check + commit, per type, in order)               |
| `presentation/` | the page, section, locale bar, record card, entry row, field checklist, action bar, outcome; the two slots |

Contributions **into** other plugins: `WORKSPACE_ROUTE_SLOT` (`publish`),
`RECORDS_BULK_ACTION_SLOT` and `ENTRY_MENU_SLOT` (**Open in Publish Manager**).
Contributions **from** other plugins: i18n fills `PUBLISH_EXPANSION_SLOT` (translations),
protection fills `PUBLISH_ANNOTATION_SLOT` (approval status).

## 03. Roles and permissions

`content:publish` gates both menu items and the page (which says so rather than showing an
empty set). The context read and every publish request carry the same permission and pass
content's `ContentGrantGuard` per type, so a type the workspace does not own a grant of
can be neither described nor published from here — the context never offers one.

## 04. The set and how it travels

`?type=<content type>&ids=<a,b,c>` — one type, at most 100 ids (content's `BULK_MAX_IDS`).

- **The URL, not storage.** Reload, Back/Forward and a pasted link reopen the same set; there
  is nothing to expire and nothing shared between tabs.
- A **selection over the cap** gets the bulk item disabled with the cap in its label — never
  silently cut. A hand-edited URL degrades instead: blanks and duplicates dropped, cut at 100.
- No set → the page explains how to get one. No nav item leads here, for that reason.

## 05. From a set to a page

1. **Context.** `POST /content/:type/bulk/publish/context` describes each id and lists the
   unpublished records it links to (`content:I-57`).
2. **Records.** One per translation group, or per entry on a type without locales; selected
   first, then linked ones in the order reached. Two selected locales of one group are **one**
   record. A linked record keeps every link that reached it ("Tags on “Rain jacket”").
3. **Expansions** add cells (translations) and define the locales; they fill gaps and
   never overwrite a cell the context gave.
4. **Annotations** add per-entry notes (approvals).
5. **Sections.** One per type, the set's own type first: a **locale bar** (a wrapping row of
   chips, one per configured locale, each picking that locale for every record of the type)
   and one **collapsible card per record**, open by default, its entries stacked as rows. The
   page stays one column wide however many locales there are; the locales a record lacks are
   named on one line of its card.

## 06. Picks

A pick is a (record, axis) pair — axis being a locale, or the single "Entry" of a type without
locales. Only an **option** can be picked: an entry that exists and is not already
`published`. A live entry is stated in its cell, never offered.

| Toggle  | Scope                                                    |
| ------- | -------------------------------------------------------- |
| Cell    | one entry                                                |
| Record  | every option of one record                               |
| Axis    | one locale for every record of a section (a locale chip) |
| Section | every option of every record of one type                 |
| Presets | **Everything** (initial) · **Selected only** · **Clear** |

Picks are **reconciled**, not reset, when the records change underneath (a translation read
landing after first paint; the re-read after a commit): kept while still an option, a new
option follows the preset, an option seen and left unticked stays unticked.

## 07. Check and publish

- **The check runs by itself** — content's dry run over **every option** of the set, picked or
  not, one request per type (chunked at 100), once the records settle and again whenever the
  options change. A verdict belongs to the entry, so picking never invalidates it. Each entry
  row shows _Ready_, _N issues_, _Already published_ or _No longer available_, and its **field
  checklist** — failing fields always visible, every field on demand, translated fields marked
  with a globe. **Re-check** asks again.
- **Publish** sends the picked entries the last check found ready, **linked drafts first**,
  one type at a time, sequentially. A transport failure stops the run and the outcome names
  where it stopped.
- **After** — `refreshEntryCaches` per type touched; the context and every slot read are
  re-read (`version`) and checked again; the outcome lists what went live and what did not,
  with a guard's refusal ("held by a publish rule") told apart from a failed check.

## 08. Extension slots

| Slot                      | Hook                                                | Returns                                                                | Filled by  |
| ------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------- | ---------- |
| `PUBLISH_EXPANSION_SLOT`  | `useExpansion(records, { workspaceId, version })`   | extra cells per record key, the axes it defines, read state            | i18n       |
| `PUBLISH_ANNOTATION_SLOT` | `useAnnotations(entries, { workspaceId, version })` | a note per entry id (label, tone, description, `blocking`), read state | protection |

Both are hook-style and boot-frozen: every item's hook runs on every render, gates its own
fetching and returns `null` when it has nothing to say. **`version` belongs in the query
key** — it is bumped after each commit. A failed read is named on the page with a retry.

## 09. HTTP surface it relies on

| Request                                            | Owner         | Used for                    |
| -------------------------------------------------- | ------------- | --------------------------- |
| `POST /api/content/:type/bulk/publish/context`     | content       | the set's records and links |
| `POST /api/content/:type/bulk/publish/preview`     | content       | Check                       |
| `POST /api/content/:type/bulk/publish`             | content       | Publish                     |
| `POST /api/i18n/content/:type/translations`        | i18n          | translation cells           |
| `GET /api/protection/entries/:type/status?ids=…`   | protection    | approval notes              |
| `GET /api/content-schema`, `GET /api/i18n/locales` | content, i18n | type labels, locale names   |

## 10. Accessibility

Every checkbox is named for what it picks; status, notes and results are tied to the entry's
checkbox through `aria-describedby`; a card's fold toggle and an entry's checklist toggle name
what they fold; the summary is a live region; each section is a labelled region and its locale
chips a labelled group; the outcome is an `Alert`. Scanned
by axe in the admin-e2e suite.

## 11. Invariants

- **I-01** — The plugin publishes nothing itself: every dry run and every commit is content's
  bulk endpoint for that type, so no validation rule, required relation or publish guard can
  be bypassed from this page.
- **I-02** — Only an option can be picked — an existing entry that is not `published`. A
  missing locale is a dash; a live entry is stated, never a checkbox.
- **I-03** — The commit sends only picked entries the latest check found `publishable`; the
  check runs over every option by itself whenever the options change, and picking never
  invalidates a verdict.
- **I-04** — Linked drafts are committed before selected records, type by type; a batch that
  fails in transport stops the run and the outcome says where.
- **I-05** — An expansion never overwrites a cell the publish context gave; a failed
  contribution is reported by name, never drawn as absence.
- **I-06** — Picks survive a change of records: kept while still an option, new options
  follow the preset, unticked options stay unticked.
- **I-07** — The set is the URL (one type, ≤ 100 ids); a selection over the cap is refused
  visibly at the menu item, never truncated silently.
- **I-08** — After a commit, every touched type's caches are refreshed and every slot read
  keyed on `version` is re-read.

## 12. Testing checklist

- **Unit** — `npx nx test @orthacms/publishing-admin`: the URL codec, record building
  (grouping by translation group, `via`, missing ids, truncation, expansion merge, sections)
  and the pick algebra (presets, axis/record/section toggles, batches in dependency order,
  reconciliation).
- **Server-e2e** — `apps/server-e2e/src/server/content/bulk-publish-context.spec.ts`
  (`content:I-57`) and the translations read in `i18n-content.spec.ts`.
- **Admin-e2e** — `apps/admin-e2e/src/content/publish-manager.spec.ts`: opening from a
  selection and from the editor menu, the initial picks, a live locale stated, a linked draft
  with its origin, the protection note, every toggle level, folding the cards, a blocked
  locale's failing fields (and the globe on a translated one) with the full checklist on demand,
  publish with dependency order, the empty state, and axe scans.

## 13. Boundaries of responsibility

| Question                                              | Answered by                               |
| ----------------------------------------------------- | ----------------------------------------- |
| Which records does the set hold, what do they link to | content (`bulk/publish/context`)          |
| Which translations exist                              | i18n (`…/translations`)                   |
| Is publishing held by a rule                          | protection (status read; guard on commit) |
| Can this entry publish                                | content's dry run                         |
| What the reader wants to publish                      | this page                                 |
