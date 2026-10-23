# 0022 — The entry editor is one form in schema order, and its properties open on demand

- **Status:** Proposed
- **Date:** 2026-10-22
- **Deciders:** Engineering, Design

> The technical description this record deliberately does not carry — layout,
> states, the action matrix, the status-item rules, the slot changes, the phases
> and the invariants — is [`docs/design/entry-editor.md`](../design/entry-editor.md).

## Context

The entry editor (`@orthacms/content-admin`'s `EntryEditor`) splits one record
across tabs **by data type**: scalar fields on General, relations on Relations,
media on Media, then Access, Activity and History. A schema author cannot put a
cover image next to a title; an editor filling an article walks three tabs; a
required relation's error sits on a tab nobody is looking at.

The record's own state lives in a docked **Properties** rail on the right
(`AppRightPanel`, filled by `EntrySidebar`): the status badge, the publish gate
and its failing checks, dates, ids, and plugin widgets (alarms' Checks,
protection's Review, segments' and i18n's Details rows). The rail can be
collapsed, and collapsed, the reason a publish fails is nowhere on screen. The
page's `<h1>` holds the type name, not the record's title.

Two plugin seams are shaped by this layout: `ENTRY_TAB_SLOT` (media, activity
and segments each add a tab) and `ENTRY_SIDEBAR_WIDGET_SLOT` /
`ENTRY_DETAILS_ROW_SLOT` (sections and rows of the rail). Any change to where
things render is therefore a change to what plugins can rely on, which is why
it is recorded here.

Two existing decisions constrain the answer. [ADR-0017](0017-publication-protection.md)
keeps Publish an ordinary Publish when a guard refuses — the refusal is
explained by the ceremony the click opens, not by restyling the button.
[ADR-0015](0015-alarms-are-non-blocking.md) keeps check flags advisory: they may
be shown, never block.

## Decision

1. **One form, in schema order.** Every editable field — relations and media
   included — renders in a single **Content** view, inside its sections, in the
   order the type declares. Tabs are for **views of the record** (Content,
   Access, History, and plugin views), never for kinds of field. A tab with
   nothing to show is not rendered. `relations` and `media` survive one release
   as redirect-only slugs.

2. **No docked properties panel by default.** What the rail showed moves to
   where it is used: the status badge and dates to a title block whose `<h1>` is
   the record's title; blockers to the header; the locale to its switcher.
   Everything else opens in a **Details panel over the form**, on demand (a
   header button or ⌘.), non-modal, and **pinnable** back into a docked column
   for those who prefer it. Nothing needed to decide a save or a publish exists
   only in Details.

3. **Status is a list the host renders, not chips plugins draw.** A new
   `ENTRY_STATUS_ITEM_SLOT` lets a plugin report an item (severity, label,
   detail, optional action). Content merges them with its own validation items
   and renders the one list in three places: the header (at most two chips, then
   "+N"), the top of Details, and the mobile sheet. `ENTRY_SIDEBAR_WIDGET_SLOT`
   and `ENTRY_DETAILS_ROW_SLOT` keep their contracts and render in Details.

4. **History absorbs Activity.** One timeline with an All · Versions · Activity
   filter, fed by a new `ENTRY_TIMELINE_SLOT`; the activity plugin contributes
   its rows there, gated on `activity:read` as today, instead of owning a tab.

5. **Actions say what they will do, and nothing when there is nothing to do.**
   Publishable types get Save draft + Publish / Publish changes; others one
   Save. A clean editor shows its state ("✓ Saved", "Published · up to date")
   instead of an enabled primary. ⌘S and ⌘⇧P are bound. Publish is never
   restyled by a guard (ADR-0017).

## Consequences

- **Easier:** a schema author controls the whole form's order; an editor fills a
  record top to bottom; errors sit at their fields; the editor always shows
  which record it is and whether it can be published, whatever the panel's
  state.
- **Plugin authors** gain two slots and lose the right to add a tab per field
  type. The media plugin moves its UI into `ENTRY_FIELD_CONTROL_SLOT`; activity
  moves into `ENTRY_TIMELINE_SLOT`; alarms and protection add status items while
  keeping their Details widgets. `ENTRY_TAB` stays a closed set declared by
  content.
- **The shell** gains an overlay mode on `AppRightPanel`. Its always-mounted
  portal target — what keeps a closed panel's state and queries alive — must
  hold in both modes.
- **URLs:** `/…/:entryId/relations`, `/media` and `/activity` redirect for one
  release, then become not-found like any unknown tab.
- **Tests:** the admin-e2e Page Objects for the editor change shape (no
  Relations/Media tab, a Details panel instead of the rail); the phases in the
  design doc each bring their specs.
- **Risk:** the one-form phase touches the editor's largest components
  (`EntryFieldSections`, `RelationFieldSection`, the media tab). It is phased
  behind smaller, contract-free changes so it ships last and alone.
- **Ruled out:** a docked properties column as the default layout, and plugins
  placing their own controls in the header's status zone.

## Alternatives considered

- **Keep tabs per data type, fix the details.** Cheapest, and it leaves the
  structural problem — order and errors across tabs — exactly where it is.
- **Keep the docked rail, open by default.** Status would be visible, but the
  form loses a third of its width on every screen to information most edits do
  not need, and collapsing it still hides the blockers.
- **Properties as chips under the title.** Every property visible without a
  click; but the row grows with each plugin, scrolls away with the title, and
  still needs a home for ids and full locale lists. Its useful half — status at a
  glance — is kept as the header's status list.
- **Properties in a left column beside "On this page".** Always visible, but 200px
  is too narrow for review or access widgets, competes with the section list,
  and has nowhere to go below 1200px.
- **Properties in the app sidebar.** The sidebar is navigation shared by every
  page; mixing one record's properties into it would make it change on every
  entry switch.
