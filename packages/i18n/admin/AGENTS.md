# @orthacms/i18n-admin

> **Layout: layered (ADR-0003).** A **light** application — the admin has no
> independent source of truth (the server rejects invalid actions regardless),
> so per the ADR it gets a `domain/` layer only for **value objects / UX
> invariants**, not client aggregates. Here that is `domain/localePolicy` — the
> pure locale-resolution rules the widgets share. Slot contributions stay pure
> **data** and are unchanged. Follow the `users-admin` / `workspaces-admin`
> pilots for the FE idioms.

## Layering (ADR-0003)

- **`domain/localePolicy`** — framework-free locale rules (no React, no router)
  mirroring the server's `LocalePolicy`, so the switcher, title chip, and editor
  widget resolve **one** rule instead of each re-inlining the same `??` chain:
    - `resolveActiveLocale({ entryLocale, urlLocale, defaultSlug })` — the active
      locale by the server's precedence (entry → `?locale=` → default);
    - `isDefaultLocale` / `toLocaleListParam` — the "default locale = clean URL"
      rule (the server scopes to the default when `?locale=` is absent, so the
      two spellings can't drift);
    - `localeName(locales, slug)` — display-name lookup.
- **Slot contributions stay pure data** — `utils/i18nPlugin` still returns plain
  slot items; this refactor changed **no** slot contract, added no route/nav.
- The wire `type`s in `types/locale` still **mirror** the server without
  importing across the boundary (the FE anti-corruption convention).

The admin counterpart to `@orthacms/i18n-server` — content localization in the
Content Library UI. It contributes **no routes, no layout, no nav item**: seven
of its eight contributions fill `@orthacms/content-admin`'s extension slots, and
the eighth is the **Translation coverage** card on the Insights page (see below).
Register it in `createAdmin({ plugins })` **after** `ContentPlugin()` (it fills
slots the content plugin owns).

## What it contributes (the seven slots)

- **`RECORDS_TOOLBAR_SLOT` → `LocaleSwitcher`** — a searchable dropdown
  (design-system `Popover` + `Command`) of the configured locales, shown **only
  when `schema.i18n`**. It owns the `?locale=` list param (`listParamKeys`), so
  the records list is scoped to the active locale server-side; the **default
  locale keeps a clean URL** (no `?locale=`), matching the server's default
  scoping. Picking a **different** locale re-scopes the list **at once** (see
  _A switch is immediate_ below).
- **`RECORDS_COLUMN_SLOT` → `LocalesColumnCell`** — an optional **Locales**
  column (`appliesTo: s => !!s.i18n`; hidden by default, toggled in the column
  picker) showing one status-tinted badge per live locale of the row's
  translation group, each linking to that locale's editor. Data is **batched per
  page** by the item's `useRowsData` (`useLocaleSummaries` →
  `POST …/locale-summary`) — never a request per row. The tint comes from
  content-admin's shared `entryStatusView` / `ENTRY_STATUS_VIEW_VARIANT` (see
  _Publish state_ below), and the state rides the link's accessible name — the
  badge shows the locale slug, so colour alone would convey nothing.
- **`ENTRY_HEADER_SLOT` → `LocaleTitleChip`** — the editor's **locale
  switcher**, an outline button leading the top bar's actions (before Save /
  Publish), live in **both** modes. Shown
  only when `schema.i18n`. It reads the open locale as **code · name** (e.g.
  `EN · English`) plus a **translated/total** count, and is a
  `PopoverTrigger` over a **searchable list** of every configured locale. The
  current
  locale is resolved by `resolveActiveLocale` (`entry.locale ?? ?locale= ??
defaultLocale`) — the plugin's single decision point, which the menu must not
  duplicate (`i18n:I-05`, `I-06`). - **The menu is a search box over a listbox** — the records toolbar's
  `LocaleSwitcher` pattern, because a deployment may run two dozen locales
  and a menu's first-letter type-ahead cannot find one among them. Focus
  stays in the search box (`role="combobox"`), ↑/↓ move an
  `aria-activedescendant` highlight (starting on the current locale), Enter
  picks; rows are `tabIndex={-1}` options. The search matches the language
  name, the code and the record's title in that language. Under it,
  `LocaleMenuSummary` reads "N of M published · P%" beside a progress bar
  (`aria-hidden`; the sentence is read). It used to open on a strip of every
  locale code coloured by state — a repeat of the rows that, at two dozen
  locales, pushed the list half off the menu. - **Each row leads with the language name**, the code beside it on the same
  line (it used to sit in a fixed narrow column, where `zh-Hans` broke over
  two lines), the record's **title** in that language beneath when it
  exists (served as `entry.title` by the locale panel), and its state on the
  right — a publish badge, **Missing** (turning into **+ Add** on the
  highlighted row), or the inert reason. "Missing" is claimed only when the
  members are known (`i18n:I-30`). - **The default locale always leads**, whatever order the host configured
  (and in search results that include it): a tinted row with a "Default"
  tag and a divider beneath it. It is the source most translations start
  from, so it is the one row a reader should never hunt for. The rest keep
  the configured order (a stable sort). - **The count costs no request.** Edit mode counts the `useEntryLocales`
  items that have an `entry` against all of them; create mode counts the
  group's live summary members against **`useLocales().locales.length`** — a
  summary holds only live members, so deriving the total from it reads `2/2`
  for a group missing two locales. It is withheld, never guessed, while the
  members are unknown. - A locale whose translation already exists is a switch target (with its
  publish status, **on a publishable type only** — an always-live type has
  no publish state, so the chip withholds `status`/`publishedAt` and the row
  draws no badge) → navigates to that sibling's editor, or `?locale=` for
  singles. A missing locale **re-targets the form** to that locale (a draft
  create form scoped to that locale + the same group:
  `/:type/new?locale=<slug>&localeGroupId=<gid>` for collections,
  `?locale=…&localeGroupId=…` for singles), carrying the source's values in
  router `state.translateFrom`. Creating the sibling is then just the
  editor's normal **Save (draft) / Publish** (gated `content:create`) —
  there is **no** dedicated create-translation call. Every one of those
  navigations appends the slot context's **`tabSegment`**, so a switch made
  from the Relations tab lands on the sibling's Relations tab instead of
  dumping the user back on General. - On a **saved** record the group's members come from `useEntryLocales` (by
  the saved id). - On a **new/unsaved** record you can still switch the form's target locale
  before filling it in — re-scoping `?locale=` in place. When the create is
  a translation into an existing group (the URL carries a `localeGroupId`),
  the group's members are read by `useLocaleSummaries` (batched by that group
  id) so an already-existing sibling is a live switch target; a fresh create
  (no group) simply re-scopes to the picked locale. - **The chip owns every piece of state; `LocaleMenuItem` owns none.** The
  popover content unmounts the instant a row is picked, so any query or
  handler living in there would go with the pick that unmounted it. The
  chip is mounted by the header slot and survives every open and close,
  which is where all of it belongs (the search query included). Opening the
  menu **prefetches every saved sibling** into the editor's own cache
  (content's `usePrefetchContentEntry`), so a pick usually lands on a
  record already loaded. A pick closes the popover first and runs from its
  `onCloseAutoFocus`, after Radix has handed focus back to the trigger — so
  the closing popover's focus restore cannot land after, and fight, the
  unsaved-changes guard's focus trap. - **The trigger is the design system's `Button`** (`variant="outline"`,
  `size="sm"`), matching the write actions beside it — a real `<button>`,
  which Enter / Space need to open the popover. It used to be a
  badge-styled chip, which read as a label about the record rather than a
  control. The popover is `aria-labelledby` the trigger. The current locale
  is the **selected** option; an inert one is `aria-disabled` but stays in
  the highlight order, so its stated reason is reachable for exactly the
  keyboard user who needs it. - **A failed `useLocales` read costs the choices, not the chip.** The
  trigger still renders (on a saved record the row's own `locale` names it),
  and the menu carries an "unavailable + retry" row — the same posture as
  the records toolbar's switcher, which is the only way back out of a
  non-default locale. - **Each of its two reads has three states, and the chip branches on all
  three** (`ReadState` = `pending | failed | known`). This is `i18n:I-30`
  applied to the read that has not landed yet, and both halves of it were
  shipped wrong once: - The **locale list** is pending on any deep link into an editor, where
  the entry read can settle first. Keying the "nothing to choose from"
  branch on `locales.length === 0` made the menu assert a broken config,
  and offer a retry for it, while the request was still in flight. A
  settled-and-empty list is a real state too (a locale dropped from the
  host config while rows in it still exist), so it gets its own
  sentence rather than borrowing the failure's. - The **group members** are pending for a moment on every editor open,
  and until they land every locale resolves to `undefined` — i.e. looks
  missing. Offering "+ Add" there opens a create form whose save **409s**
  against the sibling that is already there. The documented precedence
  (unknown outranks forbidden) covers unknown-because-pending as well as
  unknown-because-failed; the row states which, because "couldn't load"
  about a running request sends the reader after a fault that is not
  there.
  Both are pinned by `[i18n:I-30]` cases in
  `apps/admin-e2e/src/content/i18n-resilience.spec.ts`, which hold the
  request open (`holdLocales` / `mockI18n().holdEntryLocales`) rather than
  racing a `delayMs`.
- **`ENTRY_DETAILS_ROW_SLOT` → `LocaleDetailsRow`** — the record's
  **`localeGroupId`** (the id every locale of it shares) as one row of the
  editor's **Details** block, beneath the entry id, with an `Info` tooltip
  explaining what it is; a fresh create with no group yet shows a muted
  "Assigned when this record is saved." note instead of the id. It renders
  content-admin's exported **`EntrySidebarRow`** and nothing else — the slot's
  rows render inside Details' own `<dl>`, so a `<section>` there is invalid
  markup. One read-only line does not earn a block of the rail to itself, which
  is the whole reason the slot exists.
- **`RECORDS_FILTER_FIELDS_SLOT` → `useLocaleFilterFields`** — **Has locale /
  Missing locale / Locale count** filter fields, resolved server-side by the
  i18n plugin's virtual-field subqueries. Empty for a non-i18n type.
- **`ENTRY_MENU_SLOT` → `usePublishAllLocales` / `useUnpublishAllLocales`** — two
  items in the entry editor's ⋯ menu (the `extras` group) that act on **every
  locale of the open record at once**. Both are hooks (the slot's contract) that
  resolve the record's siblings with `useEntryLocales` and return `null` unless
  the type is localized **and** publishable, the record is saved, and the user
  holds `content:publish` — returning null is how a menu item hides without
  skipping its hook.
    - **Publish all locales** needs no endpoint of its own: the siblings are
      entries of the _same_ content type, so it hands their ids to content's
      exported **`BulkPublishDialog`**, whose dry run already answers "which of
      these can actually publish". Rows are named by locale via `labelFor` —
      every sibling carries the same record title, so the title alone would make
      them indistinguishable. Shown only with **2+** locales present.
    - **Unpublish all locales** has no pre-flight to reuse (the server accepts an
      unpublish unconditionally), so it is a `ConfirmDialog` naming the locales
      that are currently **live**, then content's exported `useBulkEntryActions`
      → `bulk/unpublish` over their ids. Shown only when something is live.
- **`ENTRY_PARAMS_SLOT`** — non-visual plumbing: the single-mode one-entry read
  carries the active locale (`listParamKeys = ['locale']`), the **create body**
  carries the locale **and** the target group (`createBodyKeys = ['locale',
'localeGroupId']` → the server stamps a sibling), and relation-picker
  candidates are scoped **strictly** to the active locale (`{ locale }`, no
  default fallback) when the target is localized — cross-locale linking isn't
  allowed, so an i18n record links only same-locale targets. The locale is the
  saved entry's (edit mode) or the create form's `?locale=` read from
  `source.params` (a translation draft has no `entry` yet), so the picker stays
  in-locale in **both** modes.

## The Insights card (`INSIGHTS_WIDGET_SLOT` → `LocalizationCoverageWidget`)

The one contribution that is **not** to a content-admin slot. **Translation
coverage** sits in the Insights page's _Localisation & media_ band (`full`
width, `order: 5`, so media's three `sm` cards fill their own row below it):
three headline counts beside a bar list that switches between **By language**
and **By type**.

**The two breakdowns are a view swap over one payload, not two cards and not a
second request.** "Which language is behind?" and "which content type is the
work in?" are asked by the same person a moment apart; splitting them across
cards would put the shared headline figures on one of them arbitrarily. The
figures are workspace-wide and stay put when the axis changes — only the bars,
the legend and the card's subtitle move, and all three have to move together or
the card describes a chart that is no longer on screen.

The two axes use the same palette roles for the same meaning — `series-1` is
work done, `series-2` is work outstanding — but the _denominator_ differs, which
is what the legend swap is for. By language every bar is scaled against the
workspace's record count, so a bar's length is that language's reach. By type it
is the biggest type's record count, so length reads as how much content the type
holds and the blue portion as how much of it is finished; that is what makes
"the debt is in Article" visible at a glance.

**This plugin owns the card because it owns the question.** Coverage is about
the _configured_ locale set — content-admin knows which slugs appear on a row
and nothing about which ones are missing, and missing is the whole widget. Same
reasoning as the server side; the endpoint is `GET /api/insights/i18n/coverage`,
read by `api/useLocalizationCoverage` (workspace-scoped key, `retry: 1`, the
Insights convention).

Three things the widget is careful about:

- **The unit is a record, not a row.** A localized entry is one row per
  language, so a bar counting rows would report 40 stories in 3 languages as 120
  things. The server folds by translation group; the widget just renders it.
- **The three figures are not a partition, and the copy says so.** "Not
  localized" is a subset of "needs translation" — a record in one of four
  languages both has no translations and needs some. Each figure carries a hint
  (`in every language` / `no translations started` / `missing at least one`)
  precisely so a reader doesn't subtract one from another. They are three
  questions, not three slices, which is also why this is not a pie.
- **`permission: CONTENT_READ`**, even though the plugin is i18n. It counts
  content, and a reader who may not see entries must not learn how many there
  are by counting the gaps.

It is the reason this package depends on `@orthacms/insights-admin` — the same
direction as any slot filler.

## A switch is immediate

There is no switch flourish. Both triggers perform the swap the moment a locale
is picked — `updateParams` in the toolbar, `navigate` in the editor's chip —
because there is nothing left to cover: the records list keeps its previous
page on screen while the new locale's loads (`keepPreviousData`), and the
chip's menu prefetches every saved sibling as it opens, so the destination
editor usually draws from the cache. A cold sibling shows the editor's ordinary
loading state.

It used to be a full-screen cover (`LocaleSwitchOverlay` + a module-level
`localeTransition` store, in `CONTENT_OVERLAY_SLOT`): about 220 ms before the
swap, a 380 ms floor, a hold until every request settled and a 300 ms fade —
the better part of a second on every switch, cached or not. It existed to hide
the editor's loading state; prefetching removes most of that state instead of
hiding it. The slot stays in content-admin for whoever needs a page-level
overlay next.

## Publish state — reuse content-admin's classifier, don't re-derive it

Both surfaces that show a locale's publish state (the widget's `LocaleRow`, the
records column's `LocaleBadge`) render **content-admin's** `entryStatusView` /
`ENTRY_STATUS_VIEW_VARIANT` / `EntryStatusBadge`, not their own
`published ? … : …`. The server stores two values but there are **four** states
(see content-admin's _Publish state_ section) — a locale that has live content
plus unpublished edits reads **Modified**, which a two-way branch silently
flattened to "Draft". That is the common case here: editing a **shared**
(non-`localized`) field rewrites every sibling locale, so a one-locale edit moves
the whole group into that state.

Both wire views therefore carry **`publishedAt`** alongside `status`
(`EntryLocaleItem.entry`, `LocaleSummaryItem`) — it is the bit that separates the
two draft states, and without it the menu cannot tell them apart no matter how
it renders.

`LocaleTitleChip` re-reads its members off the slot context's
**`entry.updatedAt`**, not `entry.status`: content's write mutations don't know
about this plugin's queries, and a write that leaves the status where it was
still changes the rows and the chip's count (a second save keeps it `draft`; a
shared-field edit rewrites the _siblings_' rows without touching this one's
status at all).

## Data layer

Per-hook (the `admin-plugin` convention), each owning its `apiClient` request +
TanStack Query key:

- `useLocales` — `GET /api/i18n/locales`, cached **forever** (server config).
  Exposes `locales`, `defaultLocale`, and — load-bearing — **`isError`**. Every
  affordance here is gated on the locale list, so a failed read used to delete
  the whole feature silently while `?locale=` kept scoping the list; the
  switcher renders a retry instead of vanishing, and the title chip falls back
  to the row's own `locale`.
- `useEntryLocales` — `GET /api/i18n/content/:type/:id/locales` (the widget, on
  a saved record).
- `useLocaleSummaries` — `POST …/locale-summary` batched over group ids; sorted
  ids key the cache. Feeds the **Locales column** (a page's unique group ids)
  **and** the **widget in create mode** (the single `localeGroupId` a translation
  draft carries in its URL). Gated on the column actually being **visible** —
  extension columns are off by default, and the batch used to fire on every
  records page for a column nobody had switched on (`RecordsColumnItem.useRowsData`
  now receives `isVisible`, which every item must honour).
- `useLocalizationCoverage` — `GET /api/insights/i18n/coverage`, for the
  Insights card. Workspace-scoped key (the workspace reaches the server only as
  an ambient header, never sent on a cache hit), `retry: 1`, gated on
  `content:read`.
  There is **no** create-translation hook — a sibling is created through the
  Content Library's own editor Save/Publish (the widget navigates to a draft form;
  `createBodyKeys` forwards `locale` + `localeGroupId` into the create body). The
  duplicate-locale **409** / unknown-group **404** surface through the editor's
  normal save-error path.

## Error is not empty, and unknown is not default

Three reads gate everything here, and each of them used to fail into something
that read as an _answer_:

- **The locale list fails** → every surface early-returned, so the switcher —
  the only control that can clear a `?locale=` — disappeared while the list
  stayed scoped to that locale. It now renders a retry, and the title chip
  falls back to the record's own `locale` (a BCP-47 tag, so it can name itself).
- **The group read fails** (`…/:id/locales`, or the batch in create mode) →
  every locale resolved to "no sibling", so the panel offered to _create_ a
  translation that already existed and whose save then 409s. The panel now says
  the members couldn't be read, and no row is actionable while that is true.
- **The summary batch fails** → the Locales cell rendered empty, which is what
  "this record has no other locales" also looks like. It reads _Unavailable_.

Separately, an **unconfigured `?locale=`** must never resolve to the default.
The server 400s the unknown slug, so a switcher labelled "English" would be
describing a list it is not showing — and re-picking English was swallowed as
"already active", leaving no way out but editing the URL. The switcher reports
the unknown slug, and any pick applies (`findLocale` returns `undefined` rather
than falling back; `resolveActiveLocale` treats a blank `?locale=` as absent).

## Language and direction

`locale` is a **BCP-47 tag** by the server's contract and every locale carries a
server-resolved `dir`, so this plugin states both rather than guessing:
`localeAttrs(locales, slug)` returns the `{ lang, dir }` pair to spread onto any
element rendering that locale's text — the switcher's rows and trigger, the
title chip's name, the panel's rows. A locale's _display name_ is written in
that locale, so it needs this even before any content is opened; the
surrounding UI copy ("(default)", "Translated fields") stays in the admin's own
language and is deliberately left outside the marked element.

The entry editor's translated field run carries `lang={entry.locale}` (via
content-admin's `EntryFieldSections`), with `dir="auto"` on both runs. Field
_labels_ still inherit that `lang` — marking each control individually needs a
pass-through in every branch of `EntryFieldInput` and is tracked separately.

## Conventions

- `type` over `interface`; `<name>/index.ts(x)` folders; co-located
  `react-intl` messages namespaced `i18n.<area>.<key>`; UI from
  `@orthacms/design-system` only; wire types **mirror** the server without
  importing across the boundary (`src/lib/types/locale`).
- **One component per file.** A child used by one parent nests in its folder
  (e.g. `LocalesColumnCell/LocaleBadge`, `LocaleTitleChip/LocaleMenuItem`).
- Slot **item ids** and **URL params** are named constants in
  `src/lib/constants` — no magic literals.
- The plugin factory (`utils/i18nPlugin`) types each slot item **explicitly**
  (the `AdminPlugin.slots` array is heterogeneous, so a bare object literal
  wouldn't infer the callback parameter types).

## Package

- Consumed from source (`exports` → `./src/index.ts`); no build step.
- Register **after** `ContentPlugin()` in `apps/admin/src/main.tsx`.

## Unit cover — vitest + jsdom

The package gained a **vitest target** (`vite.config.mts`, jsdom) during the
invariant sweep; before it there was no test target at all, which is why
reverting `useLocalizationCoverage`'s `retry: 1` to TanStack's default broke
nothing anywhere. Widget _behaviour_ still belongs in `admin-e2e`; what lives
here is what a browser cannot see — how many requests a failing card spent
(`insights:I-16`) and that the coverage key carries the workspace, so opening a
second one refetches instead of serving the first one's numbers
(`insights:I-17`).

## Commands

- `npx nx typecheck @orthacms/i18n-admin` / `npx nx lint @orthacms/i18n-admin`
- `npx nx test @orthacms/i18n-admin` — the unit tests (vitest, jsdom)
- E2E: `apps/admin-e2e/src/content/i18n.spec.ts` (mocked API, no backend), plus
  the coverage card in `apps/admin-e2e/src/insights/insights.spec.ts`.
