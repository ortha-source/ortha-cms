# @orthacms/i18n-admin — Test Artifact

> **Unit:** `packages/i18n/admin` · **Package:** `@orthacms/i18n-admin` · **Kind:** admin plugin
> **Source of truth:** `packages/i18n/admin/AGENTS.md`
> **Findings verified:** 2026-08-11 — 16 confirmed · 0 deleted · 2 corrected · 2 unverified
> **Generated:** 2026-08-11

## 1. Scope & Preconditions

**Owns:** content localization in the admin UI — the records-toolbar **locale
switcher** (and the `?locale=` list param), the opt-in **Locales** table column,
the entry editor's **locale panel** and **title chip**, the **Has locale /
Missing locale / Locale count** filter fields, the **switch flourish** overlay,
the two **all-locales** entry-menu actions, the entry-param plumbing that carries
the locale into the single read / the create body / the relation picker, and the
**Translation coverage** card on the Insights page.

**Does NOT own:** any route, any nav item, any layout — this plugin contributes
**only** slot items (`utils/i18nPlugin/index.tsx:159-193`). It does not own the
API (`@orthacms/i18n-server`), the entry form or the records table
(`@orthacms/content-admin` owns every slot but one), the Insights page shell
(`@orthacms/insights-admin`), the publish/unpublish endpoints (content's own
bulk routes are reused), or any authorization — `useHasPermission` only hides
affordances; the server guard is the boundary (`.cursor/BUGBOT.md`, "Permission
gating only in the UI"). There is also **no create-translation call**: a sibling
is created by the content editor's ordinary Save/Publish
(`packages/i18n/admin/AGENTS.md`, _Data layer_).

- **Entry points**
  - Factory: `I18nPlugin()` (`packages/i18n/admin/src/lib/utils/i18nPlugin/index.tsx:77`).
    **Routes: none. Layout: none. Nav: none.**
  - Slots **filled** (9 items across 9 slots):
    | Slot (owner) | Item id | Component/hook |
    | --- | --- | --- |
    | `RECORDS_TOOLBAR_SLOT` (content) | `i18n.localeSwitcher` | `LocaleSwitcher` (`:81-85`) |
    | `RECORDS_COLUMN_SLOT` (content) | `i18n.localesColumn` | `LocalesColumnCell` + `useLocaleSummaries` (`:86-100`) |
    | `ENTRY_SIDEBAR_WIDGET_SLOT` (content) | `i18n.localeWidget` | `LocaleWidget` (`:101-104`) |
    | `ENTRY_HEADER_SLOT` (content) | `i18n.localeTitleChip` | `LocaleTitleChip` (`:105-108`) |
    | `CONTENT_OVERLAY_SLOT` (content) | `i18n.localeSwitchOverlay` | `LocaleSwitchOverlay` (`:112-115`) |
    | `RECORDS_FILTER_FIELDS_SLOT` (content) | `i18n.filterFields` | `useLocaleFilterFields` (`:116-119`) |
    | `ENTRY_PARAMS_SLOT` (content) | `i18n.entryParams` | list/create/relation params (`:120-142`) |
    | `ENTRY_MENU_SLOT` (content) | `i18n.publishAllLocales`, `i18n.unpublishAllLocales` | `usePublishAllLocales` / `useUnpublishAllLocales` (`:147-158`) |
    | `INSIGHTS_WIDGET_SLOT` (insights) | `insights.i18n.coverage` | `LocalizationCoverageWidget` (`:168-181`) |
  - Data layer (per-hook, `admin-plugin` convention):
    `useLocales` → `GET /api/i18n/locales` (`api/useLocales/index.ts:24`, key
    `['i18n-locales']`, `staleTime: Forever`, **not workspace-scoped** —
    deployment config); `useEntryLocales` → `GET /api/i18n/content/:type/:id/locales`
    (`api/useEntryLocales/index.ts:41`); `useLocaleSummaries` →
    `POST /api/i18n/content/:type/locale-summary`
    (`api/useLocaleSummaries/index.ts:51`); `useLocalizationCoverage` →
    `GET /api/insights/i18n/coverage` (`api/useLocalizationCoverage/index.ts:37`).
  - Pure domain: `resolveActiveLocale` / `isDefaultLocale` / `toLocaleListParam` /
    `localeName` (`domain/localePolicy/index.ts:28,35,47,55`).
  - Module-level transition store: `beginLocaleSwitch` / `settleLocaleSwitch` /
    `subscribeLocaleSwitch` / `getLocaleSwitch` (`utils/localeTransition/index.ts:65,88,99,107`).

- **Runtime prerequisites**
  - A server whose `ortha.config.ts` configures **2+ locales** and at least one
    content type with `i18n: true`. With one locale configured the switcher still
    renders (one option) and every coverage figure is trivial.
  - A signed-in user in an open workspace. Permission matrix: `content:read`
    gates the coverage card (`i18nPlugin:175`) and every content read;
    `content:create` gates the widget's "Add" affordance
    (`LocaleWidget:103, 250`); `content:publish` gates both ⋯ menu items
    (`usePublishAllLocales:49`, `useUnpublishAllLocales:156`).
  - `I18nPlugin()` registered **after** `ContentPlugin()` in
    `apps/admin/src/main.tsx:29-32`.
  - For the coverage card, `InsightsPlugin()` must be registered (it is, at
    `main.tsx:26`).

- **How to exercise it manually**
  ```bash
  docker compose up -d && npx nx run server:db:migrate && npm run dev
  ```
  - Records list: `http://localhost:4200/workspaces/<id>/content/<localizedType>`
  - Localized entry editor: click any row, or
    `…/content/<localizedType>/new?locale=de&localeGroupId=<gid>`
  - Insights: `http://localhost:4200/workspaces/<id>/insights` → the
    _Localisation & media_ band, first card.
  - Mocked alternative (no backend): `npx nx e2e admin-e2e -- --project=chromium
    src/content/i18n.spec.ts`, whose seed is `apps/admin-e2e/src/support/api/i18n.ts`.

- **Dependencies that must be healthy:** `@orthacms/content-admin` (every slot
  but one, plus `EntrySidebarSection`, `EntryStatusBadge`, `entryStatusView`,
  `BulkPublishDialog`, `useBulkEntryActions`), `@orthacms/insights-admin`
  (`WidgetCard`, `BarRows`, `WidgetChip`, `toneBackground`,
  `INSIGHTS_SECTION_IDS`), `@orthacms/query-builder-admin` (`FilterField`,
  `FIELD_TYPE`), `@orthacms/design-system` (`Popover`, `Input`, `Badge`,
  `Tooltip`, `Spinner`, `SegmentedControl`, `ConfirmDialog`, `toast`),
  `@orthacms/identity-admin` (`useHasPermission`), `@orthacms/workspaces-admin`
  (`useCurrentWorkspace` — three of the four query keys are workspace-scoped),
  `@orthacms/utils-admin` (`apiClient`, `useUnsavedChangesApi`, `STALE_TIME`).

## 2. Feature Inventory

| # | Feature | Where it lives | Coverage |
| --- | --- | --- | --- |
| F1 | Plugin contributes 9 slot items and **no** route/layout/nav | `packages/i18n/admin/src/lib/utils/i18nPlugin/index.tsx:159-193` | ✅ E2E |
| F2 | Records-toolbar **locale switcher**; owns `?locale=`, default locale keeps a clean URL | `.../components/LocaleSwitcher/index.tsx:69,103-117` | ✅ E2E |
| F3 | Switcher search box + ↑/↓/Enter `aria-activedescendant` list | `.../components/LocaleSwitcher/index.tsx:86-96,119-133,185-242` | ❌ NONE |
| F4 | **Switch flourish** — deferred apply, data-driven hold, min/max floor & ceiling | `.../utils/localeTransition/index.ts:65-93`, `.../components/LocaleSwitchOverlay/index.tsx:43-118` | ⚠️ PARTIAL |
| F5 | Opt-in **Locales** table column, batched once per page | `.../utils/i18nPlugin/index.tsx:86-100`, `.../components/LocalesColumnCell/index.tsx:16` | ✅ E2E |
| F6 | Locale badge — status tint + link to that locale's editor | `.../components/LocalesColumnCell/LocaleBadge/index.tsx:27-54` | ⚠️ PARTIAL |
| F7 | Entry editor **locale panel** — switch to an existing sibling | `.../components/LocaleWidget/index.tsx:90,195-236` | ✅ E2E |
| F8 | Missing locale → prefilled draft create form (`?locale=&localeGroupId=`) | `.../components/LocaleWidget/index.tsx:153-158,222-234` | ✅ E2E |
| F9 | Locale panel in **create** mode — re-target a fresh form, jump to a sibling | `.../components/LocaleWidget/index.tsx:133-137,161-175` | ✅ E2E |
| F10 | Translation-group id footer with an `Info` tooltip / pending note | `.../components/LocaleWidget/index.tsx:282-313` | ✅ E2E |
| F11 | A locale switch routes through the app-wide **unsaved-changes guard** | `.../components/LocaleWidget/index.tsx:102,195-199` | ❌ NONE |
| F12 | Entry-title **locale chip** (`EN · English`) | `.../components/LocaleTitleChip/index.tsx:24-50` | ✅ E2E |
| F13 | **Has locale / Missing locale / Locale count** filter fields | `.../hooks/useLocaleFilterFields/index.ts:34-64` | ❌ NONE |
| F14 | Entry params: single read scoping, create-body keys, relation-candidate locale | `.../utils/i18nPlugin/index.tsx:120-142` | ✅ E2E |
| F15 | ⋯ menu **Publish all locales** (reuses content's `BulkPublishDialog`) | `.../hooks/usePublishAllLocales/index.tsx:44-93` | ✅ E2E |
| F16 | ⋯ menu **Unpublish all locales** (`ConfirmDialog` + `useBulkEntryActions`) | `.../hooks/useUnpublishAllLocales/index.tsx:58-123` | ✅ E2E |
| F17 | A switch keeps the editor **tab** the user was on (`tabSegment`) | `.../components/LocaleWidget/index.tsx:216-233` | ✅ E2E |
| F18 | Coverage card — three overlapping headline figures with hints | `.../components/LocalizationCoverageWidget/index.tsx:234-250`, `.../CoverageFigure/index.tsx:22` | ✅ E2E |
| F19 | Coverage **By language** bars (translated / missing, share of records) | `.../components/LocalizationCoverageWidget/index.tsx:135-165` | ✅ E2E |
| F20 | Coverage **By type** bars + the `SegmentedControl` axis toggle | `.../components/LocalizationCoverageWidget/index.tsx:167-192`, `.../CoverageModeToggle/index.tsx:42` | ✅ E2E |
| F21 | Coverage chip (`Fully translated` / `{n} to translate`) + footer sentence | `.../components/LocalizationCoverageWidget/index.tsx:211-227` | ✅ E2E |
| F22 | Coverage gated on `content:read`, not on an i18n permission | `.../utils/i18nPlugin/index.tsx:175`, `.../api/useLocalizationCoverage/index.ts:39,50` | ✅ E2E |
| F23 | Coverage state ladder — pending / error / empty / data | `.../components/LocalizationCoverageWidget/index.tsx:228-231` (via `WidgetCard`) | ⚠️ PARTIAL |
| F24 | `localePolicy` pure rules (active locale, default-is-clean-URL, name lookup) | `.../domain/localePolicy/index.ts:28,35,47,55` | ❌ NONE |
| F25 | `useLocales` — global key, cached forever, `defaultLocale` derived | `.../api/useLocales/index.ts:24-39` | ⚠️ PARTIAL |
| F26 | Panel re-reads on `entry.updatedAt`; summaries batch on sorted unique group ids | `.../components/LocaleWidget/index.tsx:127-132`, `.../api/useLocaleSummaries/index.ts:57-63` | ⚠️ PARTIAL |

## 3. Manual Test Plan

All blocks assume: signed in as an `admin` in a workspace, the deployment
configured with `en` (default), `de`, `fr`, and a localized publishable
collection. Quoted strings are the real `defineMessages` defaults; locators in
parentheses are the accessible names the e2e POM already uses
(`apps/admin-e2e/src/support/pages/ContentLibraryPage.ts:582-641`).

### F1 — The plugin contributes, and contributes nothing else

**Preconditions:** the stock `apps/admin/src/main.tsx` plugin list.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Open the workspace sidebar | there is **no** "Localization"/"i18n" nav item — the plugin owns no route |
| 2 | Open a **localized** collection | the toolbar shows a **Locale: English** button beside the column picker and filters |
| 3 | Open a **non-localized** collection | no locale button (`LocaleSwitcher:98` returns `null` on `!schema.i18n`) |
| 4 | Open the column picker on the localized type | a **Locales** entry, unchecked by default |
| 5 | Open the column picker on the non-localized type | no **Locales** entry (`appliesTo: s => !!s.i18n`, `i18nPlugin:89`) |
| 6 | Open Insights | **Translation coverage** appears full-width in the _Localisation & media_ band, above media's three cards |

**Keyboard-only path:** Tab through the toolbar — search, Filters, Columns,
**Locale: English**, Add record.
**Screen-reader expectation:** the switcher trigger announces "Locale: English,
button, collapsed".

### F2 — The locale switcher and `?locale=`

**Preconditions:** the localized collection holds `Winter boots` (en) and its
sibling `Winterstiefel` (de).

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Note the URL at `…/content/localized_post` | **no** `?locale=` — the default locale keeps a clean URL (`toLocaleListParam`, `localePolicy:47`) |
| 2 | Press **Locale: English** | a popover: a search box "Search locales…" and a list — `English (default)`, `Deutsch`, `Français`; a check beside English |
| 3 | Pick **Deutsch** | the popover closes, the flourish plays, then the URL gains `?locale=de` and the table shows `Winterstiefel`, not `Winter boots` |
| 4 | Add a search term and a filter, then switch locale again | `?search=` / `?filter=` survive — `updateParams` merges (`useTableUrlState:79-95`) |
| 5 | Go to page 3, then switch locale | the pager returns to page 1 (`resetPage` defaults to `true`, `useTableUrlState:88`) |
| 6 | Press the browser **Back** button after a switch | you leave the records list entirely — the switch used `{ replace: true }`, so it left no history entry (see EC-06) |
| 7 | Switch back to **English** | `?locale=` is **removed**, not set to `en` |
| 8 | Re-pick the locale that is already active | nothing happens — no re-scope, no flourish (`LocaleSwitcher:105-106`) |

**Keyboard-only path:** Enter on the trigger → focus lands in the search box
(`autoFocus`, `:166`) → ↓/↑ move the highlight → Enter picks → Escape closes and
Radix restores focus to the trigger.
**Screen-reader expectation:** the popover is a Radix dialog containing a
`listbox` named "Locales"; the highlighted row is pointed at by
`aria-activedescendant` on the search box — see `♿ A11Y-i18n-admin-03` for why
that is not reliably announced.

### F3 — Switcher search and keyboard list

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Type `deu` | only **Deutsch** remains (`matches` is case-insensitive over `"{slug} {name}"`, `:46-48,86-92`) |
| 2 | Type `de` | **Deutsch** and any locale whose *name* contains "de" |
| 3 | Type `zz` | "No locale found." |
| 4 | Type `  DE  ` (leading/trailing spaces, upper case) | still matches — the query is trimmed and lowercased |
| 5 | Press ↓ past the last row | the highlight wraps to the first (`(i + 1) % filtered.length`, `:123`) |
| 6 | Press ↑ on the first row | wraps to the last (`:126`) |
| 7 | Narrow the search so the highlight would fall off the end | the highlight resets to index 0 (`useEffect` on `[query, open]`, `:96`) — Enter is never a no-op |
| 8 | Press Enter with an empty result list | nothing happens (`:120`, `:129`) |
| 9 | Close and reopen the popover | the search box is empty again (`onOpenChange` clears `query`, `:141`) |
| 10 | Tab from the search box | focus leaves the list — rows are `tabIndex={-1}` (`:204`), deliberately |

### F4 — The switch flourish

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Switch to **Deutsch** | a full-screen near-opaque cover with a `Languages` glyph, a spinner, and "Switching to Deutsch…" (`LocaleSwitchOverlay:110-114`) |
| 2 | Watch the ordering | the cover appears **first**; the URL/table swap happens ~220 ms later, behind it (`COVER_MS`, `localeTransition:31,72-75`) |
| 3 | Throttle the network hard and switch | the cover holds until nothing is in flight (`useIsFetching`, `:54,61-66`), capped at 5 s (`MAX_HOLD_MS`, `:41`) |
| 4 | Switch on a warm cache | the cover still holds ≥380 ms (`MIN_HOLD_MS`, `:38`) and then fades out over 300 ms |
| 5 | Switch to Deutsch, then to Français within 200 ms | the pending apply is cancelled; only Français is applied (`:68-69`) and the caption reads "Switching to Français…" |
| 6 | Switch from the **editor's** locale panel | the same cover plays and **survives the navigation** — it is mounted page-level by content's `CONTENT_OVERLAY_SLOT`, not inside the editor (`i18nPlugin:109-115`) |
| 7 | Try to click something while the cover is up | the click **passes through** — the overlay is `pointer-events-none` (`:98`) |
| 8 | Press Tab while the cover is up | focus moves through the covered page you cannot see → `♿ A11Y-i18n-admin-05` |
| 9 | Switch with `prefers-reduced-motion: reduce` | no animation (`motion-reduce:animate-none`, `:98`) |

### F5–F6 — The Locales column

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Open the column picker → tick **Locales** | a new column appears; it is **not** sortable (extension columns are excluded from the server sort whitelist) |
| 2 | Open DevTools → Network | exactly **one** `POST …/locale-summary` per page render, carrying the page's unique group ids — never one per row (`useLocaleSummaries:57-63`) |
| 3 | Untick the column and reload the page | the `POST` still fires → `🐞 BUG-i18n-admin-03` |
| 4 | Look at a row whose group has `en` + `de` | two badges, `EN` and `DE`, uppercased |
| 5 | Look at a row with only `en` | one badge |
| 6 | Look at a row with no `localeGroupId` | the cell is empty (`LocalesColumnCell:23`) |
| 7 | Hover/inspect a badge | it is a link named "Open the en version (published)" (`LocaleBadge:41-44`) — the state rides the name, so colour alone conveys nothing |
| 8 | Publish one sibling and re-save it | that badge turns amber and its name says `(modified)` — the four-state classifier, not a two-way branch (`entryStatusView`) |
| 9 | Click a badge | the editor for **that locale's row** opens |
| 10 | Page forward while the column is on | a fresh single batch for the new page's group ids; the previous page's result stays cached under its own sorted-id key |

### F7 — Switch to an existing sibling from the editor

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Open `Winter boots` (en, group has a `de` sibling, no `fr`) | the Properties rail shows a **Locale** section with the description "Switch between this record's locales, or start a new translation." |
| 2 | Read the rows | `English` carries a check and `aria-current="true"`; `Deutsch` is a button "Switch to the Deutsch version" with its publish badge; `Français` is dimmed with a `+ Add` affordance |
| 3 | Press **Deutsch** | the flourish plays and the editor lands on `/localized_post/lp-de-1` |
| 4 | Check the title chip | it now reads `DE · Deutsch` |
| 5 | Save the record, then look at the panel | the rows refresh — the panel re-reads on `entry.updatedAt`, not `entry.status` (`LocaleWidget:127-132`) |
| 6 | Edit a **shared** field and save | the *siblings'* rows change state (Modified) even though this row's status did not — the reason `updatedAt` is the key |
| 7 | Open a record of a **non-publishable** localized type | rows carry no publish badge at all (`LocaleWidget:262-269` withholds `status`/`publishedAt`) |

### F8 — Create a translation

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | On `Winter boots`, press **Create the Français translation** | the URL becomes `/localized_post/new?locale=fr&localeGroupId=G1` |
| 2 | Inspect the form | shared (non-localized) fields are prefilled from the source; localized fields are blank (`applyTranslatePrefill`, `ContentEntryView:137-150`) |
| 3 | Press **Save draft** | a `POST` to the collection carrying `locale: 'fr'` **and** `localeGroupId: 'G1'` (`createBodyKeys`, `i18nPlugin:126`) — never a `PATCH` on the English row |
| 4 | Do it from the **Relations** tab | you land on the sibling's Relations tab, not General (`tabSegment`, `:222,231`) |
| 5 | Create a translation for a locale that already exists (race: another user creates `fr` first) | the save returns **409**, surfaced through the editor's ordinary save-error path — there is no dedicated create-translation call to give a better message |

### F9 — The panel in create mode

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Press **Add record** on a localized type | URL `/localized_post/new`, the panel is live, the description is the create copy: "Choose the locale for this new record — or switch to one that already exists." |
| 2 | Read the group footer | "Translation group" + the italic note "Assigned when this record is saved." (`LocaleWidget:308-311`) |
| 3 | Press **Deutsch** | the URL becomes `/localized_post/new?locale=de` with **no** `localeGroupId` — a fresh create, just re-scoped |
| 4 | Start from a *translation* draft (`?locale=fr&localeGroupId=G1`) instead | the panel knows the group's members via `useLocaleSummaries` (`:133-137`), so `Deutsch` is a live **switch** target |
| 5 | Press it | you leave the draft for `/localized_post/lp-de-1` |

### F10 — Translation-group id

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Open a saved localized record | the footer shows "Translation group" and the raw uuid in a monospace, `break-all` block |
| 2 | Press the ⓘ button (named "What is the translation group?") | a tooltip explaining that every locale shares one id, assigned on first save |
| 3 | Reach the ⓘ by keyboard | it is a real `<button>` with a visible focus ring (`:288-297`) — Tab reaches it, and the tooltip opens on focus |

### F11 — The unsaved-changes guard

**Preconditions:** an editable localized record.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Edit the Title (do not save), then press **Deutsch** in the panel | the app-wide confirm dialog appears — the same one every other navigation shows (`requestLocale` → `guard.confirmNavigation`, `LocaleWidget:195-199`) |
| 2 | Cancel | you stay on the record, the edit intact, **and no flourish plays** — `beginLocaleSwitch` only runs inside `run` |
| 3 | Confirm | the guard clears, the flourish plays, and the sibling opens; the edit is gone (expected — the user was asked) |
| 4 | Edit and press the browser reload | the native `beforeunload` prompt fires (`unsavedChanges:161-169`) |
| 5 | Edit, then click a **Locales column** badge from the records list | a plain `<Link>`, so it is caught by the document-level capture-phase interceptor (`unsavedChanges:112-157`) |
| 6 | Edit and press the toolbar **locale switcher** | there is no editor mounted on the records route, so nothing is dirty — checked, see EC-13 |

### F12 — The title chip

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Open an `en` record | a badge beside the title reading `EN · English`, accessible name "Current locale: English" |
| 2 | Open a `de` record | `DE · Deutsch` |
| 3 | Open a create form with `?locale=fr` | `FR · Français` — resolved from the URL (`resolveActiveLocale`, `LocaleTitleChip:31-35`) |
| 4 | Open the chip on a non-i18n type | nothing renders (`:29`) |
| 5 | Try to click it | it is a static `Badge` — switching lives in the panel and the toolbar |

### F13 — Locale filter fields

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Open **Filters** on a localized type → add a rule → open the field picker | three extra fields: **Has locale**, **Missing locale**, **Locale count** |
| 2 | Choose **Missing locale** | the value editor offers the configured slugs as enum options labelled with their display names (`useLocaleFilterFields:39-45`) |
| 3 | Apply `Missing locale = de` and press Apply | the URL gains a `?filter=` JSON; the table narrows to records with no German row |
| 4 | Page to page 2, then refetch (switch tab and back) | the filter survives — it is URL state, merged by `updateParams` |
| 5 | Switch locale with the filter applied | the filter survives; only `?locale=` and `?page=` change |
| 6 | Add **Locale count** `< 3` | the same virtual field, resolved server-side |
| 7 | Do the same on a **non-localized** type | none of the three fields is offered (`:38`) |
| 8 | Reload the page with a saved `?filter=` naming `hasLocale`, and open the Filters panel immediately | for the first paint the rule may report "Unknown field" while `useLocales` is still in flight (see EC-16) |

### F14 — Entry params

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Open a **single** (page) localized type with `?locale=de` | the one-entry read carries `locale=de` (`listParamKeys`, `i18nPlugin:123`) and the German row is shown |
| 2 | Save a create form opened with `?locale=de&localeGroupId=G1` | the `POST` body carries **both** keys (`createBodyKeys`, `:126`) |
| 3 | On a `de` record, open a relation picker targeting another **i18n** type | the candidates request carries `?locale=de` — strictly, with **no** default fallback (`:132-141`) |
| 4 | Do the same on a **create** form (`?locale=de`, no saved entry) | still `?locale=de` — read from `source.params` (`:137`) |
| 5 | Open a relation picker targeting a **non-i18n** type | no locale param (`targetSchema.i18n` is false → `{}`) |
| 6 | Open a fresh default-locale create and pick a relation | `{}` → the server scopes to the default locale |

### F15 — Publish all locales

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Open a saved localized publishable record with 2+ existing siblings, press ⋯ | the menu reads: Save draft · Save & publish · Unpublish · **Publish all locales** · **Unpublish all locales** · Delete, with 3 separators |
| 2 | Choose **Publish all locales** | content's `BulkPublishDialog` opens, titled "Publish 2 locales of this record?" |
| 3 | Read the rows | rows are named by **locale** ("English", "Deutsch"), not by the record title — every sibling shares one title (`labelFor: nameFor`, `usePublishAllLocales:67-70,88`) |
| 4 | Confirm | only the rows that pass the dry run publish; a toast reports the count; the panel refetches (`onPublished`, `:89`) |
| 5 | Open a record with exactly **one** locale present | the item is absent (`ids.length < 2`, `:65`) |
| 6 | As a user without `content:publish` | the item is absent |
| 7 | On a **non-publishable** localized type | absent (`applies` requires `schema.publishable`, `:53-54`) |
| 8 | On an **unsaved** record | absent, and **no** request is issued (`useEntryLocales(…, applies)`) |

### F16 — Unpublish all locales

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | With one live locale, choose **Unpublish all locales** | a `ConfirmDialog`: "Unpublish 1 live locale?" / "This takes English offline. The content is kept as a draft and can be published again." |
| 2 | With two live locales | "Unpublish 2 live locales?" and both names, comma-joined (`:175-177`) |
| 3 | Confirm | content's bulk unpublish over their ids; a success toast "2 locales unpublished."; the panel refetches |
| 4 | Make the request fail (stop the API) | an error toast "Couldn't unpublish. Please try again." and the dialog closes anyway (`finally`, `:211`) |
| 5 | With **nothing** live | the item is absent (`ids.length === 0`, `:173`) |
| 6 | While the mutation is in flight | the item is `disabled` and the dialog is `busy` (`:182,196`) |

### F17 — Tab preservation

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Open a record, go to the **Relations** tab, switch to the German sibling | you land on `/localized_post/lp-de-1/relations`, with the Relations tab `aria-selected="true"` |
| 2 | Do the same for a **missing** locale | `/localized_post/new/relations?locale=fr&localeGroupId=G1` |
| 3 | Do it from the default (General) tab | no tab segment appended (`tabSegment` is `''`) |

### F18–F21 — The coverage card

**Preconditions:** a workspace with localized content in 3 configured locales.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Open Insights | the **Translation coverage** card, full width, first in _Localisation & media_ |
| 2 | Read the three figures | `Localized` / `in every language`, `Not localized` / `no translations started`, `Needs translation` / `missing at least one` |
| 3 | Try to reconcile them | they deliberately **overlap** — `notLocalized ⊆ requiresLocalization`; the hints are what stop a reader subtracting one from the other |
| 4 | Read the top-right chip | "122 to translate" in a warn tone, or "Fully translated" with a check when `requiresLocalization === 0` |
| 5 | Read the footer | "Across 140 localized records in 3 content types." |
| 6 | Read the **By language** bars | one row per configured locale (including untouched ones), the row label, a split bar, the translated count, and the share as a percentage |
| 7 | Press **By type** | bars, legend ("Fully localized" / "Needs translation") and subtitle ("Where the outstanding translation work sits") all change together; the three headline figures do **not** move |
| 8 | Watch the network | **no second request** — one payload, two views |
| 9 | Press the already-active segment | it stays selected (Radix's clear is swallowed, `CoverageModeToggle:51-55`) |
| 10 | Note the denominators | By language every bar scales against the workspace record count; by type against the biggest type's record count (`:199-201`) |

**Keyboard-only path:** Tab reaches the segmented control as a radiogroup named
"Break down by"; ←/→ move focus between segments, Enter/Space commits.
**Screen-reader expectation:** the figures read as "38 / Localized / in every
language"; the bars themselves are silent — see `♿ A11Y-i18n-admin-04`.

### F22–F23 — Permissions and the state ladder

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Sign in as a user holding only `media:read` | the coverage card is absent, and no `GET /insights/i18n/coverage` is issued (`enabled: canRead`) |
| 2 | Throttle the API | the card shows 4 skeleton rows, and **no chip** (`WidgetCard:80` suppresses the action until there is data) |
| 3 | Fail only `i18n/coverage` | that card shows a `role="alert"` error — the other three cards in the band are untouched |
| 4 | Point at a workspace with no localized records | the empty state "Nothing to show for this period yet." — **and a green "Fully translated" chip**, over a card that has nothing (see EC-24) |
| 5 | Retry behaviour | exactly one retry, not three (`retry: 1`, `useLocalizationCoverage:49`) |
| 6 | Switch workspace | a refetch — the key is workspace-scoped (`localizationCoverageKey`) |

### F24–F26 — Pure rules and the data layer

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Open an entry with `entry.locale = 'de'` and the URL `?locale=fr` | the chip and the panel both say **German** — the entry wins (`resolveActiveLocale`, `localePolicy:31`) |
| 2 | Open `?locale=en` (the default) explicitly | everything works, but the switcher will rewrite the URL to a clean one the moment you switch away and back |
| 3 | Watch `GET /api/i18n/locales` across a whole session | issued **once** (`staleTime: Forever`) and never re-keyed per workspace |
| 4 | Reorder rows on a records page without changing membership | no new `locale-summary` request — the key is the **sorted unique** id array (`useLocaleSummaries:57-59`) |
| 5 | Open a page where every row lacks a `localeGroupId` | no request at all (`uniqueIds.length > 0`) |

## 4. Edge Cases & Negative Paths

### The locale set (`useLocales`)

- **EC-01 — `GET /api/i18n/locales` fails (500 / network drop).** `❌ NONE`
  `useLocales` swallows it: `locales = query.data?.items ?? []`
  (`useLocales:34`). Every consumer then early-returns — the switcher
  (`LocaleSwitcher:98`), the widget (`LocaleWidget:139`), the chip
  (`LocaleTitleChip:29`), the filter fields (`useLocaleFilterFields:38`) — so the
  whole plugin **vanishes with no error anywhere**, while `?locale=de` stays in
  the URL and keeps scoping the list. → `🐞 BUG-i18n-admin-02`.
- **EC-02 — Zero locales configured.** `❌ NONE` Same code path as EC-01, and
  correct: nothing to switch between.
- **EC-03 — Exactly one locale configured.** `❌ NONE` The switcher renders with a
  single option; the panel lists one row, always `isCurrent`, never actionable.
  Coverage reports `notLocalized: 0` by construction (server-side). Fine.
- **EC-04 — Two locales both flagged `isDefault`.** `❌ NONE`
  `locales.find(l => l.isDefault)` (`useLocales:37`) takes the **first**; the
  server's `Locale` value object is supposed to reject this. Client is tolerant,
  not authoritative. Cleared.
- **EC-05 — No locale flagged `isDefault`.** `❌ NONE` `defaultLocale` is
  `undefined` → `resolveActiveLocale` returns `undefined` → the chip renders
  nothing, and `toLocaleListParam(slug, undefined)` always writes the slug, so
  even the "default" locale spells itself into the URL. Degrades sanely.
- **EC-06 — Browser Back after a locale switch.** `❌ NONE`
  `useTableUrlState:91` uses `{ replace: true }`, so a switch leaves **no history
  entry**: Back exits the records list rather than restoring the previous locale.
  Consistent with search/filter/sort (all use the same reducer), so this is a
  deliberate house style, not a defect. Recorded.

### `?locale=` values

- **EC-07 — `?locale=` naming a slug that is not configured** (typo, or a locale
  removed from `ortha.config.ts` — see `🐞 BUG-i18n-server-03`). `❌ NONE`
  `active = locales.find(…) ?? defaultLocale` (`LocaleSwitcher:100-101`), so the
  **trigger claims "English"** while the list request carries `?locale=xx`. Verified
  against the server: an unknown locale on a list is a **400**, not an empty result
  (`apps/server-e2e/src/server/i18n/i18n-content.spec.ts:182-185`, "400s a list scoped to
  an unknown locale"), so the table renders content-admin's **error** state under a
  switcher confidently reporting English — and re-picking English is swallowed by the
  identity guard at `:105-106`, so the one control that would clear the param does
  nothing. → `🐞 BUG-i18n-admin-04`.
- **EC-08 — `?locale=` with an empty value (`?locale=`).** `❌ NONE`
  `params[LOCALE_PARAM]` is `''`; `resolveActiveLocale` uses `??`, and `''` is not
  nullish, so `activeSlug = ''` → `active` falls back to the default. The empty
  param is then forwarded verbatim to the list request. Low, folded into
  `🐞 BUG-i18n-admin-04`.
- **EC-09 — `?locale=` repeated (`?locale=de&locale=fr`).** `❌ NONE`
  `searchParams.get` takes the first; `updateParams` rewrites via `set`, which
  collapses duplicates. Cleared.
- **EC-10 — A very long / unicode / path-traversal `?locale=` value.** `❌ NONE`
  Never used to build a path on the client — only a query value and a lookup key.
  `localeName` returns `undefined` and the chip prints `slug.toUpperCase()`
  (`LocaleTitleChip:47`) as **text**, so React escapes it; `<script>` in the param
  renders as literal text. No XSS. Cleared.
- **EC-11 — An entry whose `locale` is not in the configured set** (an orphaned
  row after a config change). `❌ NONE`
  `currentLocale` matches no row, so **every** configured locale in the panel
  renders as actionable — including "Add" for locales that in fact exist under a
  different slug. Folded into `🐞 BUG-i18n-admin-04`.

### The panel and the summaries (error-vs-empty)

- **EC-12 — `GET …/:id/locales` fails.** `❌ NONE`
  `siblingFor` reads `entryLocales.data?.items?.find(…)` (`LocaleWidget:176`), so
  every locale resolves to `undefined` → the panel says **no translations exist**
  and offers "Create the Deutsch translation" for a sibling that does. Pressing it
  produces a create form whose Save 409s. The `.cursor/BUGBOT.md` "error
  masquerading as empty" pattern, on the plugin's primary surface. →
  `🐞 BUG-i18n-admin-01`.
- **EC-13 — `POST …/locale-summary` fails.** `❌ NONE`
  `groups: query.data?.groups ?? {}` and `isPending` is false once settled
  (`useLocaleSummaries:65-68`), so `members` is `[]` and the Locales cell renders
  **nothing** — visually identical to "this record has no other locales". Same
  bug.
- **EC-14 — A group id in the response that was not requested / a requested id
  missing from the response.** `❌ NONE`
  `summaries.groups[entry.localeGroupId] ?? []` (`LocalesColumnCell:31`) —
  tolerant both ways, and the server echoes back only the caller's own keys.
  Cleared.
- **EC-15 — The Locales column is toggled OFF.** `❌ NONE`
  `useRowsData` still runs — the render site loops over **every registered**
  extension item, not the visible ones
  (`LoadedRecordsView:369-375`), and the slot contract has no visibility signal
  (`contentSlots:88-93`). The column is hidden by default, so this is the normal
  case. → `🐞 BUG-i18n-admin-03`.
- **EC-16 — A saved `?filter=` naming `hasLocale`, opened cold.** `❌ NONE`
  `useLocaleFilterFields` returns `[]` until `useLocales` resolves, so for the
  first paint `RuleRow` reports **`UnknownField`**
  (`query-builder-admin/.../RuleRow/index.tsx:116-125`) rather than silently
  dropping the rule — the right failure mode. Only visible if the panel is open
  during that window (it is closed by default). Low; recorded, not filed.
- **EC-17 — The panel on a record whose group has 20 locales.** `❌ NONE`
  One `<li>` per configured locale in a flat `<ul>`; no virtualisation, no
  scroller. Fine at realistic sizes.

### Mutations, invalidation and staleness

- **EC-18 — Create a translation, then return to the records list.** `❌ NONE`
  Nothing invalidates `localeSummariesPrefix` or `entryLocalesPrefix` — both are
  exported (`useLocaleSummaries:26`, `useEntryLocales:18`) and **used nowhere**
  (`grep -rn "localeSummariesPrefix\|entryLocalesPrefix" packages apps` → only
  their own definitions). It self-heals only because the default
  `queryClient` has `staleTime: 0` (`utils/admin/.../queryClient/index.ts:9`),
  so a remount refetches. Dead invalidation helpers over an accidental
  correctness; worth stating.
- **EC-19 — Publish all locales, then look at the records table's Locales
  column.** `❌ NONE` `onPublished` refetches only `entryLocales`
  (`usePublishAllLocales:89`); the column's query is untouched. Same self-heal as
  EC-18.
- **EC-20 — Over-invalidation.** `❌ NONE` The opposite problem here: this plugin
  invalidates **nothing** globally. `.cursor/BUGBOT.md`'s over-invalidation
  pattern does not apply. Checked and cleared.
- **EC-21 — Stale page after a mutation.** `❌ NONE` This plugin owns no list and
  no pager; the page clamp lives in `LoadedRecordsView:333-340` and a locale
  switch resets `page` outright. The BUGBOT "stale page" pattern does not apply.
  Cleared.
- **EC-22 — Unpublish-all fails halfway.** `❌ NONE`
  `useBulkEntryActions.unpublish` is content's single bulk endpoint over an id
  array, not a fan-out, so there is no partial-application class here (unlike
  `🐞 BUG-media-admin-02`). Cleared.
- **EC-23 — Two tabs, one publishing while the other has the panel open.** `❌ NONE`
  The panel only re-reads on its own `entry.updatedAt`, so the other tab's badges
  stay stale until a remount. Low.

### Coverage arithmetic at the boundaries

- **EC-24 — Zero records (`records: 0`).** `❌ NONE`
  `isEmpty = records === 0` (`:230`) → the empty branch. But `requires` is
  `data?.requiresLocalization ?? 0` = 0, and `WidgetCard:80` renders the `action`
  whenever `hasData`, **including the empty branch** — so an untouched workspace
  gets a green **"Fully translated"** chip over "Nothing to show for this period
  yet." Two problems in one line: an unearned all-clear, and copy naming a
  "period" this widget explicitly does not have (asserted at
  `insights.spec.ts:271-277`). → `🐞 BUG-i18n-admin-07`.
- **EC-25 — Divide-by-zero / NaN.** `❌ NONE` `share()` guards `total > 0`
  (`:289-291`) and `BarRows` clamps its denominator to ≥1 (`BarRows:67`). **No
  NaN and no `Infinity` is reachable** — matching what the server artifact
  concluded (`docs/testing/i18n-server.md`, EC-30: "the risk lives in i18n-admin,
  not here"). Checked and cleared.
- **EC-26 — 0% (a locale with nothing translated).** `❌ NONE`
  `share(0, 140)` → `"0%"`; the zero-valued segment is **dropped, not drawn**
  (`BarRows:82`), so the row is a bare "missing" bar. Correct.
- **EC-27 — 100%.** `❌ NONE` `share(140, 140)` → `"100%"`, and the missing
  segment disappears. Correct.
- **EC-28 — Rounding at the edges.** `❌ NONE`
  `Math.round((value / total) * 100)` — 1 translated of 1000 reads **"0%"** beside
  a visible 3px bar, and 999 of 1000 reads **"100%"** beside a card whose chip
  simultaneously says "1 to translate". → `🐞 BUG-i18n-admin-05`.
- **EC-29 — A type with `records: 0` in the By type view.** `❌ NONE`
  `share(x, 0)` → `undefined` → no secondary column; `max` falls back through
  `BarRows`. The server omits unused types anyway. Cleared.
- **EC-30 — Every type has 0 records.** `❌ NONE`
  `max = Math.max(...[], 0) = 0` (`:199-201`) → `BarRows` denominator 1 → all
  segments filtered out (value 0) → an empty bar list under a legend. Reachable
  only if `records > 0` while every `type.records === 0`, which the server's
  aggregation prevents. Cleared.
- **EC-31 — `Math.max(...types.map(…))` with a very large `types` array.**
  `❌ NONE` A spread over thousands of arguments can blow the stack; a workspace
  has tens of content types. Not reachable. Cleared.
- **EC-32 — `missing` larger than `records` (inconsistent payload).** `❌ NONE`
  Widths are clamped to `[0, 100]` (`BarRows:88-95`), so the bar cannot overflow;
  the readout would still print the wrong number. Server-side invariant.

### Permission matrix

- **EC-33 — `viewer` (holds `content:read`, not `content:create`/`publish`).**
  `⚠️ PARTIAL` The switcher, column, chip, filters and coverage card all render;
  the panel's **missing**-locale rows become non-actionable static `<li>`s at
  `opacity-50` with **no explanation** (`LocaleRow:108-119`) — see
  `♿ A11Y-i18n-admin-07`. Both ⋯ items are hidden. The permission-gating half is
  pinned for coverage only (`insights.spec.ts:390`).
- **EC-34 — `contributor` (create but not publish).** `❌ NONE`
  Missing locales are actionable; both all-locales items hidden. Untested.
- **EC-35 — A user with no `content:read`.** `❌ NONE`
  The coverage query never fires (`enabled: canRead`) and the card is not
  contributed (`permission: CONTENT_READ`, `i18nPlugin:175`) — so a reader who may
  not see entries cannot count them through the gaps. Asserted for the card
  (`insights.spec.ts:390-406`); the content surfaces are gated by content-admin's
  own route guard, not by this plugin.
- **EC-36 — Unauthenticated.** `❌ NONE` Nothing here is reachable — every surface
  lives inside the shell's private routes. 🔒 Nothing in this unit performs its
  own authorization; the server guard is the boundary.
- **EC-37 — Tenant isolation.** `❌ NONE`
  Three of the four query keys carry `workspace.id`
  (`useEntryLocales:8`, `useLocaleSummaries:16`, `useLocalizationCoverage:16`) and
  the workspace only reaches the server as an ambient `X-Workspace-Id` header, so
  the keys are what prevent one workspace's panel showing under another.
  `useLocales` is deliberately **global** — deployment config, no per-workspace
  data. Switching workspace with a record open unmounts the route, so no foreign
  id survives. Checked and cleared.
- **EC-38 — A `localeGroupId` from another workspace typed into the URL.**
  `❌ NONE` `useLocaleSummaries` batches it; the server returns an empty array for
  it (per `docs/testing/i18n-server.md`, EC-40 — "the request's own keys are
  echoed back"), so the panel shows every locale as missing. No leak; confusing.

### The transition store (module-level global)

- **EC-39 — Navigate away within `COVER_MS` (220 ms) of pressing a locale.**
  `❌ NONE` `applyTimer` is cancelled only by another `beginLocaleSwitch`
  (`localeTransition:68-75`); there is no unmount or route-change cleanup, so the
  deferred `updateParams`/`navigate` still runs. → `🐞 BUG-i18n-admin-06`.
- **EC-40 — Two `LocaleSwitchOverlay` hosts mounted at once.** `❌ NONE`
  Only one is contributed and content renders `CONTENT_OVERLAY_SLOT` once
  (`ContentOverlays/index.tsx:12`). Registering `I18nPlugin()` **twice** would
  duplicate it — `createSlot._register` is a bare `push` with no dedupe
  (`utils/admin/.../slot/index.ts:36`) — and would also duplicate the Locales
  column under one id. A host-wiring hazard, not a defect in this unit.
- **EC-41 — `MAX_HOLD_MS` fires while a request is still in flight.** `❌ NONE`
  `clear()` uncovers the page mid-fetch, which is exactly what the ceiling is for:
  a stalled request must not leave the page covered forever. Correct.
- **EC-42 — `settleLocaleSwitch` called before the floor.** `❌ NONE`
  Returns `false`; the host re-checks after `LOCALE_SWITCH_MIN_HOLD_MS`
  (`LocaleSwitchOverlay:61-66`) — which is the fix for the "loads faster than the
  floor and never settles" case the comment describes. Cleared.
- **EC-43 — `useIsFetching()` counts unrelated queries.** `❌ NONE`
  A background poll anywhere in the app extends the cover up to 5 s. Documented as
  a deliberate trade at `LocaleSwitchOverlay:50-53`. Recorded.
- **EC-44 — StrictMode double-invocation.** `❌ NONE`
  `beginLocaleSwitch` is called from an event handler, not an effect; the
  overlay's effects clear their own timers. Cleared.

### 4A. Accessibility & Section 508 Conformance

**Baseline: ❌ — there is no automated a11y coverage of any i18n content
surface.** `apps/admin-e2e/src/content/a11y.spec.ts` seeds `LIBRARY_WORKSPACE`
(`mockContentSchema`, not `mockI18n`), so the locale switcher, the Locales
column, the panel, the chip and the overlay are **never in the DOM during any axe
scan**; there is no `src/content/keyboard.spec.ts` at all. The **only** automated
a11y contact this unit has is indirect: `apps/admin-e2e/src/insights/a11y.spec.ts:23,36,48`
scans the whole Insights page, which contains the coverage card in its
**By language** state. The By type state, the switcher popover, the panel and the
overlay have never been scanned.

And a clean axe run would not settle it anyway. Axe cannot see whether the
switcher's active option is announced, whether focus is visible under a
95%-opaque cover, whether an accessible name is *meaningful*, or whether the
right language is declared. No rules are disabled in
`apps/admin-e2e/src/support/a11y.ts` — the helper only formats violations
(`:12-23`) and `makeAxe` uses the four standard tag sets
(`support/fixtures.ts:108-117`) — so there is no hidden suppression here; there is
simply no scan.

This unit does several things well and they should not be lost in a rewrite:
every icon is `aria-hidden`; the switcher trigger, the ⓘ button, every panel row
and every locale badge carry real `aria-label`s; the current row carries
`aria-current`; the panel is a real `<ul>`/`<li>`; the switch overlay is a
`role="status"` live region and carries `motion-reduce:animate-none`; publish
state reaches the name of the badge rather than living in the tint alone; and the
coverage figures are printed as numbers, never as a bar alone. The findings below
are what remains.

#### ♿ A11Y-i18n-admin-01 — The content locale is never propagated as `lang`, so every non-default locale is announced with English pronunciation
**WCAG:** 3.1.2 Language of Parts (AA), 3.1.1 Language of Page (A) · **508:** E205.4, 504.2 · **Verdict: Does Not Support**
**Location:** `apps/admin/index.html:2` (`<html lang="en">`, hardcoded), `packages/bootstrap/admin/src/lib/createAdmin/index.tsx:43,71` (`locale = 'en'`; nothing writes `document.documentElement.lang`), and by omission every i18n surface — `packages/i18n/admin/src/lib/components/LocaleTitleChip/index.tsx:41-49`, `.../LocaleWidget/index.tsx:238-278`
`grep -rn "lang=" packages apps --include=*.tsx --include=*.html` returns exactly
one hit: the hardcoded `<html lang="en">`. The slugs this plugin already holds
(`en`, `de`, `pt-br`) are BCP-47-shaped and are the natural `lang` value, and the
plugin knows the active locale on every surface — `resolveActiveLocale`
(`domain/localePolicy/index.ts:28`) is called by the chip, the panel and the
switcher — yet nothing sets `lang` on the entry form, on a field, on a locale
badge, or on the panel row that prints "Deutsch".
**Repro:** configure `de`, open a German record, inspect the DOM.
→ Observed: the German title/body sits inside `<html lang="en">` with no `lang`
override anywhere. → Expected: the field region carrying that locale's content
declares `lang="de"`.
**Keyboard-only / SR experience:** a screen reader pronounces German, French and
Arabic content with English phoneme rules — the single most audible failure in a
localization tool. The locale *names* in the switcher ("Deutsch", "Français") are
mispronounced for the same reason, even before any content is opened.
**Remediation:** set `document.documentElement.lang` from the host `IntlProvider`
locale (the `accessibility` skill already requires this: "Set `<html lang>` to the
active locale … WCAG 3.1.1"), and have this plugin put `lang={slug}` on the entry
editor's field region and on each locale's own name in the switcher and panel.
Pairs with `♿ A11Y-i18n-server-02`, which is the server half.

#### ♿ A11Y-i18n-admin-02 — An RTL locale can be configured and edited, but nothing sets `dir`, so the layout never mirrors
**WCAG:** 1.3.2 Meaningful Sequence (A), 1.4.10 Reflow (AA) · **508:** E205.4, 504.2 · **Verdict: Does Not Support**
**Location:** the whole unit — `grep -rn "dir=" packages/i18n/admin` returns **no matches**; the only `rtl:` utility anywhere in the repo is `packages/design-system/src/lib/components/ui/calendar.tsx:31-32`
The server accepts `ar`/`he` as slugs (`♿ A11Y-i18n-server-01`), and this plugin
will happily switch to them: the switcher lists them, the chip prints `AR ·
العربية`, the panel offers "Create the العربية translation". Nothing sets
`dir="rtl"` on `<html>`, on the editor, on a field, or on the overlay's caption.
**Repro:** add `{ slug: 'ar', name: 'العربية' }` to `apps/server/ortha.config.ts`;
switch the records list to it.
→ Observed: Arabic strings render in an LTR box. Punctuation and mixed
Arabic/Latin runs order wrongly; the panel's `justify-between` layout
(`LocaleRow:83`) keeps the check glyph on the left and the badge on the right,
which is backwards; the chip prints `AR · العربية` with the separator on the wrong
side. → Expected: `dir="rtl"` on the surface holding that locale's content, and a
mirrored layout.
**Keyboard-only / SR experience:** an RTL author gets wrong caret movement,
wrong Home/End behaviour, and a reading order that contradicts the visual order —
which is 1.3.2 exactly. At 320px/400% zoom (1.4.10) the unmirrored bidi runs make
truncation cut the wrong end of every string.
**Remediation:** blocked on the server exposing `dir` per locale
(`♿ A11Y-i18n-server-01`); once it does, set `dir` alongside `lang` on the same
regions as `♿ A11Y-i18n-admin-01`, and audit the panel/chip/switcher for
`ms-`/`me-` logical properties instead of `ml-`/`mr-`.

#### ♿ A11Y-i18n-admin-03 — The switcher's search box drives an `aria-activedescendant` list without being a `combobox`
**WCAG:** 4.1.2 Name, Role, Value (A), 2.1.1 Keyboard (A) · **508:** 502.3, 502.2 · **Verdict: Partially Supports**
**Location:** `packages/i18n/admin/src/lib/components/LocaleSwitcher/index.tsx:165-190`
```tsx
<Input
    autoFocus
    aria-label={intl.formatMessage(messages.searchPlaceholder)}
    aria-controls={listId}
    aria-activedescendant={filtered[activeIndex] ? `${listId}-…` : undefined}
/>
<div id={listId} role="listbox" aria-label={intl.formatMessage(messages.list)}>
```
The keyboard *mechanics* are right and deliberate (the JSDoc at `:59-67` explains
why rows are `tabIndex={-1}`): ↑/↓ move the highlight, Enter picks, focus stays in
the box. What is missing is the role that makes `aria-activedescendant` legible to
AT — the input has no `role="combobox"`, no `aria-expanded`, and no
`aria-haspopup="listbox"`. On a plain textbox, `aria-activedescendant` is widely
ignored, so the highlighted locale is **not announced as you arrow through it**.
The Radix trigger contributes `aria-haspopup="dialog"`/`aria-expanded` for the
*popover*, not for this list.
**Repro:** open the switcher with a screen reader, press ↓ twice.
→ Observed: the visual highlight moves; nothing is spoken. → Expected: "Deutsch,
option 2 of 3".
**Keyboard-only experience:** fine — this is an SR-only gap.
**Remediation:** add `role="combobox" aria-expanded="true" aria-controls={listId}
aria-autocomplete="list"` to the `Input`, and keep everything else as is.

#### ♿ A11Y-i18n-admin-04 — The coverage bars carry no text alternative, and the "missing" half exists only as colour plus a native `title`
**WCAG:** 1.1.1 Non-text Content (A), 1.4.1 Use of Colour (A), 1.4.13 Content on Hover or Focus (AA) · **508:** E205.4, 502.3 · **Verdict: Partially Supports**
**Location:** `packages/insights/admin/src/lib/presentation/components/BarRows/index.tsx:80-103` (rendered from `packages/i18n/admin/src/lib/components/LocalizationCoverageWidget/index.tsx:135-192,278-281`)
Each segment is a bare `<span>` whose only description is `title={segment.label}`.
The row's `readout` prints the **translated** count and `secondary` the share, so
that half is text — but the **missing** count reaches the user only through the
red-ish `series-2` fill and the browser tooltip. Two consequences: 1.4.1, because
the second series is distinguished from the first by hue alone; and 1.1.1, because
the bar itself is a graphic with no accessible name. This is a **regression against
this page's own bar** — `insights/a11y.spec.ts:106-131` asserts that the other
charts are `role="img"` with a descriptive name ("Editing activity by weekday",
"…% of images have alt text"), and `BarRows` is the one form on the page that
isn't. A native `title` is also not keyboard-reachable and not dismissible, which
is what 1.4.13 asks for.
**Repro:** open Insights with a screen reader and move through the coverage card.
→ Observed: "Deutsch 84 60%" — the outstanding 56 records are never spoken.
→ Expected: the row states both series.
**Keyboard-only experience:** the tooltips are unreachable — there is nothing
focusable in the chart.
**Remediation:** give `BarRows` a `role="img"` with an `aria-label` summarising
every segment (the strings already exist as `segment.label`), or add an `sr-only`
sentence per row; extend `readout` to name the second value. Fixing it in
`BarRows` fixes every widget that uses it.

#### ♿ A11Y-i18n-admin-05 — The switch overlay hides the page visually but leaves it fully focusable underneath
**WCAG:** 2.4.7 Focus Visible (AA), 4.1.2 Name, Role, Value (A), 3.2.2 On Input (A) · **508:** 502.2, 502.3 · **Verdict: Partially Supports**
**Location:** `packages/i18n/admin/src/lib/components/LocaleSwitchOverlay/index.tsx:93-102`
```tsx
<div role="status" aria-live="polite"
     className={cn('pointer-events-none fixed inset-0 z-50 … bg-background/95 backdrop-blur-sm …')}>
```
Announcing the transition is right, and `pointer-events-none` is a deliberate
choice for the mouse. But nothing is `inert`, nothing is `aria-hidden`, and no
focus is moved — so for the 0.6–5 s the cover is up, Tab walks the page behind a
95%-opaque blur: focus rings are invisible, and Enter can activate a control the
user cannot see. Worse, the deferred swap lands **during** that window
(`localeTransition:72-75`), so the thing under the user's focus can change out
from under them without any input of theirs — a change of context they did not
request (3.2.2), and the functional twin of `🐞 BUG-i18n-admin-06`.
**Repro:** switch locale, then hold Tab.
→ Observed: focus moves through invisible controls; the focus ring is behind the
blur. → Expected: the page under the cover is inert, and focus is parked on the
status region or restored to the switcher when it lifts.
**Keyboard-only / SR experience:** "Switching to Deutsch…" is announced once
(good), then the user is silently adrift in a page they cannot see.
**Remediation:** mark the app root `inert` while a switch is active and restore
focus (to the switcher trigger, or to the destination's `<h1>`) when the cover
lifts. Keep the live region.

#### ♿ A11Y-i18n-admin-06 — A locale badge's accessible name embeds an untranslated machine token
**WCAG:** 4.1.2 Name, Role, Value (A), 3.1.2 Language of Parts (AA) · **508:** 502.3 · **Verdict: Partially Supports** · cross-ref `🐞 BUG-i18n-admin-08`
**Location:** `packages/i18n/admin/src/lib/components/LocalesColumnCell/LocaleBadge/index.tsx:37-44`
`const view = entryStatusView(item);` returns the raw union member — `'draft'`,
`'modified'`, `'published'` — and it is interpolated straight into
`"Open the {locale} version ({status})"`. Putting the state in the name is exactly
right for 1.4.1 (the comment at `:34-36` says so); the value put there is the
wrong one. The sibling surface does it properly: `EntryStatusBadge` maps the same
view through `defineMessages` (`packages/content/admin/src/lib/presentation/components/EntryStatusBadge/index.tsx:11-30`).
**Repro:** enable the Locales column, inspect a badge link.
→ Observed: `aria-label="Open the de version (modified)"` — lowercase English in
every UI language. → Expected: the localized "Modified".
**SR experience:** the only per-badge state cue is spoken as an untranslated
identifier; in a non-English admin UI it is meaningless.
**Remediation:** import the same message map `EntryStatusBadge` uses (or export
it) and format the view before interpolating.

#### ♿ A11Y-i18n-admin-07 — A locale the user may not create renders as a 50%-opacity row with no reason and no state
**WCAG:** 1.4.3 Contrast (Minimum) (AA), 1.3.1 Info and Relationships (A) · **508:** E205.4 · **Verdict: Partially Supports**
**Location:** `packages/i18n/admin/src/lib/components/LocaleWidget/LocaleRow/index.tsx:106-119`
```tsx
<li aria-current={isCurrent ? 'true' : undefined}
    className={cn(rowClass, isCurrent && 'bg-accent', !isCurrent && 'opacity-50')}>
```
For a `viewer`, `actionable` is false (`LocaleWidget:250`), so a missing locale
falls to this branch: `opacity-50` over `text-muted-foreground` (`LocaleRow:57-59`)
— i.e. a token that was specifically darkened to *just* clear 4.5:1 (per the
`accessibility` skill, "Color & contrast"), then halved. It is almost certainly
below AA, and nothing says **why** the row is inert; the "+ Add" affordance is
suppressed too (`:72`, which requires `onSelect`), so the row reads as an
unexplained ghost. Compare the actionable branch, which is a real button with a
descriptive name.
**Repro:** sign in as a `viewer`, open a localized record, look at an
untranslated locale.
→ Observed: a dim row with a name and nothing else. → Expected: a stated reason
("Not translated — you don't have permission to create one") at full contrast.
**Keyboard-only / SR experience:** the row is not focusable and carries no state,
so a screen-reader user cannot tell a *missing* locale from a *forbidden* one.
**I did not measure the computed ratio** — flagged **Unverified** on the contrast
half; the missing information is verified from the code.
**Remediation:** replace `opacity-50` with an explicit muted token that still
meets 4.5:1, and render a short reason (or `aria-disabled` on a real control) so
the state is programmatic, not visual.

#### ♿ A11Y-i18n-admin-08 — The Locales cell's loading state is a bare "…", announced as nothing
**WCAG:** 1.3.1 Info and Relationships (A), 4.1.3 Status Messages (AA) · **508:** 502.2 · **Verdict: Partially Supports**
**Location:** `packages/i18n/admin/src/lib/components/LocalesColumnCell/index.tsx:6-8,24-30`
```tsx
loading: { id: 'i18n.column.loading', defaultMessage: '…' }
```
While the batch is in flight every cell in the column prints a lone horizontal
ellipsis with no `aria-label`, no `role="status"`, and no `sr-only` text. A screen
reader reads the character or nothing at all; either way "still loading" is not
conveyed, and when the batch **fails** the cell silently becomes empty (EC-13), so
the same column expresses "loading", "no other locales" and "we could not ask" in
two indistinguishable renderings.
**Remediation:** use an `sr-only` "Loading locales…" beside the visual ellipsis,
and render a distinct, named failure state rather than an empty cell.

#### ♿ A11Y-i18n-admin-09 — 504.2.1: nothing preserves language information across the translation prefill, and an author cannot mark the language of a part
**WCAG:** 3.1.2 Language of Parts (AA) · **508:** 504.2, 504.2.1, 504.3 · **Verdict: Does Not Support**
**Location:** `packages/i18n/admin/src/lib/components/LocaleWidget/index.tsx:201-236` (`state.translateFrom`), consumed by `packages/content/admin/src/lib/presentation/components/ContentEntryView/index.tsx:137-150` (`applyTranslatePrefill`)
This is the authoring-tool provision, and it is where a real 508 audit bites.
Creating a French translation copies every **shared** field's value into the new
row verbatim — text that is, by definition, still in the source language and will
now be served under `locale: 'fr'`. There is nowhere in the data model to record
that a shared field's content is in a different language from the row's locale
(`♿ A11Y-i18n-server-02`), the editor never prompts about it (504.3), and the
plugin's own UI does not flag a shared field as "not translated, and not
translatable here" beyond content-admin's "Shared fields" grouping.
**Repro:** create a `fr` translation of an English record with a shared
`summary`; publish it.
→ Observed: the French row serves English prose with no language marker.
→ Expected: either the field is excluded from the prefill, or the author is
prompted, or the language of that part is recordable.
**SR experience:** the mixed-language passage is read with French phonemes.
**Remediation:** server-side, allow a per-field language marker
(`♿ A11Y-i18n-server-02`); admin-side, surface a "still in {source language}"
hint on a prefilled shared field and set `lang` on it once the marker exists.

## 5. E2E Coverage Map

Every citation below is from a spec file I read; none is inferred from a filename.

| Feature | Spec | Asserts | Verdict |
| --- | --- | --- | --- |
| F1 contributions | `apps/admin-e2e/src/content/i18n.spec.ts:34`; `apps/admin-e2e/src/insights/insights.spec.ts:48,84` | the switcher renders on a localized collection; the coverage card renders under slot id `insights.i18n.coverage` | ✅ E2E |
| F2 switcher + `?locale=` | `i18n.spec.ts:44`, `:70`, `:113` | the URL gains `locale=de` and the table re-scopes; the locale survives open-row → Back; the default keeps a clean URL through the editor | ✅ E2E |
| F3 search + keyboard list | — | — | ❌ NONE — nothing types in the search box, presses ↑/↓, or asserts the wrap/reset behaviour |
| F4 switch flourish | `i18n.spec.ts:187`, `:263` | the overlay appears and names the target locale, from both the toolbar and the widget | ⚠️ PARTIAL — never asserts it **lifts**, nor the min/max hold, the deferred apply, or last-pick-wins |
| F5 Locales column | `i18n.spec.ts:198` | the column is off by default, enabled from the picker, and shows per-group badges | ✅ E2E |
| F6 badge link + status | `i18n.spec.ts:213-226` | the link's accessible name is "Open the en version…"; a group with no `de` has no `de` badge | ⚠️ PARTIAL — the `(status)` half of the name and the tint are unasserted, so `🐞 BUG-i18n-admin-08` is invisible to CI |
| F7 panel switch | `i18n.spec.ts:228`, `:263` | current/existing/missing rows; pressing Deutsch lands on `lp-de-1` and the chip follows | ✅ E2E |
| F8 create a translation | `i18n.spec.ts:287`; `:429`, `:461` | the draft URL carries `locale=fr` + `localeGroupId=G1`, shared fields prefilled and localized ones blank; the save is a **POST** with `locale`, never a PATCH re-homing the original | ✅ E2E |
| F9 create-mode panel | `i18n.spec.ts:313`, `:342` | a fresh record re-targets to `de` with no group; a translation draft jumps to an existing sibling | ✅ E2E |
| F10 group id footer | `i18n.spec.ts:258-260` | label, ⓘ help, and the id `G1` are present | ✅ E2E |
| F11 unsaved-changes guard | — | — | ❌ NONE — no spec dirties the form before switching locale, so the one **data-loss** guard in this unit is unpinned |
| F12 title chip | `i18n.spec.ts:242`, `:282`, `:326` | `EN · English`, then `DE · Deutsch` after a switch, and the default on a fresh create | ✅ E2E |
| F13 filter fields | — | — | ❌ NONE — `records-filter.spec.ts` never mentions a locale (`grep -n "ocale"` → no hits) |
| F14 entry params | `i18n.spec.ts:363` | the relation picker on a **create** translation form requests `?locale=de`, not the default | ✅ E2E |
| F15 publish all | `i18n.spec.ts:513`, `:534`, `:560`, `:604` | menu grouping + separator count; rows named by locale; "Publish 1 valid"; the open record's own badge refreshes; absent on an unsaved record | ✅ E2E |
| F16 unpublish all | `i18n.spec.ts:589` | the confirm names the live locales only | ✅ E2E — the mutation itself and the failure toast are unasserted |
| F17 tab preservation | `i18n.spec.ts:91` | a switch from Relations lands on the sibling's Relations tab | ✅ E2E |
| F18 coverage figures | `insights.spec.ts:155` | all three hints present, "122 to translate" | ✅ E2E |
| F19 by-language bars | `insights.spec.ts:155` | every configured locale has a row including the untouched one; "15%"; "Across 140 localized records" | ✅ E2E |
| F20 by-type + toggle | `insights.spec.ts:185` | type labels replace locale labels, legend and subtitle move together, headline figures stay, and **one** request total | ✅ E2E |
| F21 chip + footer | `insights.spec.ts:155`; `:271` | the pending chip's count; the widget sends no `days` param | ✅ E2E |
| F22 permission | `insights.spec.ts:390` | the card is absent for a `media:read`-only user | ✅ E2E |
| F23 state ladder | `insights.spec.ts:242`; `insights/a11y.spec.ts:36` | a failing coverage read shows the **error**, not the empty state, and does not take down the band; the loading state is scanned | ⚠️ PARTIAL — the `records === 0` empty branch (and the unearned chip over it, `🐞 BUG-i18n-admin-07`) is untested |
| F24 `localePolicy` | — | — | ❌ NONE — no unit test anywhere in the package (`find packages/i18n/admin -name "*.spec.ts"` → nothing); the rules are only exercised transitively |
| F25 `useLocales` | `i18n.spec.ts` (mock seed) | exercised on every test | ⚠️ PARTIAL — never asserts the forever cache, the single request, or the failure path (EC-01) |
| F26 batching / refetch-on-`updatedAt` | `i18n.spec.ts:560` | the open record's status refreshes after a bulk publish | ⚠️ PARTIAL — nothing counts `locale-summary` requests per page, and nothing asserts the panel re-reads after a plain save |
| **a11y** | `insights/a11y.spec.ts:23,36,48` (whole-page axe, coverage card in **By language** only) | no axe violations on the Insights page | ⚠️ PARTIAL — **no i18n a11y suite and no keyboard suite exist**; `content/a11y.spec.ts` seeds a non-i18n workspace, so the switcher, column, panel, chip and overlay have never been scanned |

**Coverage tally:** `26 features · 17 ✅ · 5 ⚠️ · 4 ❌`

**Server-side counterpart** (for cross-reading, not counted here):
`apps/server-e2e/src/server/i18n/i18n-content.spec.ts` and
`apps/server-e2e/src/server/insights/localization-insights.spec.ts` — see
`docs/testing/i18n-server.md` §5.

## 6. 🐞 Potential Bugs

### 🐞 BUG-i18n-admin-01 — A failed locale read renders as "no translations exist", so the panel invites the user to create a sibling that is already there · Severity: Medium

*(Downgraded from High during verification: there is no data-loss or exploit path. The
dead-end the UI offers is **blocked by the server** — a duplicate `(localeGroupId, locale)`
is rejected by the unique index and answered `409`, asserted at
`apps/server-e2e/src/server/i18n/i18n-content.spec.ts:221-226` — so the worst outcome is a
confusing failed save, not a corrupted or duplicated translation group. The misreported
state is real and reachable, hence Medium rather than Low.)*

**Location:** `packages/i18n/admin/src/lib/components/LocaleWidget/index.tsx:161-186, 246-277`; `packages/i18n/admin/src/lib/api/useLocaleSummaries/index.ts:65-68`; `packages/i18n/admin/src/lib/components/LocalesColumnCell/index.tsx:24-30`
**Category:** ux-state / correctness

**What the code does:**
```tsx
const item = entryLocales.data?.items?.find(
    (candidate) => candidate.locale === slug
);
return item?.entry ? { id: item.entry.id, … } : undefined;
```
and in the row:
```tsx
const sibling = siblingFor(locale.slug);
const actionable = !isCurrent && (!!sibling || canCreate);
```
Neither `LocaleWidget` nor `LocalesColumnCell` nor either ⋯ menu hook ever reads
`isError`. `useLocaleSummaries` goes further and hard-codes the collapse:
`groups: query.data?.groups ?? {}`, with `isPending` false once the query settles
— so a rejected batch is indistinguishable from an empty one.

**Why it is wrong:** `.cursor/BUGBOT.md` names this exactly — "**Error
masquerading as empty.** Distinguish a failed query from a genuinely empty
result. Rendering the empty state on error hides outages." The `admin-plugin`
skill repeats it as a review-critical pitfall. Here the empty state is not merely
uninformative, it is **actively wrong and actionable**: "this record has no German
translation" is a *claim*, and the UI attaches a button to it. Sibling code in
this very repo gets it right — `WidgetCard` (which this plugin's own coverage card
uses) resolves the four-branch ladder centrally and comments that "a failed load
rendered as an empty state is the most misleading thing a dashboard can do"
(`insights/admin/.../WidgetCard/index.tsx:39-48`), and media's picker has a
dedicated error state pinned by e2e (`media-fields.spec.ts:286`).

**Repro:**
1. Open a localized record that has a German sibling.
2. In DevTools, block `**/api/i18n/content/*/locales` (or stop the API), then
   reload the editor.
→ Observed: the panel lists English (current), and **Deutsch and Français both
dimmed with "+ Add"**. Pressing "Create the Deutsch translation" opens
`/new?locale=de&localeGroupId=G1`; Save returns **409 duplicate locale**, surfaced
as a generic editor save error. The Locales column, with the same failure, shows
empty cells — i.e. "every record is single-locale". Both ⋯ items disappear
(`ids.length < 2` / `=== 0`), so "Publish all locales" silently stops existing.
→ Expected: a stated failure in the panel and the cell ("Couldn't load locales"),
with the create affordance withheld.

**Blast radius:** every localized workspace during any i18n-endpoint outage or
transient 500. Nothing is destroyed, but the plugin's single job — telling a
writer which languages exist — reports the opposite of the truth, and the recovery
path it offers dead-ends in a 409 with no explanation.

**Suggested fix:** thread `isError` out of `useEntryLocales` / `useLocaleSummaries`
(the latter already returns a shaped object, so add `isError` beside `isPending`),
render a named error row/cell, and make `actionable` require a **successful** read
rather than merely a falsy sibling.

---

### 🐞 BUG-i18n-admin-02 — A failed `GET /api/i18n/locales` silently deletes every localization affordance while the list stays locale-scoped · Severity: Medium

**Location:** `packages/i18n/admin/src/lib/api/useLocales/index.ts:29-39`; consumers at `.../LocaleSwitcher/index.tsx:98`, `.../LocaleWidget/index.tsx:139`, `.../LocaleTitleChip/index.tsx:29`, `.../hooks/useLocaleFilterFields/index.ts:38`
**Category:** ux-state

**What the code does:**
```typescript
const locales = query.data?.items ?? [];
return { locales, defaultLocale: locales.find((l) => l.isDefault), isPending: query.isPending };
```
`isError` is not returned, so every consumer's guard (`locales.length === 0`)
treats "the request failed" and "this deployment has no locales" as the same
thing, and each returns `null` / `[]`.

**Why it is wrong:** the failure is invisible **and** the app keeps acting on the
locale. `?locale=de` remains in the URL and is forwarded verbatim to the records
request (`useSlotListParams` → the list query key), so the table goes on showing
German rows with **no switcher, no chip, and no filter fields** to say so. The
`?locale=` param is this plugin's contract with content-admin; dropping the UI
without dropping the param leaves the two halves disagreeing. Same BUGBOT pattern
as BUG-01, one layer up, and made permanent by `staleTime: Forever` — a failed
first load is not retried for the rest of the session.

**Repro:**
1. Open `…/content/localized_post?locale=de`.
2. Block `**/api/i18n/locales` and reload.
→ Observed: German rows, no locale button, no locale chip in the editor, "Has
locale" absent from the filter picker, and nothing anywhere reporting a problem.
Editing a row saves into `de` with the UI giving no sign of which locale it is in.
→ Expected: a disabled switcher with an error tooltip, or at minimum a toast.

**Blast radius:** any i18n-endpoint outage. Users edit content in a language the
UI no longer names.

**Suggested fix:** return `isError` from `useLocales`, render a disabled
switcher stating the failure instead of `null`, and drop `staleTime: Forever` in
favour of `Forever` **only on success** (or add a retry) so the session can
recover.

---

### 🐞 BUG-i18n-admin-03 — The Locales column's batch `POST` fires on every records page even though the column is hidden by default · Severity: Medium · 🔒 (see cross-ref)

**Location:** `packages/i18n/admin/src/lib/utils/i18nPlugin/index.tsx:86-100`; render site `packages/content/admin/src/lib/presentation/components/CollectionRecordsView/LoadedRecordsView/index.tsx:369-375`
**Category:** perf / correctness

**What the code does:**
```typescript
useRowsData: (entries: EntryRecord[], schema: ContentTypeDetail) =>
    useLocaleSummaries(schema.name, entries.map((e) => e.localeGroupId), !!schema.i18n)
```
and the consumer:
```typescript
const extensionData: Record<string, unknown> = {};
for (const item of extensionColumnItems) {
    extensionData[item.id] = item.useRowsData?.(entries, schema, workspace.id);
}
```
The loop runs over **every registered** extension item, not the visible ones. The
only gate the i18n item applies is `!!schema.i18n`.

**Why it is wrong:** the column is `hidden by default` (this package's own
AGENTS.md says so, and `i18n.spec.ts:200-205` has to open the picker to enable
it), so for the overwhelming majority of page loads the response is fetched,
cached and **thrown away**. The AGENTS.md justification for `useRowsData` is "one
request per page, not per row" — the request that is actually never needed was not
considered. Two aggravating details: it is a **`POST`**, so it is a state-changing
verb that `docs/testing/i18n-server.md` `🐞 BUG-i18n-server-02` already flags as
exempted from `OriginGuard` and as echoing publish state back for arbitrary group
ids — issuing it unconditionally widens exactly that surface; and it fires for
every page-change and every filter change, not just first load.

**Repro:**
1. Open a localized collection with the Locales column **off** (the default).
2. Watch the network panel; page forward twice.
→ Observed: one `POST /api/i18n/content/localized_post/locale-summary` per page
render, each carrying the page's group ids, with the response never rendered.
→ Expected: no request until the column is shown.

**Blast radius:** every records page of every localized type, for every user,
including `viewer`s who never enable the column. Cost is one extra round trip per
page render plus the server-side per-group query.

**Suggested fix:** extend `RecordsColumnItem` so `useRowsData` receives whether
the column is currently visible (content-admin already computes `visible` at
`LoadedRecordsView:209-226`), and pass it into `useLocaleSummaries`'s `enabled`.
The fix has to land in the slot contract — this plugin cannot see visibility today.

---

### 🐞 BUG-i18n-admin-04 — An unconfigured `?locale=` makes the switcher report the default locale, and re-picking the default cannot clear it · Severity: Medium

**Location:** `packages/i18n/admin/src/lib/components/LocaleSwitcher/index.tsx:81-84, 100-106`; `packages/i18n/admin/src/lib/components/LocaleWidget/index.tsx:143-147`
**Category:** correctness / ux-state

**What the code does:**
```typescript
const activeSlug = resolveActiveLocale({ urlLocale: params[LOCALE_PARAM], defaultSlug: defaultLocale?.slug });
…
const active = locales.find((locale) => locale.slug === activeSlug) ?? defaultLocale;

const select = (slug: string) => {
    setOpen(false);
    // Re-selecting the active locale is a no-op — no re-scope, no flourish.
    if (slug === active?.slug) return;
```
`activeSlug` is whatever the URL says; `active` is the *resolved* locale object,
which silently falls back to the default when the slug is unknown. The no-op guard
then compares against that fallback.

**Why it is wrong:** the two values are allowed to disagree and only one of them
is shown. With `?locale=xx`:
- the trigger reads **"Locale: English"**, and the English row carries the check —
  while the list request carries `locale=xx`, which the server rejects with **400**
  (`apps/server-e2e/src/server/i18n/i18n-content.spec.ts:182-185`), so the table shows
  its error state beside a switcher asserting a locale that is not being requested;
- pressing **English** is swallowed by the identity guard, so the one action that
  would fix the URL does nothing, with no feedback;
- the chip prints `XX` with no name (`LocaleTitleChip:47-48`), so the editor and
  the toolbar disagree about the same page.

The state is reachable without a typo: `docs/testing/i18n-server.md`
`🐞 BUG-i18n-server-03` establishes that removing a locale from the config
**silently orphans every row in it**, and any bookmark or shared link written
before that change lands here. `LocaleWidget` has the mirror of the problem:
`currentLocale` matches no row, so the orphaned locale is simply absent from the
panel and every configured locale offers "Add".

**Repro:**
1. Open `…/content/localized_post?locale=xx`.
2. Read the toolbar → "Locale: English". Open it → English is checked.
3. Press **English**.
→ Observed: the popover closes and nothing else happens; the URL still says
`locale=xx`, the list request still 400s, and the table stays in its error state.
(Picking *Deutsch* does work, so the state is escapable, just not toward the default.)
→ Expected: either the switcher reports the unknown locale honestly, or the URL is
normalised to the default on load.

**Blast radius:** anyone holding a link written before a locale-config change, and
anyone hand-editing the URL. Low frequency, high confusion — the UI states a
falsehood about which language is being edited.

**Suggested fix:** when `activeSlug` resolves to no configured locale, clear
`?locale=` (or render an explicit "Unknown locale" state) rather than falling back
silently, and compare `select`'s no-op guard against `activeSlug`, not `active`.

---

### 🐞 BUG-i18n-admin-06 — The deferred locale swap is never cancelled on unmount, so navigating away within 220 ms yanks the user back · Severity: Medium

**Location:** `packages/i18n/admin/src/lib/utils/localeTransition/index.ts:45-46, 65-78`
**Category:** ux-state / correctness

**What the code does:**
```typescript
let applyTimer: ReturnType<typeof setTimeout> | undefined;
…
export function beginLocaleSwitch(name: string, apply: () => void) {
    activeName = name;
    if (maxTimer) clearTimeout(maxTimer);
    if (applyTimer) clearTimeout(applyTimer);
    applyTimer = setTimeout(() => { applyTimer = undefined; apply(); }, COVER_MS);
    maxTimer = setTimeout(clear, MAX_HOLD_MS);
    emit();
}
```
`applyTimer` is cleared in exactly one place: the next `beginLocaleSwitch`.
`clear()` (`:53-58`) clears `maxTimer` only. There is no unsubscribe hook, no
route-change cancellation, and no cleanup on the trigger's unmount — the store is
module-level precisely so it can outlive the trigger (`:10-13`), and that is what
makes this reachable.

**Why it is wrong:** `apply` is a closure over the *previous* view's
`updateParams` (`LocaleSwitcher:110-116`) or `navigate` (`LocaleWidget:213-235`).
Neither is component-scoped in effect — React Router's `navigate`/`setSearchParams`
act on the router, not on the caller — so a swap scheduled 220 ms ago still
executes after the user has gone somewhere else, and pulls them to the old view's
new locale. It is also the functional half of `♿ A11Y-i18n-admin-05`: a change of
context the user did not request, landing while the page is covered.

**Repro:**
1. On a localized records list, press **Locale ▸ Deutsch**.
2. Within ~200 ms, click a different item in the workspace sidebar.
→ Observed: you arrive at the new page, then ~220 ms later the pending
`updateParams` runs and the router moves again — landing on the content list at
`?locale=de`. The overlay is still up (it holds until nothing is fetching), so the
jump happens behind a cover.
→ Expected: leaving the view cancels the pending swap.

**Unverified —** I did not run this in a browser; the timer's lack of cleanup and
the closure's target are read directly from the source, but the exact behaviour of
`setSearchParams`/`navigate` invoked after the calling component unmounts (whether
it navigates or warns and no-ops) I could not confirm without executing it. The
window is real either way, and `beginLocaleSwitch` also leaves `activeName` set,
so the overlay is displayed over an unrelated page for up to 5 s.

**Blast radius:** anyone who clicks twice quickly; more likely on a slow machine
where 220 ms feels like nothing. No data is lost.

**Suggested fix:** export a `cancelLocaleSwitch()` that clears `applyTimer` and
`clear()`s the store, and call it from the trigger's unmount effect and on
`location.pathname` change in `LocaleSwitchOverlay`.

---

### 🐞 BUG-i18n-admin-05 — Coverage shares round to 0% and 100%, so a locale with outstanding work can read as complete · Severity: Low

**Location:** `packages/i18n/admin/src/lib/components/LocalizationCoverageWidget/index.tsx:163, 191, 288-291`
**Category:** correctness

**What the code does:**
```typescript
/** A count as a whole-percent share of its total, or nothing when there is none. */
function share(value: number, total: number): string | undefined {
    return total > 0 ? `${Math.round((value / total) * 100)}%` : undefined;
}
```
No floor, no ceiling, no "<1%" / ">99%" treatment.

**Why it is wrong:** the card's whole purpose is "which language is behind?", and
at the two ends it says the opposite. With 1000 localized records:
- a locale with 3 translations shows **"0%"** beside a bar that is visibly drawn
  (segments carry a 3px floor, `BarRows:98`) — the number denies what the bar
  shows;
- a locale missing 4 records shows **"100%"** while the card's own chip
  simultaneously reads "4 to translate" — the card contradicts itself on screen.
The server deliberately hands the widget **counts, not proportions**, precisely so
the admin can state them honestly (`docs/testing/i18n-server.md`,
`♿ A11Y-i18n-server-03`: "Recorded as a positive: the boundary is drawn in the
right place, and the remaining risk is purely in the widget"). This is that risk.

**Repro:**
1. Seed 1000 localized records; translate 4 of them into `de`, and all but 4 into
   `fr`.
2. Open Insights → Translation coverage.
→ Observed: `Deutsch … 4 0%` and `Français … 996 100%`, with "4 to translate" in
the chip. → Expected: `<1%` and `>99%`, or one decimal place.

**Blast radius:** cosmetic but decision-shaping — this card exists to direct
translation effort, and "100%" is exactly the reading that stops someone looking.

**Suggested fix:** clamp — return `<1%` for a non-zero value below 0.5%, `>99%`
for a value below the total that rounds to 100, and keep whole percents in
between.

---

### 🐞 BUG-i18n-admin-07 — An empty workspace's coverage card shows a green "Fully translated" chip over "Nothing to show for this period yet." · Severity: Low

**Location:** `packages/i18n/admin/src/lib/components/LocalizationCoverageWidget/index.tsx:133, 211-231`; `packages/insights/admin/src/lib/presentation/components/WidgetCard/index.tsx:61, 77-80, 99-102, 12-14`
**Category:** ux-state / correctness

**What the code does:**
```tsx
const requires = data?.requiresLocalization ?? 0;
…
action={ requires === 0
    ? <WidgetChip tone="ok" icon={Check}>{intl.formatMessage(messages.complete)}</WidgetChip>
    : <WidgetChip tone="warn" …/> }
isEmpty={records === 0}
```
and in the shell: `const hasData = !isPending && !isError;` … `{action && hasData ? action : null}`.
`hasData` does **not** exclude the empty branch, so the chip renders beside the
empty message.

**Why it is wrong:** two separate misstatements in one render.
1. "Fully translated" is an all-clear asserted about a workspace with **no
   localized records at all** — the same class of claim `WidgetCard`'s own JSDoc
   warns about ("a '156 over a year' chip beside a skeleton asserts a number the
   widget has not actually loaded", `:77-79`); the empty branch was missed.
2. The empty copy is "Nothing to show **for this period** yet." — but this widget
   takes no period, and `insights.spec.ts:271-277` asserts exactly that
   (`spy.days['i18n/coverage']` is `null`). The shared string presumes a range
   every other card has.

**Repro:** open Insights in a workspace with no localized content.
→ Observed: a green ✓ "Fully translated" chip above "Nothing to show for this
period yet." → Expected: no chip, and copy that does not invoke a time range.

**Blast radius:** every brand-new workspace — i.e. the first thing a new user sees
on this card. Purely presentational.

**Suggested fix:** suppress the chip when `records === 0` (pass it as `undefined`,
or have `WidgetCard` gate `action` on `!isEmpty` too), and give `WidgetCard` a
range-free empty message for widgets that take no range.

---

### 🐞 BUG-i18n-admin-08 — A locale badge's accessible name prints the raw status enum instead of the localized label · Severity: Low

**Location:** `packages/i18n/admin/src/lib/components/LocalesColumnCell/LocaleBadge/index.tsx:10-19, 37-44`
**Category:** correctness (i18n) / a11y — see `♿ A11Y-i18n-admin-06`

**What the code does:**
```tsx
const view = entryStatusView(item);   // 'draft' | 'modified' | 'published'
<Link aria-label={intl.formatMessage(
    item.status ? messages.open : messages.openNoStatus,
    { locale: item.locale, status: view })} …>
```

**Why it is wrong:** the surrounding design is right — the comment at `:34-36`
explains that the state must ride the accessible name because the badge shows only
the slug — but the value interpolated is the internal union member, not a message.
The repo's own rule is stated on the sibling component: `EntryStatusBadge`'s JSDoc
says "The label is **localized**; the table used to print the raw wire value
(`draft`/`published`, lowercase and untranslated), which stopped being an option
once a third state existed" (`packages/content/admin/src/lib/presentation/components/EntryStatusBadge/index.tsx:38-41`).
That regression has been reintroduced here, in the one place only a screen-reader
user reads. It is also an untranslated English fragment inside an otherwise
translated name (3.1.2).

**Repro:** enable the Locales column and inspect a badge whose sibling has
unpublished edits.
→ Observed: `aria-label="Open the de version (modified)"`. → Expected:
`"Open the de version (Modified)"`, translated.

**Blast radius:** screen-reader users, in every UI language. The e2e only matches
`/Open the en version/` (`i18n.spec.ts:216`), so CI cannot see it.

**Suggested fix:** export content-admin's status label map (or a
`useEntryStatusLabel()` helper) and format `view` through it before interpolating.

---

**Tally:** 8 🐞 — 0 Critical, **0 High**, **5 Medium**, 3 Low (0 carry 🔒; 1 opens
`Unverified —` on a sub-claim: `BUG-06`).
**♿ tally:** 9 — 0 Supports · 6 Partially Supports · 3 Does Not Support · 0 Not Applicable
(1 of the 9, `A11Y-07`, carries an `Unverified —` contrast measurement).
**Edge cases:** `44 EC entries · 0 deleted in verification`.

**Checked and cleared:** no NaN or divide-by-zero is reachable in the coverage
arithmetic (`share` guards `total > 0`; `BarRows` clamps its denominator) — the
boundary risk the server artifact handed to this unit is genuinely handled at 0
records, 0%, and 100%, and only the *rounding* is wrong (BUG-05); the plugin
invalidates nothing globally, so the BUGBOT over-invalidation pattern does not
apply; it owns no list and no pager, so the stale-page-after-mutation pattern does
not apply; the unsaved-changes guard **is** wired on the editor's locale switch
(`LocaleWidget:195-199`) and routes through the same app-wide confirm every other
navigation uses — the data-loss class this brief asked about is closed on the
surface where an editor exists, and the toolbar switcher has no dirty form behind
it; every URL param this plugin owns survives pagination, refetch and filter
changes because `updateParams` merges rather than replaces
(`useTableUrlState:79-95`); the default locale really does keep a clean URL in both
directions (`toLocaleListParam`); relation candidates are scoped **strictly** to
the active locale with no default fallback; `localeGroupId` is forwarded into the
create body so a translation cannot become an orphan; the ⋯ menu hooks run their
`useQuery` unconditionally and return `null` after it, so the rules of hooks hold;
every early return in every component sits **after** the last hook call; slot items
are typed explicitly, so no callback silently infers `any`; and no permission is
enforced client-side that the server does not also enforce.

## 7. Recommended E2E Tests

| Priority | Harness | Proposed spec | Asserts | Closes |
| --- | --- | --- | --- | --- |
| 1 | `apps/admin-e2e` POM + `page.route` mock | **`src/content/i18n-a11y.spec.ts`** (new) | axe over the localized records list (switcher closed **and** open), the list with the Locales column enabled, the entry editor with the locale panel, a create/translation form, and the coverage card in **By type** — each in both themes; plus an explicit assertion that the coverage bars expose a text alternative | ♿ A11Y-i18n-admin-04, ♿ A11Y-i18n-admin-07, ♿ A11Y-i18n-admin-08, the ⚠️ a11y row |
| 2 | `apps/admin-e2e` | **`src/content/i18n-keyboard.spec.ts`** (new) | open the switcher with Enter; assert focus lands in the search box; ↓↓ moves `aria-activedescendant` and wraps; Enter picks; Escape restores focus to the trigger; Tab through the panel reaches every actionable row; **and** that Tab is trapped/inert while the switch overlay is up | ♿ A11Y-i18n-admin-03, ♿ A11Y-i18n-admin-05, F3 ❌ |
| 3 | `apps/admin-e2e` | extend `src/content/i18n.spec.ts` | fail `GET /i18n/content/*/locales` and `POST …/locale-summary`: the panel and the column state a **failure**, and the "Create the … translation" affordance is withheld | 🐞 BUG-i18n-admin-01, F26 ⚠️ |
| 4 | `apps/admin-e2e` | extend `src/content/i18n.spec.ts` | dirty the entry form, press a locale row, assert the unsaved-changes confirm appears; Cancel keeps the edit **and plays no overlay**; Confirm switches | F11 ❌ |
| 5 | `apps/admin-e2e` | extend `src/content/i18n.spec.ts` | fail `GET /i18n/locales`: assert the switcher renders a disabled/error affordance rather than disappearing, with `?locale=de` still in the URL | 🐞 BUG-i18n-admin-02, F25 ⚠️ |
| 6 | `apps/admin-e2e` | extend `src/content/i18n.spec.ts` | count `locale-summary` requests with the column **off** (expect 0) and **on** (expect 1 per page); page forward and re-count | 🐞 BUG-i18n-admin-03, F26 ⚠️ |
| 7 | `apps/admin-e2e` | extend `src/content/i18n.spec.ts` | load with `?locale=xx`; assert the switcher does **not** claim the default, and that picking the default clears the param | 🐞 BUG-i18n-admin-04 |
| 8 | `apps/admin-e2e` | extend `src/insights/insights.spec.ts` | seed `records: 0`: assert the empty state renders with **no** "Fully translated" chip; seed 4/1000 and 996/1000: assert `<1%` / `>99%`, and that the chip and the bar do not contradict | 🐞 BUG-i18n-admin-05, 🐞 BUG-i18n-admin-07, F23 ⚠️ |
| 9 | `apps/admin-e2e` | extend `src/content/i18n.spec.ts` | assert the badge's full accessible name including the localized status word | 🐞 BUG-i18n-admin-08, F6 ⚠️ |
| 10 | `apps/admin-e2e` | extend `src/content/records-filter.spec.ts` | add a **Missing locale = de** rule, apply it, assert the `?filter=` payload and that it survives paging, a refetch, and a locale switch; assert the three fields are absent on a non-i18n type | F13 ❌ |
| 11 | package unit (`*.spec.ts` beside the source) | **`src/lib/domain/localePolicy/index.spec.ts`** (new) | `resolveActiveLocale` precedence including the empty-string case; `toLocaleListParam` returning `undefined` for the default and for an undefined default; `localeName` on an unknown slug | F24 ❌, EC-05, EC-08 |
| 12 | `apps/admin-e2e` | extend `src/content/i18n.spec.ts` | the overlay **lifts** once the destination settles; a rapid re-switch names only the last locale; navigating away mid-cover does not yank the user back | 🐞 BUG-i18n-admin-06, F4 ⚠️ |
| 13 | `apps/admin-e2e` | extend `src/content/i18n.spec.ts` | drive **Unpublish all locales** to completion: the bulk request's id set, the success toast, and the failure toast on a mocked 500 | F16 ✅→ deepen |
