# @ortha-cms/i18n-admin

The admin counterpart to `@ortha-cms/i18n-server` — content localization in the
Content Library UI. It contributes **only** to `@ortha-cms/content-admin`'s
extension slots: **no routes, no layout, no nav item**. Register it in
`createAdmin({ plugins })` **after** `ContentPlugin()` (it fills slots the
content plugin owns).

## What it contributes (the five slots)

- **`RECORDS_TOOLBAR_SLOT` → `LocaleSwitcher`** — a searchable dropdown
  (design-system `Popover` + `Command`) of the configured locales, shown **only
  when `schema.i18n`**. It owns the `?locale=` list param (`listParamKeys`), so
  the records list is scoped to the active locale server-side; the **default
  locale keeps a clean URL** (no `?locale=`), matching the server's default
  scoping.
- **`RECORDS_COLUMN_SLOT` → `LocalesColumnCell`** — an optional **Locales**
  column (`appliesTo: s => !!s.i18n`; hidden by default, toggled in the column
  picker) showing one status-tinted badge per live locale of the row's
  translation group, each linking to that locale's editor. Data is **batched per
  page** by the item's `useRowsData` (`useLocaleSummaries` →
  `POST …/locale-summary`) — never a request per row.
- **`ENTRY_SIDEBAR_WIDGET_SLOT` → `LocaleWidget`** — the entry editor's **locale
  switcher**, styled like the Details block. On a **saved** record it lists
  every configured locale: the current one is marked, an existing translation is
  a switch target (with its publish status → navigates to that sibling's
  editor, or `?locale=` for singles), and a missing locale is dimmed but
  selectable → it **navigates to a draft create form** scoped to that locale +
  the same group (`/:type/new?locale=<slug>&localeGroupId=<gid>` for
  collections, `?locale=…&localeGroupId=…` for singles), carrying the source's
  values in router `state.translateFrom`. Creating the sibling is then just the
  editor's normal **Save (draft) / Publish** (gated `content:create`) — there is
  **no** dedicated create-translation call. On a **new/unsaved** record the
  other locales are **disabled** ("Save to add translations") — there's no group
  to attach to yet.
- **`RECORDS_FILTER_FIELDS_SLOT` → `useLocaleFilterFields`** — **Has locale /
  Missing locale / Locale count** filter fields, resolved server-side by the
  i18n plugin's virtual-field subqueries. Empty for a non-i18n type.
- **`ENTRY_PARAMS_SLOT`** — non-visual plumbing: the single-mode one-entry read
  carries the active locale (`listParamKeys = ['locale']`), the **create body**
  carries the locale **and** the target group (`createBodyKeys = ['locale',
  'localeGroupId']` → the server stamps a sibling), and relation-picker
  candidates are scoped to
  the source entry's locale with default fallback
  (`{ locale, localeFallback: 'default' }`) when the target is localized.

## Data layer

Per-hook (the `admin-plugin` convention), each owning its `apiClient` request +
TanStack Query key:

- `useLocales` — `GET /api/i18n/locales`, cached **forever** (server config).
  Exposes `locales` + `defaultLocale`.
- `useEntryLocales` — `GET /api/i18n/content/:type/:id/locales` (the widget).
- `useLocaleSummaries` — `POST …/locale-summary` batched over a page's unique
  group ids (the column); sorted ids key the cache.
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
