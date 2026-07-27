# @ortha-cms/i18n-admin

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

The admin counterpart to `@ortha-cms/i18n-server` — content localization in the
Content Library UI. It contributes **only** to `@ortha-cms/content-admin`'s
extension slots: **no routes, no layout, no nav item**. Register it in
`createAdmin({ plugins })` **after** `ContentPlugin()` (it fills slots the
content plugin owns).

## What it contributes (the seven slots)

- **`RECORDS_TOOLBAR_SLOT` → `LocaleSwitcher`** — a searchable dropdown
  (design-system `Popover` + `Command`) of the configured locales, shown **only
  when `schema.i18n`**. It owns the `?locale=` list param (`listParamKeys`), so
  the records list is scoped to the active locale server-side; the **default
  locale keeps a clean URL** (no `?locale=`), matching the server's default
  scoping. Picking a **different** locale plays the **switch flourish** (see
  below).
- **`RECORDS_COLUMN_SLOT` → `LocalesColumnCell`** — an optional **Locales**
  column (`appliesTo: s => !!s.i18n`; hidden by default, toggled in the column
  picker) showing one status-tinted badge per live locale of the row's
  translation group, each linking to that locale's editor. Data is **batched per
  page** by the item's `useRowsData` (`useLocaleSummaries` →
  `POST …/locale-summary`) — never a request per row. The tint comes from
  content-admin's shared `entryStatusView` / `ENTRY_STATUS_VIEW_VARIANT` (see
  _Publish state_ below), and the state rides the link's accessible name — the
  badge shows the locale slug, so colour alone would convey nothing.
- **`ENTRY_SIDEBAR_WIDGET_SLOT` → `LocaleWidget`** — the entry editor's **locale
  switcher**, live in **both** modes. It renders content-admin's exported
  **`EntrySidebarSection`** — the editor's rail is one flat Properties panel of
  divider-separated sections, so a card of our own would be the single floating
  box in it (content-admin's _The Properties rail_ section is the contract). It lists
  every configured locale: the current one is marked, a locale whose translation
  already exists is a switch target (with its publish status, **on a publishable
  type only** — an always-live type has no publish state, so `LocaleWidget`
  withholds `status`/`publishedAt` and the row draws no badge → navigates to that
  sibling's editor, or `?locale=` for singles), and a missing locale is dimmed
  but selectable → it **re-targets the form** to that locale (a draft create form
  scoped to that locale + the same group:
  `/:type/new?locale=<slug>&localeGroupId=<gid>` for collections,
  `?locale=…&localeGroupId=…` for singles), carrying the source's values in
  router `state.translateFrom`. Creating the sibling is then just the editor's
  normal **Save (draft) / Publish** (gated `content:create`) — there is **no**
  dedicated create-translation call. Every one of those navigations appends the
  slot context's **`tabSegment`**, so a switch made from the Relations tab lands
  on the sibling's Relations tab instead of dumping the user back on General.
    - On a **saved** record the group's members come from `useEntryLocales` (by
      the saved id).
    - On a **new/unsaved** record you can still switch the form's target locale
      before filling it in — re-scoping `?locale=` in place. When the create is
      a translation into an existing group (the URL carries a `localeGroupId`),
      the group's members are read by `useLocaleSummaries` (batched by that group
      id) so an already-existing sibling is a live switch target; a fresh create
      (no group) simply re-scopes to the picked locale.
    - The section carries a **contextual `description`** under its title — a
      saved-record line vs a create-mode line (keyed on `isCreate`).
    - A footer surfaces the record's **`localeGroupId`** (the id every locale of
      the record shares) with an `Info` tooltip explaining what it is; a fresh
      create with no group yet shows a muted "Assigned when this record is
      saved." note instead of the id.
- **`ENTRY_HEADER_SLOT` → `LocaleTitleChip`** — a static `Badge` beside the
  entry-editor title showing the open locale as **code · name** (e.g.
  `EN · English`), shown **only when `schema.i18n`**. The current locale is
  resolved like the widget's (`entry.locale ?? ?locale= ?? defaultLocale`) and
  the display name comes from `useLocales`; switching stays in the widget /
  toolbar switcher (the chip is non-interactive).
- **`RECORDS_FILTER_FIELDS_SLOT` → `useLocaleFilterFields`** — **Has locale /
  Missing locale / Locale count** filter fields, resolved server-side by the
  i18n plugin's virtual-field subqueries. Empty for a non-i18n type.
- **`CONTENT_OVERLAY_SLOT` → `LocaleSwitchOverlay`** — the switch cover, mounted
  at the library's page level so it outlives the editor's loading state (see
  _Switch flourish_ below).
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

## Switch flourish (`LocaleSwitchOverlay` + `utils/localeTransition`)

Both the toolbar switcher **and** the editor's locale widget trigger a
non-interactive full-screen overlay — a `Languages` glyph, a spinner, and
"Switching to <locale>…" — that appears **immediately** over the current view
and holds until the destination has loaded. A trigger calls
`beginLocaleSwitch(name, apply)` (a tiny module-level store), passing the
**actual swap** (`updateParams` on the toolbar, `navigate` in the widget) as
`apply` rather than running it inline. The store **defers `apply`** (~`COVER_MS`)
so the layout change happens **behind** the now-covering overlay — otherwise
React commits the new content and the overlay in the same frame and you'd see
the new locale flash through the blur. The backdrop is near-opaque
(`bg-background/95 backdrop-blur-sm`).

**The host is page-level, not in-view.** It is contributed to content-admin's
`CONTENT_OVERLAY_SLOT`, which `ContentLibraryPage` renders outside its routes.
It used to be rendered by the locale widget and the toolbar switcher — i.e.
_inside_ the editor, which unmounts itself for its loading state while the
destination record loads. So the cover vanished mid-transition, exposing the
editor's full-page spinner, and reappeared when the editor re-rendered: two
loaders blinking in sequence. A cover has to outlive the thing it covers.

**The hold is data-driven, not timed.** `LocaleSwitchOverlay` watches
`useIsFetching()` and calls `settleLocaleSwitch()` once nothing is in flight;
the store enforces a `MIN_HOLD_MS` floor (a "no requests" reading taken before
the destination's queries are even issued means nothing) and a `MAX_HOLD_MS`
ceiling so a stalled request can never leave the page covered. The cover
therefore lifts onto a rendered form rather than onto a spinner. A rapid
re-switch cancels the pending `apply` (last pick wins). Purely visual
(`pointer-events-none`, `motion-reduce:animate-none`), portalled to
`document.body`.

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
two draft states, and without it the widget cannot tell them apart no matter how
it renders.

`LocaleWidget` re-reads its panel off the slot context's **`entry.updatedAt`**,
not `entry.status`: content's write mutations don't know about this plugin's
queries, and a write that leaves the status where it was still changes the panel
(a second save keeps it `draft`; a shared-field edit rewrites the _siblings_'
rows without touching this one's status at all).

## Data layer

Per-hook (the `admin-plugin` convention), each owning its `apiClient` request +
TanStack Query key:

- `useLocales` — `GET /api/i18n/locales`, cached **forever** (server config).
  Exposes `locales` + `defaultLocale`.
- `useEntryLocales` — `GET /api/i18n/content/:type/:id/locales` (the widget, on
  a saved record).
- `useLocaleSummaries` — `POST …/locale-summary` batched over group ids; sorted
  ids key the cache. Feeds the **Locales column** (a page's unique group ids)
  **and** the **widget in create mode** (the single `localeGroupId` a translation
  draft carries in its URL).
  There is **no** create-translation hook — a sibling is created through the
  Content Library's own editor Save/Publish (the widget navigates to a draft form;
  `createBodyKeys` forwards `locale` + `localeGroupId` into the create body). The
  duplicate-locale **409** / unknown-group **404** surface through the editor's
  normal save-error path.

## Conventions

- `type` over `interface`; `<name>/index.ts(x)` folders; co-located
  `react-intl` messages namespaced `i18n.<area>.<key>`; UI from
  `@ortha-cms/design-system` only; wire types **mirror** the server without
  importing across the boundary (`src/lib/types/locale`).
- **One component per file.** A child used by one parent nests in its folder
  (e.g. `LocalesColumnCell/LocaleBadge`, `LocaleWidget/LocaleRow`).
- Slot **item ids** and **URL params** are named constants in
  `src/lib/constants` — no magic literals.
- The plugin factory (`utils/i18nPlugin`) types each slot item **explicitly**
  (the `AdminPlugin.slots` array is heterogeneous, so a bare object literal
  wouldn't infer the callback parameter types).

## Package

- Consumed from source (`exports` → `./src/index.ts`); no build step.
- Register **after** `ContentPlugin()` in `apps/admin/src/main.tsx`.

## Commands

- `npx nx typecheck @ortha-cms/i18n-admin` / `npx nx lint @ortha-cms/i18n-admin`
- E2E: `apps/admin-e2e/src/content/i18n.spec.ts` (mocked API, no backend).
