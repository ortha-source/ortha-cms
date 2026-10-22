# Entry editor redesign — design

> **Status:** all seven phases built (one PR, ahead of
> [ADR-0022](../adr/0022-entry-editor-one-form-properties-on-demand.md)'s
> acceptance, which stays the reviewers' call). This document is the technical
> description that record deliberately does not carry: the layout, the states,
> the plugin contract changes, the phases and the invariants. The mockups live
> on the design canvas
> ["Entry editor redesign"](https://claude.ai/artifact/UGktxkPr3ghiq82GMcQRyD)
> (ask its owner for access); every screen named here is an artboard there.
> [_As built_](#as-built) at the end lists where the code differs from this
> text; the invariants are numbered into
> [`docs/artifacts/content.md`](../artifacts/content.md) (`content:I-59` …
> `I-69`).

## Why

The editor in `packages/content/admin` (`ContentEntryView` → `EntryEditor`) is
careful in the details and awkward in the structure. Reviewed against the
screens a content editor actually uses, the problems rank like this:

| #   | Problem                                                                                                                                                                                                                                        |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1  | **The form is split by data type, not by meaning.** General / Relations / Media are tabs, so "title → cover → author → body" is three tabs, a schema cannot put a cover next to a title, and a required relation's error hides on another tab. |
| P1  | **The record has no identity on screen.** The `<h1>` holds the _type_ name; the record's title is a truncated last crumb, or its uuid.                                                                                                         |
| P1  | **The actions are ambiguous.** The primary is "Publish" on a clean, published entry; "Save draft" hides in ⋯; "Publish" and "Save & publish" do the same thing; nothing ever reads "Saved".                                                    |
| P1  | **Status and validation live only in a collapsible rail.** Collapse the Properties panel and the reason Publish fails is nowhere; no field shows its own error.                                                                                |
| P2  | Tabs that render nothing (Relations on a type with no relations), five or six tabs on every entry, a rail heavy with uuids and two-line "all good" copy, publish wording on non-publishable types.                                             |
| P2  | Rich text cannot be clicked into; empty rich-text and media fields are 160–220px boxes; relation rows show four permanent icons and truncate the title before the slug; the field outline is unreadable until hovered.                         |
| P3  | No keyboard shortcuts; History is styled unlike its siblings; the locale switcher's "2/3" is unexplained; on mobile the tabs clip with no hint and the status is off screen.                                                                   |

## What changes, in one table

| Today                                                          | Redesign                                                                                                                         |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Tabs General · Relations · Media · Access · Activity · History | **Content** · Access · History (+ plugin tabs). Relations and media are fields inside Content.                                   |
| `<h1>` = type name                                             | `<h1>` = the record's title (title field, fallback "Untitled"), with a status badge and the locale beside it                     |
| Primary "Publish" / "Save", always enabled                     | An action matrix: Save draft + Publish / Publish changes, or one Save; a clean editor shows "✓ Saved" / "Published · up to date" |
| Errors in the rail's Publish gate                              | Errors under each field, a header status ("3 issues") with a list, the same list in Details                                      |
| Properties rail docked on the right                            | **No docked panel by default.** A Details panel opens over the form on demand (⌘.) and can be pinned                             |
| Field outline bars                                             | "On this page" beside long forms, a "Sections" menu when narrow                                                                  |
| Activity tab beside History                                    | One History timeline with an All · Versions · Activity filter                                                                    |

## Layout

The shell is unchanged — app sidebar, the white inset, its 48px top bar and the
36px tab row, a scrolling body — except that the shell's **right panel**
(`AppRightPanel`, filled through `RightPanelPortal`) no longer holds a docked
column by default. See [Details panel](#details-panel).

### Title block

The first thing in the scroll is the record:

- `<h1>`: the value of the type's title field as typed (it updates live), else
  "Untitled" in the muted colour. Never the type name — the type is in the
  breadcrumb.
- One meta line: the **status badge** (publishable types only: _Not saved yet_,
  _Draft_, _Modified_, _Published_), the locale (i18n types), and one sentence
  of history ("Live version from Oct 20 · 4 saved changes not published yet").
- When the title block scrolls out of view, the title and its status badge
  move into the breadcrumb (`EntryTitleCrumb` already resolves the title at no
  extra request).
- Banners that exist today (`ReadOnlyNotice`, `SharedEntryNotice`,
  `EntryChangedNotice`) render directly under the title block, unchanged in
  behaviour. A shared entry's banner also says where the record is used
  ("Used in 4 entries here").

### On this page

`EntryFieldOutline` (bars that expand on hover) is replaced:

- With **three or more sections** and a work area **≥ 1100px**, an "On this
  page" list sits left of the form column (184px), sticky. One row per section
  (fields before the first section are grouped as "Basics"); the section in view
  is highlighted; each row carries a count of unsaved changes (warning) or
  issues (destructive); clicking scrolls and opens the section.
- Narrower, the same list is a "Sections" menu in the title block.
- Fewer than three sections: nothing. A two-section form does not need a map.

The form column stays at `max-width: 720px`.

## The form: one form, in schema order

Every field the reader may edit renders in **Content**, in the order the type
declares, inside its sections. A relation or media field is a field with its
own control, not a tab. `domain/fieldLayout` keeps deciding widths and rows
(`admin.width: 'half'`, `admin.row`); nothing about the layout is inferred from
the field type.

Consequences in the code:

- `ENTRY_TAB.Relations` and `ENTRY_TAB.Media` stop being tabs. Their slugs stay
  in the route table for one release as **redirects** to the bare entry URL
  (scrolled to the first relation / media field), because tabs are routes and
  links to `/…/:entryId/relations` exist in bookmarks and in the activity log.
- `RelationFieldSection` and the media plugin's `EntryMediaTab` content move
  into the field stack. Media fields render through `ENTRY_FIELD_CONTROL_SLOT`
  (the media plugin contributes the control), the same seam rich text already
  uses.
- Relation staging is unchanged: `StagedRelation` still belongs to
  `EntryEditor`, so collapsing a section or switching tabs keeps it, and nothing
  is written before Save.

### Field anatomy

One frame for every type: **label** (from the schema, never the raw name) ·
**required mark** (`*`, tooltip "Required to publish" or "Required") ·
**Changed** badge (hover offers Revert) · **locale marker** (i18n types only:
globe for translated, "All locales" for shared) · **control** · **description**
· **one message line**.

| State            | Rendering                                                                                                                                        |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Default          | 36px control, border, subtle shadow                                                                                                              |
| Focus            | 3px ring in `--ring`                                                                                                                             |
| Changed          | Warning-soft "Changed" badge beside the label while the value differs from the last save                                                         |
| Error            | Destructive border + ring, the reason replaces the description. Shown **after blur or a save/publish attempt**, never while typing a first value |
| Read-only        | No border or shadow, muted background — visibly not an input                                                                                     |
| Disabled         | 50% opacity, the reason in a tooltip                                                                                                             |
| Translated       | Globe marker                                                                                                                                     |
| Shared           | "All locales" marker                                                                                                                             |
| Shared + changed | Warning line under the control: "Applies to all locales — DE and FR change too". The sibling-sync dialog at save time stays.                     |

The client issues come from `presentation/entryValidation` (the kernel-backed
ACL) and a server 422's `issues`; this redesign only changes where they render.

### Sections

A section header shows its title, description and field count; collapsed, it
also shows "N changed" and "N issues". On a save or publish attempt **every
section holding an error opens** and the first error scrolls into view; if the
editor collapses one again, its "issue" marker stays.

### Controls

- **Rich text** edits in place: click places the caret, the toolbar appears on
  focus only, an empty field is one placeholder line ("Start writing — type /
  for headings, lists and images"), long content caps at 480px with inner
  scroll. **Expand** keeps today's full-screen field view
  (`WysiwygFieldFullView`).
- **Media, single**: a 64px card (thumb, name, size, alt text) with Replace /
  Alt text / Remove on hover and focus; empty is one 44px row "Drop an image
  here or [Choose from library] [Upload]". A file chosen before Save shows a
  **Pending upload** badge — uploads still happen on save.
- **Media, gallery**: a grid of thumbnails, drag (and Space + arrows) to
  reorder, a "+" tile; remove on hover.
- **Relation, single**: a card with the target's title, type and status, Replace
  / Open / Remove on hover; empty is a "+ Choose …" control.
- **Relation, many**: a compact list — number, **title first** (the slug yields
  width), status, then move / open / remove on hover and focus; "+ Add …" below.
  The picker opens as a popover anchored to "Add" with search, filters and the
  source switch (own / shared workspace), keeping `RelationPickerFilters` and the
  lazy candidate list.
- **Relation, inverse**: read-only list on a muted background, labelled with
  where it is edited ("Linked from Newsletters › Featured articles").

## Header: status, controls, actions

The top bar has three zones that never mix: **status** (things to know) ·
**controls** (`ENTRY_HEADER_SLOT` contributions such as the locale switcher) ·
**actions** (save, publish, ⋯, Details).

### Action matrix

| State                               | Right side of the header                                       |
| ----------------------------------- | -------------------------------------------------------------- |
| New, publishable                    | Save draft · **Publish**                                       |
| Draft, nothing unsaved              | "Saved 2 min ago" · ✓ Saved (disabled) · **Publish**           |
| Draft, unsaved                      | ● Unsaved changes · Save draft · **Publish**                   |
| Published, nothing changed          | ✓ Published · up to date (disabled)                            |
| Published, unsaved                  | ● Unsaved changes · Save draft · **Publish changes**           |
| Modified, saved                     | ✓ Saved · **Publish changes**                                  |
| Blocking issues                     | **N issues** · Save draft · **Publish** (opens the issue list) |
| Guard refuses (e.g. review pending) | status item · Save draft / Saved · **Publish** (ordinary)      |
| Saving / publishing                 | buttons disabled, spinner; the busy overlay is unchanged       |
| Non-publishable, nothing unsaved    | "Saved 5 min ago" · ✓ Saved (disabled)                         |
| Non-publishable, unsaved            | ● Unsaved changes · **Save ⌘S**                                |

Two rules carry over from existing decisions and are not up for change here:

- **Publish stays an ordinary Publish when a guard refuses**
  ([ADR-0017](../adr/0017-publication-protection.md), update of 2026-09-11, and
  `protection:I-03`). The refusal is explained by the status item and by the
  ceremony the click opens (`EntryPublishVerdict.action`), never by restyling
  the button.
- A non-publishable type never draws publish vocabulary: no status badge, no
  "Save draft", no "required before this entry can be published".

The ⋯ menu loses its "Save draft" and "Save & publish" items (they are the
buttons now) and keeps: Unpublish, Discard unpublished changes, the plugin
groups (`ENTRY_MENU_SLOT`, e.g. Publish / Unpublish all locales), Duplicate,
Export…, Delete — "Move to trash" on a paranoid type.

### Status items

Everything the header must say beyond the save state is a **status item**:
blocking issues from validation, a guard's refusal, a check flag, a locale that
is behind. They come from one list:

```ts
type EntryStatusSeverity = 'blocking' | 'warning' | 'info';

type EntryStatusItem = {
    id: string;
    severity: EntryStatusSeverity;
    /** Short, already localized: "Review requested". */
    label: string;
    /** One line under it in the list: "Waiting for Mira Chen since 10:32". */
    detail?: string;
    /** Scroll target, or an inline action ("Remind", "Go to"). */
    target?: { field: string } | { label: string; onSelect: () => void };
};
```

Rules:

1. One severity order everywhere: **blocking** (issues, guards) → **warning**
   (unsaved or sync warnings) → **info** (check flags, a sibling locale behind).
2. The header shows **at most two chips**, most severe first. From the third
   item on, the top chip carries "+N" and the cluster becomes one button that
   opens the grouped list ("Blocks publishing" / "Heads-up"). It never pushes
   the actions or wraps to a second line.
3. **Plugins do not draw header chips.** They report items (see the new slot
   below); the host decides where they show.
4. Info items never take a chip while something blocks publishing.
5. Below a 960px work area the cluster is one icon with a count, "Unsaved
   changes" becomes a dot on Save draft, and the locale switcher shrinks to its
   code.
6. The same list renders in three places: the header popover, the top of the
   Details panel ("Before you can publish"), and the mobile sheet.

### Locale switcher

The "EN · English 2/3" button becomes the locale code plus **one dot per
workspace locale**, in order, coloured by state (published, has changes, draft,
not created). Its popover heads with the counts in words ("3 of 4 created · 1
published, 1 with changes"), lists every locale with its badge, and offers
"+ Create from EN" on a missing one. The accessible name spells it out.

### Keyboard

| Keys               | Action                                                            |
| ------------------ | ----------------------------------------------------------------- |
| ⌘S / Ctrl+S        | Save draft, or Save                                               |
| ⌘⇧P / Ctrl+Shift+P | Publish / Publish changes; opens the issue list if blocked        |
| ⌘. / Ctrl+.        | Toggle the Details panel                                          |
| ⌘⇧L / Ctrl+Shift+L | Open the locale switcher                                          |
| ⌥↑ / ⌥↓            | Move the focused relation row or gallery tile                     |
| Esc                | Close a popover or the Details panel; leave full-screen rich text |

⌘K stays the workspace search. Shortcuts show in each button's tooltip, with
the glyph from `domain/shortcutModifier`, and are announced through
`aria-keyshortcuts`. They are suspended while a modal dialog is open.

## Details panel

Option A on the canvas. What used to be the docked Properties rail is a
**Details panel that opens over the form** from the header button or ⌘.:

- **Non-modal**: the form stays visible and editable, focus moves into the panel
  and returns to the trigger on close; Esc or a click outside closes it.
- **Pin**: a pin control docks it back into the shell's right-panel column, for
  people who want the old layout. The choice persists per browser the way the
  panel layout already persists its widths.
- **Content, top to bottom**: "Before you can publish" (the status list, only
  when non-empty) · Status and dates · `ENTRY_SIDEBAR_WIDGET_SLOT` widgets
  (Review, Checks, Used in) · Locales · Readable by · Technical (entry id,
  translation group and other `ENTRY_DETAILS_ROW_SLOT` rows, each with Copy).
- **Nothing needed to decide a save or a publish lives only here.** Status is at
  the title, blockers in the header, the locale in the switcher.

In the shell this is a second mode of `AppRightPanel` rather than a new
component: `mode: 'docked' | 'overlay'`, where overlay draws the same portal
target as a floating card above the inset. The always-mounted portal target is
what keeps the panel's state and queries alive while it is closed, and that
property must survive the new mode.

## Secondary views

**Access** (the segments plugin's tab) leads with one sentence ("Readable by
everyone except Trial users"), moves the logic explanation behind "How rules
combine", folds the bulk actions into one "Set all…" menu, and keeps the
audience table with its Not set / Can see / Cannot see control. Access changes
still save with the entry; the tab carries an unsaved dot.

**History** absorbs **Activity**. One timeline, newest first, grouped by day,
with an **All · Versions · Activity** filter; versions are rows with a number
and a Live / Draft badge (publishable types only, as today), activity events are
lighter rows between them. Selecting a version shows its comparison with the
current draft beside the list, with Preview / Restore / Publish this version.
No card wrapper — the same level as Content.

The two remain different sources with different permissions: activity rows
come from `@orthacms/activity-admin` and appear only for a reader holding
`activity:read`; the revision rows need only `content:read`. Without the
permission the filter hides "Activity" and the timeline is the version list.
`ENTRY_TAB.Activity` redirects to `history?show=activity` for one release.

## Mobile (≤ 640px)

- Top bar: menu, "‹ {Type}", Details (with a red dot when something blocks
  publishing), ⋯. Nothing else; the header never grows.
- The title block and tabs as on desktop; half-width fields stack.
- A **sticky bottom bar**: the save state on the left, the status cluster (top
  chip + "+N") on the right, and Save draft / Publish below at 44px. Tapping the
  status line opens Details.
- Details is a bottom sheet with the same content as the desktop panel, the
  status list first.

## Plugin contract changes

| Seam                                                                                       | Today's contributors      | Change                                                                                                                                                                                              |
| ------------------------------------------------------------------------------------------ | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`ENTRY_STATUS_ITEM_SLOT`** (new)                                                         | —                         | `useItem(context) => EntryStatusItem \| null`, a hook like `ENTRY_MENU_SLOT.useItem`. alarms (check flags) and protection (review state) add items; content adds its own validation and sync items. |
| `ENTRY_PUBLISH_GUARD_SLOT`                                                                 | protection                | Unchanged. A blocking verdict also appears as a status item, built by content from the verdict's `reason`.                                                                                          |
| `ENTRY_SIDEBAR_WIDGET_SLOT`                                                                | alarms, protection        | Contract unchanged; renders in the Details panel instead of the docked rail.                                                                                                                        |
| `ENTRY_DETAILS_ROW_SLOT`                                                                   | segments, i18n            | Contract unchanged; rows render under Details › Technical / Status.                                                                                                                                 |
| `ENTRY_HEADER_SLOT`                                                                        | i18n                      | Contract unchanged; the locale switcher gains the per-locale dots and collapses to its code when narrow.                                                                                            |
| `ENTRY_TAB_SLOT`                                                                           | media, segments, activity | Media's tab is retired (its control moves to `ENTRY_FIELD_CONTROL_SLOT`); activity's moves into History (`ENTRY_TIMELINE_SLOT`, new); segments keeps Access.                                        |
| **`ENTRY_TIMELINE_SLOT`** (new)                                                            | —                         | A source of timeline rows for History, permission-gated by the contributor. activity is the first.                                                                                                  |
| `ENTRY_MENU_SLOT`, `ENTRY_PRESAVE_SLOT`, `ENTRY_FIELD_CONTROL_SLOT`, `REVISION_EXTRA_SLOT` | —                         | Unchanged.                                                                                                                                                                                          |

`ENTRY_TAB` remains a **closed** set declared by content, for the reason its
own doc comment gives; `relations`, `media` and `activity` stay in it as
redirect-only slugs for one release, then leave.

## Phases

Each phase is its own PR with admin-e2e coverage (Page Objects + the axe and
keyboard suites, see the `admin-e2e` and `accessibility` skills). Phases 1–3
touch no plugin contract and can ship as soon as they are ready; 4–5 wait for
ADR-0022 to be accepted.

1. **Actions and save state.** The action matrix, "Saved …", ⌘S / ⌘⇧P, the
   "N issues" status with its list (content's own items only), ⋯ without the
   duplicates. Touches `EntryActions`, `EntryMenu`, `usePublishEntryFlow`,
   `PublishGate`.
2. **Title block.** The record's title as `<h1>`, status badge and meta line,
   title and badge moving into the crumb on scroll.
3. **Errors at fields.** Inline messages with their timing, section markers and
   auto-open on attempt, `EntryTabIssues` retired with the tabs it counted for.
4. **One form.** Relations and media inline in schema order; compact relation
   rows and the popover picker; one-line empty states; rich text in place;
   redirects for `relations` / `media`. The largest phase — it may split per
   control.
5. **Details panel and status items.** `AppRightPanel` overlay mode with pin;
   `ENTRY_STATUS_ITEM_SLOT`; alarms, protection, segments and i18n moved onto it;
   the overflow rules; the locale dots.
6. **Secondary views.** History + Activity (`ENTRY_TIMELINE_SLOT`, the activity
   redirect), the Access summary, "On this page" replacing `EntryFieldOutline`.
7. **Mobile.** Bottom bar and the Details sheet.

## Invariants (draft)

To be numbered into `docs/artifacts/content.md` as each lands; the phase that
introduces one adds its spec.

1. Every field the reader may edit renders in the Content view, in schema
   order; no field type gets a tab of its own.
2. A tab with nothing to show is not rendered.
3. The `<h1>` is the record's title or "Untitled" — never the type name.
4. With nothing unsaved and nothing to publish, no action invites a click: the
   primary renders its state, disabled.
5. A non-publishable type renders no publish vocabulary anywhere in the editor.
6. A guard's refusal never restyles or relabels Publish (`protection:I-03`).
7. Every blocking issue is reachable from the field it concerns, from the header
   status, and from Details — one list, three renderings.
8. The header renders at most two status chips and never wraps the actions.
9. Nothing required to decide a save or a publish exists only in the Details
   panel.
10. A retired tab slug redirects for one release instead of rendering
    not-found.
11. Relation and media edits stay staged until Save, whichever section or view
    the editor moved through.

## Open questions

- **Picker size.** A popover suits picking a few records; a type with thousands
  of candidates and a filter tree may still want the dialog. Measure on the
  seed's largest type before choosing.
- **Revert on a field.** "Changed" can offer Revert to the last saved value; for
  relations and galleries that means restoring a staged list. Worth it, or only
  for scalar fields?
- **Details pin default per role?** Editors who live in Review may want it
  pinned. Start with off for everyone and measure.
- **Status from the server.** Today's client gate (kernel `canPublish`) and a
  guard's verdict cover the status list; a sibling locale "behind" needs data
  the editor does not load yet.

## Out of scope

The records table, the schema builder, the public API and every server
contract. No write path, permission or validation rule changes; this redesign
moves where things render and adds two admin-side slots.

## As built

Where the shipped code differs from the text above, and why:

- **The panel keeps the name Properties.** It opens over the form on demand
  (⌘. or the top bar's button) and pins into the docked column, as designed —
  but its contents already hold a **Details** section, and two things named
  Details one inside the other read as a mistake. Its body is unchanged: the
  publish gate (the "Before you can publish" list in its existing form), Used
  in, Details, then the contributed widgets.
- **Overlay is opt-in per page.** `AppRightPanel`'s modes are reached through
  `RightPanelPortal overlay` rather than a global `mode`, so a page that never
  asked for an overlay keeps its column. The pin is per browser
  (`orthacms:right-panel:pinned`), not in the synced panel layout. The admin
  e2e fixture pins it, so the rail's specs keep the docked layout; the overlay
  has specs of its own.
- **The relation picker is still the dialog.** The popover picker is the first
  open question above; until it is measured on a large type, the dialog stays.
  Rows are compact (title first, actions on hover and focus).
- **Status items come from content and alarms.** The editor's field issues and
  a guard's refusal are items; alarms reports open findings. Protection needs
  no item of its own — its refusal arrives through the guard. Segments and
  i18n report nothing: neither has a status a reader must act on yet (a
  sibling locale "behind" is the last open question).
- **Activity stays `content:read`.** The entry-scoped activity route was
  always gated on `content:read`, so the Activity filter is too — not on
  `activity:read`, which gates the deployment-wide page.
- **⌘⇧L and ⌥↑/⌥↓ are not bound yet.** ⌘S, ⌘⇧P and ⌘. are.
- **Rich text in place has no slash menu**, so the placeholder does not
  promise one; the toolbar appears once the field has focus.
