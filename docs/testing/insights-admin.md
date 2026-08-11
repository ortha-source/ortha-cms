# @ortha-cms/insights-admin — Test Artifact

> **Unit:** `packages/insights/admin` · **Package:** `@ortha-cms/insights-admin` · **Kind:** admin plugin (a frame, no widgets)
> **Source of truth:** `packages/insights/admin/AGENTS.md`
> **Generated:** 2026-08-11

## 1. Scope & Preconditions

**Owns:** the workspace dashboard **frame** at `/workspaces/:id/insights` — the
route, the range picker, the section bands, the widget card shell with its
four-branch state ladder, a per-widget error boundary, the pure layout fold, and
a small set of hand-built chart primitives.

**Does NOT own — and this is the whole point — any widget.** It contributes zero
items to `INSIGHTS_WIDGET_SLOT` and imports no other feature package. Every card
on the page arrives from `content-admin` (three Overview stat tiles, Gone quiet,
Draft/published by type, Publishing velocity, Waiting to go live, Team
punchcard), `media-admin` (storage tile, storage by kind, Uploads, alt-text
coverage) or `i18n-admin` (Translation coverage). It also does not own any
endpoint — the aggregates live in `content-server`, `media-server` and
`i18n-server` — nor any charting library (deliberately: there is no dependency).

- **Entry points** — `packages/insights/admin/src/index.ts:1-89`.
    - Plugin factory `InsightsPlugin({ sections? })` (`packages/insights/admin/src/lib/utils/insightsPlugin/index.tsx:93-131`), which contributes to **three** slots it does not own — `WORKSPACE_NAV_SLOT` (a rail button, `order:30`), `WORKSPACE_ROUTE_SLOT` (`insights/*`, lazy) — and one it does: `INSIGHTS_SECTION_SLOT` (the four default bands).
    - **Slots defined:** `INSIGHTS_WIDGET_SLOT` (`insights.widget`) and `INSIGHTS_SECTION_SLOT` (`insights.section`) — `packages/insights/admin/src/lib/presentation/slots/insightsSlots/index.ts:127, 150`.
    - **Route:** `insights/*` under the workspace shell. No top-level route, no global nav entry.
    - **Public API for contributors:** `WidgetCard`, `WidgetChip`, `BarRows`, `AreaTrend`, `ColumnTrend`, `HeatGrid`, `RampLegend`, `StatWidget`, `Sparkline`, `useInsightsRange`, `INSIGHTS_SECTION_IDS`, `DEFAULT_INSIGHTS_SECTIONS`, `DEFAULT_INSIGHTS_ORDER`, `resolveInsightsLayout`, and the `chartTone` role helpers.
- **Runtime prerequisites** — a signed-in session; membership of the workspace in
  the URL; at least one plugin contributing a widget, or the page shows its empty
  state; `content:read` / `media:read` / the i18n permission for the respective
  bands. No env vars, no feature flags.
- **How to exercise it manually**

    ```bash
    docker compose up -d && npm run dev
    ```

    Sign in, open a workspace, click **Insights** in the workspace rail, or go
    straight to `http://localhost:4200/workspaces/<id>/insights`. To reach the
    interesting states without a backend, drive the mocked harness instead —
    `apps/admin-e2e/src/support/api/insights.ts` can fail or empty **one** route
    at a time (`mockInsightsApi(page, { failing: ['content/stale'] })`), which is
    exactly the degradation the design is about.

    The endpoints behind the shipped widgets: `GET /api/insights/content/*`,
    `GET /api/insights/media/*`, `GET /api/insights/i18n/coverage`.
- **Dependencies that must be healthy** — `@ortha-cms/workspaces-admin`
  (`WORKSPACE_NAV_SLOT`, `WORKSPACE_ROUTE_SLOT`, `useCurrentWorkspace`),
  `@ortha-cms/identity-admin` (`useAuth`, `AuthStatus`), `@ortha-cms/utils-admin`
  (`createSlot`), `@ortha-cms/design-system` (`Card`, `Skeleton`,
  `SegmentedControl`, `TopBar*`, `Container`, `Breadcrumb`), and the design
  tokens `--color-chart-*` in `apps/admin/src/styles.css`. **Registration order
  matters:** `InsightsPlugin()` must come before any package that overrides one
  of its bands (`insightsPlugin/index.tsx:87-91`).

---

## 2. Feature Inventory

| # | Feature | Where it lives | Coverage |
| --- | --- | --- | --- |
| F1 | `InsightsPlugin()` — rail button + lazy `insights/*` route + the four default sections | `packages/insights/admin/src/lib/utils/insightsPlugin/index.tsx:93-131` | ✅ E2E |
| F2 | `InsightsPlugin({ sections })` — replace the default band set wholesale | `packages/insights/admin/src/lib/utils/insightsPlugin/index.tsx:57-66, 94` | 🧪 UNIT |
| F3 | `INSIGHTS_WIDGET_SLOT` contract — `{id, section, order?, size?, permission?, titleId, defaultTitle, Component}` | `packages/insights/admin/src/lib/presentation/slots/insightsSlots/index.ts:34-70, 127` | ✅ E2E |
| F4 | `INSIGHTS_SECTION_SLOT` contract — `{id, order?, titleId, defaultTitle, descriptionId?, defaultDescription?, icon?}` | `packages/insights/admin/src/lib/presentation/slots/insightsSlots/index.ts:86-101, 150` | ✅ E2E |
| F5 | Section merge by `id`, last wins **field by field**, position preserved | `packages/insights/admin/src/lib/utils/resolveInsightsLayout/index.ts:49-72` | 🧪 UNIT |
| F6 | Ordering — sections and widgets by `order`, default 100, stable for ties | `packages/insights/admin/src/lib/utils/resolveInsightsLayout/index.ts:100-112` | 🧪 UNIT |
| F7 | Permission filter on widgets, applied before band assembly | `packages/insights/admin/src/lib/utils/resolveInsightsLayout/index.ts:99-103` | ✅ E2E + 🧪 UNIT |
| F8 | A band with no visible widgets renders nothing, heading included | `packages/insights/admin/src/lib/utils/resolveInsightsLayout/index.ts:116-121` | ✅ E2E + 🧪 UNIT |
| F9 | Catch-all "More" band for widgets naming an unregistered section, marked `data-section-fallback` | `packages/insights/admin/src/lib/utils/resolveInsightsLayout/index.ts:123-130`; `hooks/useInsightsLayout/index.ts:21-25`; `presentation/components/InsightsSectionBand/index.tsx:59` | 🧪 UNIT |
| F10 | `useInsightsLayout` — the slots + auth adapter, memoised on the permission set | `packages/insights/admin/src/lib/hooks/useInsightsLayout/index.ts:39-58` | ⚠️ PARTIAL |
| F11 | `InsightsPage` — top bar, `<h1>`, subtitle naming the workspace, bands, empty state | `packages/insights/admin/src/lib/presentation/pages/InsightsPage/index.tsx:47-99` | ✅ E2E |
| F12 | `InsightsSectionBand` — heading, optional description + icon, 12-col grid, per-widget `WidgetBoundary` | `packages/insights/admin/src/lib/presentation/components/InsightsSectionBand/index.tsx:39-93` | ✅ E2E |
| F13 | Widget sizing — `xs/sm/md/lg/full` → twelfths, only from `lg` up | `packages/insights/admin/src/lib/presentation/components/InsightsSectionBand/index.tsx:17-23` | ❌ NONE |
| F14 | `useInsightsRange` / `InsightsRangeProvider` — the shared window, `7d/30d/90d/12m` → days | `packages/insights/admin/src/lib/hooks/useInsightsRange/index.tsx:10-74` | ⚠️ PARTIAL |
| F15 | `InsightsRangePicker` — a radiogroup over the four windows | `packages/insights/admin/src/lib/presentation/components/InsightsRangePicker/index.tsx:38-63` | ✅ E2E |
| F16 | `WidgetCard` — the four-branch ladder (pending → error → empty → data), plus `action` suppression and `footer` gating | `packages/insights/admin/src/lib/presentation/components/WidgetCard/index.tsx:49-115` | ✅ E2E |
| F17 | `WidgetBoundary` — a class error boundary per widget, naming the widget in the console and on screen | `packages/insights/admin/src/lib/presentation/components/WidgetBoundary/index.tsx:26-65` | ⚠️ PARTIAL |
| F18 | `StatWidget` — headline figure, unit, delta, sparkline; em dash on error | `packages/insights/admin/src/lib/presentation/components/StatWidget/index.tsx:34-105` | ✅ E2E |
| F19 | `Sparkline` — self-scaled polyline, `aria-hidden`, `null` below two points | `packages/insights/admin/src/lib/presentation/components/Sparkline/index.tsx:17-61` | ❌ NONE |
| F20 | `BarRows` — horizontal bar list, zero segments dropped, 3px floor, readout column in ink | `packages/insights/admin/src/lib/presentation/components/BarRows/index.tsx:63-117` | ⚠️ PARTIAL |
| F21 | `AreaTrend` — area chart with a nice-max axis, hover crosshair, and a `<details>` table fallback | `packages/insights/admin/src/lib/presentation/components/AreaTrend/index.tsx:75-306` | ✅ E2E |
| F22 | `ColumnTrend` | `packages/insights/admin/src/lib/presentation/components/ColumnTrend/index.tsx` | ❌ NONE |
| F23 | `HeatGrid` — 2-D intensity grid, caller-normalised, `role="img"` | `packages/insights/admin/src/lib/presentation/components/HeatGrid/index.tsx:55-107` | ⚠️ PARTIAL |
| F24 | `RampLegend` | `packages/insights/admin/src/lib/presentation/components/RampLegend/index.tsx` | ❌ NONE |
| F25 | `WidgetChip` — status accent, always with an icon, separate from the series palette | `packages/insights/admin/src/lib/presentation/components/WidgetChip/index.tsx` | ⚠️ PARTIAL |
| F26 | `chartTone` — role→utility mapping, `toneForIntensity`, `toneInk` | `packages/insights/admin/src/lib/utils/chartTone/index.ts:34-87` | ❌ NONE |
| F27 | `retry: 1` on insights queries (a broken widget fails in ~1s, not ~7s) | documented in `packages/insights/admin/AGENTS.md:159-163`; enforced in the contributing packages' hooks | ❌ NONE |

---

## 3. Manual Test Plan

Work at `/workspaces/<id>/insights` with the full plugin set registered.
Each block ends with a **Keyboard-only path** and a **Screen-reader expectation**.

### F1 / F11 — the plugin and the page

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Open a workspace | The rail shows **Insights** with a `BarChart3` icon, third (`order:30`) |
| 2 | Click it | URL `/workspaces/<id>/insights`; a top bar with an amber icon tile, the breadcrumb "Insights", and the range picker at the right |
| 3 | Read the page body | `<h1>` "Insights" and a subtitle "What changed in \<workspace\>, and what's gone quiet." |
| 4 | Watch the first paint after a cold load | **Suspected gap:** the route is `lazy` with `Suspense fallback={null}` (`insightsPlugin/index.tsx:118`), so the content area is **blank** — not a skeleton — until the chunk arrives |
| 5 | Register `InsightsPlugin()` after a plugin that overrides the `team` band | The override loses — merge is last-wins and the built-ins would be registered later. AGENTS calls this out (`insightsPlugin/index.tsx:87-91`); nothing enforces it |

**Keyboard-only path:** Tab from the workspace rail to **Insights**, `Enter`.
Focus should land in the new page; verify it is not left on the unmounted rail
button. Then Tab reaches the range picker (in the top bar) before the page
content, because the bar is portaled above the scrollport.
**Screen-reader expectation:** one `<h1>`; each band is a `<section>` whose
heading is an `<h2>`; each widget's title is an `<h4>`
(`WidgetCard/index.tsx:68`) — **an `<h3>` is skipped**, see
`♿ A11Y-insights-admin-04`.

### F3 / F4 / F5 / F6 / F8 / F9 — the slot contracts

These are the unit's core value and are best driven through the pure fold. The
UI-level checks:

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Look at the bands | Overview (10) → Content (20) → Localisation & media (30) → Team (40) |
| 2 | Inspect a band | `<section data-section-id="content">` (`InsightsSectionBand/index.tsx:58`) |
| 3 | Uninstall `media-admin` (or gate its permission away) | The **Localisation & media** band vanishes entirely — heading included |
| 4 | Contribute `{ id:'team', defaultTitle:'People' }` from a later-registered plugin | The band is renamed and keeps its `order`, description and icon (`resolveInsightsLayout/index.ts:60-67` copies only defined keys) |
| 5 | Contribute a widget with `section:'nope'` | It renders in a trailing **More** band carrying `data-section-fallback="true"` — it is **not** dropped |
| 6 | Confirm that attribute on a correctly-wired page | Absent. Its presence is itself a bug worth asserting against (`AGENTS.md:66-70`) |
| 7 | Contribute two widgets with the same `id` | **Suspected defect:** both render and React warns about a duplicate key (`InsightsSectionBand/index.tsx:76`). The slot registry does not de-duplicate |
| 8 | Contribute a widget with no `order` | It lands at 100 — after the built-ins' 10/20/30/40 |
| 9 | Contribute a widget with no `size` | It occupies `md` (half a row) |
| 10 | Contribute a `Component` that returns `null` | The band still renders with an empty grid cell — visibility is decided by `permission` only, not by whether the widget draws anything |

**Keyboard-only path:** Tab moves through each band's widgets in DOM order —
which is the visual order at `lg` and above, and also at narrower widths since
the grid does not reflow out of source order.
**Screen-reader expectation:** each band announces "region"/"section" by its
`<h2>`; the fallback band announces "More".

### F7 — permission gating

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | As a user **with** `content:read` | The Content band and the three Overview content tiles are present |
| 2 | As a user **without** it | Every content widget is gone **and** the Content band's heading is gone. Asserted at `apps/admin-e2e/src/insights/insights.spec.ts:390` |
| 3 | As a user with no relevant permission at all | The page's empty state renders: "No insights are available yet. Widgets appear here as the plugins that own the data are installed." Asserted at `insights.spec.ts:417` |
| 4 | Check the mechanism | Permissions are read **once** from the auth state (`useInsightsLayout/index.ts:41-42`), not via `useHasPermission` per widget — because the page must know whether a band has any visible widgets *before* it renders the heading (`insightsSlots/index.ts:50-58`) |
| 5 | Confirm the widget also checks internally | The item's `permission` is a **layout** decision; the component is expected to gate too (`insightsSlots/index.ts:52-53`). This unit cannot verify that half |
| 6 | 🔒 Confirm the gate is not security | It hides cards; the endpoints are guarded server-side. A user who forges the request still gets a 403 |

**Keyboard-only path:** a gated widget is absent from the DOM, so it is absent
from the tab order.
**Screen-reader expectation:** no empty heading, no announced-but-empty region.

### F10 — the layout adapter

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Re-render the page (e.g. change the range) | The layout does not recompute — the memo is keyed on `permissions.join(',')`, not the array identity (`useInsightsLayout/index.ts:44-56`) |
| 2 | Sign in as a user with a permission containing a comma | Theoretical only; permission keys are `namespace:verb`. The `join(',')`/`split(',')` round-trip would corrupt such a key |
| 3 | Hot-reload a plugin that adds a widget | **Known limitation:** slots are read *inside* the memo whose only dependency is the permission key, so an HMR re-registration does not re-resolve until the permission set changes. Dev-only |

### F14 / F15 — the range picker

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Land on the page | **30d** is selected — the default (`useInsightsRange/index.tsx:24`) |
| 2 | Click **90d** | Every range-dependent widget refetches; the two that take no range do not. Asserted at `insights.spec.ts:265` and `:370` |
| 3 | Inspect the roles | `role="radiogroup"` named "Time range"; four `role="radio"` with `aria-checked`. Asserted at `apps/admin-e2e/src/insights/a11y.spec.ts:87-103` |
| 4 | Click the already-selected option | Nothing changes — the empty string Radix emits is guarded (`InsightsRangePicker/index.tsx:45-49`) |
| 5 | Reload the page | **Suspected gap:** it resets to 30d. The range is React state only — not in the URL, not persisted. A "90-day dashboard" cannot be shared or bookmarked, and browser Back does not undo a range change. See `🐞 BUG-insights-admin-05` |
| 6 | Read the visible label vs the accessible name | Visible "90d", accessible name "90 days" (`InsightsRangePicker/index.tsx:56-58`). See `♿ A11Y-insights-admin-05` |
| 7 | Check what a widget actually sends | `days` — `7 / 30 / 90 / 365` (`useInsightsRange/index.tsx:16-21`). "12 months" is a flat **365**, so in a leap year the window is a day short. All boundary maths (inclusive vs exclusive end, timezone, DST) happens **server-side**; this unit ships only an integer |
| 8 | Render a widget outside `InsightsRangeProvider` (a test, a storybook) | It gets `{range:'30d', days:30, setRange: noop}` rather than throwing (`useInsightsRange/index.tsx:66-73`) |

**Keyboard-only path:** Tab enters the group at the checked option;
`ArrowRight`/`ArrowLeft` move focus **without** selecting; `Enter`/`Space`
commits. This is asserted, correctly and explicitly, at `a11y.spec.ts:87-103` —
the best keyboard assertion in the repo.
**Screen-reader expectation:** "Time range, 30 days, radio button, 2 of 4,
selected". Changing it is a change of context (nine widgets refetch) that is
**not announced** — see `♿ A11Y-insights-admin-03`.

### F16 — the widget state ladder

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Load with `mockInsightsApi(page, { delayMs: 2000 })` | Each card shows `skeletonRows` skeleton bars under its title, `data-testid="widget-skeleton"`. Asserted at `insights.spec.ts:357` |
| 2 | Load with `failing: ['content/stale']` | *That* card shows a bordered red `role="alert"` reading "This didn't load. Refresh to try again." — the rest of the page is normal. Asserted at `insights.spec.ts:307` |
| 3 | Load with an empty workspace | Cards show "Nothing to show for this period yet." — **not** an error. Asserted at `insights.spec.ts:341` |
| 4 | Compare 2 and 3 side by side | They are visually and textually distinct. This is the ladder's entire reason for existing (`WidgetCard/index.tsx:41-48`) |
| 5 | Check `isError` and `isEmpty` together | Error wins (`WidgetCard/index.tsx:92-99`) |
| 6 | Check the `action` chip while pending | Suppressed until there is data (`WidgetCard/index.tsx:80`) — no "156 over a year" chip beside a skeleton |
| 7 | Check the `footer` on an empty card | Suppressed (`WidgetCard/index.tsx:107`) |
| 8 | Inspect the skeleton block for a busy announcement | **Suspected defect:** no `role="status"`, no `aria-busy`, no `sr-only` label — see `🐞 BUG-insights-admin-02` |

**Keyboard-only path:** nothing in the ladder is interactive; the "Refresh to try
again" copy points at a browser refresh rather than a retry button, so there is
no per-widget recovery affordance at all.
**Screen-reader expectation:** the error paragraph is inserted after the skeleton
is removed, so `role="alert"` fires. The transition into loading, and the
transition into the empty state, are both silent.

### F17 — the widget boundary

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Make one contributed widget throw during render | Its card is replaced by a titled failure card; every neighbour still renders. `getDerivedStateFromError` (`WidgetBoundary/index.tsx:32-34`) |
| 2 | Check the console | `[insights] widget "Gone quiet" failed to render` plus the error and the component stack (`WidgetBoundary/index.tsx:36-44`) |
| 3 | Read the failure card's copy | **Suspected defect:** "This widget stopped working. The rest of the page is unaffected." is a **hard-coded English literal** (`WidgetBoundary/index.tsx:58-61`). See `🐞 BUG-insights-admin-01` |
| 4 | Trigger an **async** failure (a rejected promise in an effect) | The boundary does **not** catch it — React error boundaries only catch render/lifecycle throws. This is why each widget's own query error must route through `WidgetCard`'s `isError` |
| 5 | Fix the widget and re-render | **Suspected gap:** `failed` never resets (`WidgetBoundary/index.tsx:30`), so once a widget has thrown, the card stays broken until the page is remounted — even if the cause was transient |

### F18 / F19 — `StatWidget` and `Sparkline`

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Read a loaded tile | A large figure, an optional unit at `0.6em`, the label under it, a delta and a sparkline |
| 2 | Make its request fail | An **em dash** replaces the figure, "so an unreachable count is not read as a real one" (`StatWidget/index.tsx:54-56`). Asserted at `insights.spec.ts:327` |
| 3 | Inspect that em dash | **Suspected defect:** it is `aria-hidden="true"` (`StatWidget/index.tsx:59`) with no `sr-only` replacement, so a screen-reader user hears only the label — indistinguishable from a card with no value. See `🐞 BUG-insights-admin-03` |
| 4 | Pass `history` with one point | The sparkline is omitted (`StatWidget/index.tsx:92`, `Sparkline/index.tsx:18`) |
| 5 | Pass a perfectly flat history `[5,5,5]` | A flat line rather than a divide-by-zero — `span = max - min || 1` (`Sparkline/index.tsx:24`) |
| 6 | Pass a history containing negative values | Handled — the series is scaled to its own min/max, not to zero |
| 7 | Pass a history containing `NaN` | `Math.max` returns `NaN`, every point becomes `NaN,NaN`, and the `<polyline>` renders nothing. Silent |
| 8 | Read `deltaTone` | `'up'` paints `text-success`, `'flat'` is muted. The delta's *meaning* is colour-plus-text; the text is the caller's, so `1.4.1` depends on the caller |

### F20 / F21 / F22 / F23 / F24 — the chart primitives

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `BarRows` with `max = 0` | Every bar renders at 0% rather than NaN% (which CSS would treat as full width) — `denominator = max > 0 ? max : 1` (`BarRows/index.tsx:67`) |
| 2 | `BarRows` with a zero-valued segment | The segment is **dropped**, not drawn at the 3px floor (`BarRows/index.tsx:82`). Without this a locale with nothing missing rendered a tick of the "missing" hue — the chart stating the opposite of its data |
| 3 | `BarRows` with a value above `max` | Clamped to 100% (`BarRows/index.tsx:88-95`) |
| 4 | `BarRows` with a negative value | Filtered out by the same `> 0` test |
| 5 | `BarRows` with two segments in one track | They are distinguished **only** by colour; the only text is the `title` attribute (`BarRows/index.tsx:86`). See `♿ A11Y-insights-admin-02` |
| 6 | `AreaTrend` with a single point | `span` falls back to 1, so the point sits at the left edge with a full-width area |
| 7 | `AreaTrend` with an all-zero series | `niceMax(0)` returns `GRID_STEPS` = 4, so the axis reads 0–4 and the line sits on the baseline (`AreaTrend/index.tsx:60-66`) |
| 8 | `AreaTrend` with negative values | **Suspected defect:** `niceMax` ignores them (`Math.max(..., 0)`), so `y = BASELINE - (negative/max)*plotHeight` puts points **below** the baseline, and the SVG is `overflow-visible` so they escape the card. See `🐞 BUG-insights-admin-04` |
| 9 | `AreaTrend` hover | A crosshair, a dot and a "label · value" readout follow the pointer (`AreaTrend/index.tsx:218-251`) |
| 10 | `AreaTrend` with the pointer away | The **endpoint** stays marked with its value — the latest number is the one a dashboard reader wants (`AreaTrend/index.tsx:199-217`) |
| 11 | `AreaTrend` **Table view** | A `<details>` disclosure over a real `<table>` with Period/value columns (`AreaTrend/index.tsx:273-303`). Asserted at `insights.spec.ts:428` |
| 12 | `HeatGrid` | A CSS grid of coloured cells with row labels and column headings, `role="img"` with a summary `aria-label` (`HeatGrid/index.tsx:64-70`) |
| 13 | `HeatGrid` with `intensity = 0` | Pinned to `q0`, the step nearest the card surface, so "none" recedes (`chartTone/index.ts:67-74`) |
| 14 | `HeatGrid` with `intensity > 1` or `NaN` | `> 1` → `q5`; `NaN` → `q0`. Both handled |
| 15 | `HeatGrid` — look for a table fallback | **Suspected defect:** there is none, and `role="img"` hides the visible row and column labels too. See `🐞 BUG-insights-admin-06` |
| 16 | Switch to dark mode and read a heat grid | The ramp's direction **flips** — low sits near the surface, high reads bright — so any caption must say "colour intensifies with age", never "darker means older" (`AGENTS.md:128-133`) |

**Keyboard-only path:** none of the charts are focusable. `AreaTrend`'s
`<summary>` is, and is the only route to its per-point values. `BarRows` and
`HeatGrid` offer no keyboard route to their `title` tooltips.
**Screen-reader expectation:** `AreaTrend` and `HeatGrid` announce as images with
a summary label. `BarRows` is not an image at all — its labels and readouts are
real text, which is better.

### F25 / F26 — chips and tones

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Read a `WidgetChip` | A status accent **always** paired with an icon, so it cannot be mistaken for a series colour (`AGENTS.md:141-143`) |
| 2 | Ask a widget for a third categorical colour | There isn't one — `series-1`/`series-2` are the only pair that clears colourblind separation against both the light (`#ffffff`) and dark (`#19191f`) card. Blue+violet fails at ΔE 1.9 under protanopia in dark mode (`AGENTS.md:120-125`) |
| 3 | Use a ramp step to distinguish two categories | Permitted by the code, forbidden by the contract — readers infer an ordering that isn't there. Nothing enforces it |
| 4 | Print a value inside a bar fill | Forbidden by the contract; `BarRows` structurally prevents it by putting the readout in its own column |

---

## 4. Edge Cases & Negative Paths

**Empty / zero**

- **EC-01 — No widgets registered at all.** `✅ E2E` The page's empty paragraph
  renders (`InsightsPage/index.tsx:84-88`). Asserted at `insights.spec.ts:417`.
- **EC-02 — No sections registered (`sections: []`) but widgets contributed.**
  `🧪 UNIT` Every widget lands in the catch-all **More** band
  (`resolveInsightsLayout/index.spec.ts:234-249`).
- **EC-03 — A band whose every widget is permission-gated out.** `🧪 UNIT + ✅ E2E`
  Dropped entirely (`resolveInsightsLayout/index.spec.ts:211`;
  `insights.spec.ts:390`).
- **EC-04 — A widget with an empty dataset.** `✅ E2E` `isEmpty` branch
  (`insights.spec.ts:341`).
- **EC-05 — `BarRows` with `rows=[]`.** `❌ NONE` Renders an empty flex column. The
  widget is expected to set `isEmpty` instead; nothing enforces it.
- **EC-06 — `AreaTrend` with `points=[]`.** `❌ NONE` Returns `null` after running
  the geometry memo (`AreaTrend/index.tsx:107`) — note `Math.max(...[], 0)` is
  evaluated first and is safe.
- **EC-07 — `HeatGrid` with `columns=[]`.** `❌ NONE`
  `repeat(0, minmax(0,1fr))` is invalid CSS; the grid collapses. Silent.
- **EC-08 — `Sparkline` with fewer than two values.** `✅` Returns `null`.

**Boundary**

- **EC-09 — Range "12 months" in a leap year.** `❌ NONE` A flat `365`
  (`useInsightsRange/index.tsx:20`) is a day short. Whether that matters depends
  entirely on the server's interpretation, which this unit cannot see.
- **EC-10 — "Last 7 days" inclusive/exclusive ends and DST.** `❌ NONE`
  **Not this unit's maths.** The picker emits an integer; every boundary decision
  — whether the window is a rolling 168 hours or 7 calendar days, whether today
  counts, which timezone the day boundary uses — lives in `content-server`,
  `media-server` and `i18n-server`. That is worth stating plainly because it is
  the first place a reader looks for an off-by-one, and it is not here. The
  corresponding tests belong in `apps/server-e2e/src/server/insights/*`.
- **EC-11 — Widget `order` collisions.** `🧪 UNIT` Stable — registration order
  decides (`resolveInsightsLayout/index.spec.ts:83`).
- **EC-12 — Section `order` absent.** `🧪 UNIT` Defaults to 100, after the
  built-ins (`resolveInsightsLayout/index.spec.ts:94`).
- **EC-13 — The catch-all band's order.** `✅` `Number.MAX_SAFE_INTEGER` and it is
  pushed after the sort, so it is always last
  (`resolveInsightsLayout/index.ts:123-130`).
- **EC-14 — `toneForIntensity` at exactly 0.2 / 0.45 / 0.7 / 0.9.** `❌ NONE` The
  comparisons are strict `<`, so 0.2 → `q2`, 0.45 → `q3`, etc. Consistent, but
  the "steps split the range evenly" comment (`chartTone/index.ts:64-65`) is
  loose — the first band is 0–0.2 and the last is 0.9–1.0.
- **EC-15 — A widget `size` not in the map.** `❌ NONE`
  `SIZE_SPAN[widget.size ?? 'md']` yields `undefined` for a bad value and `cn`
  drops it, so the widget gets **no** column span and the grid places it in one
  column of twelve — a sliver.

**Size & encoding**

- **EC-16 — A very long widget title.** `❌ NONE` `WidgetCard`'s header is
  `min-w-0` but the `<h4>` does not truncate, so it wraps and pushes the body
  down.
- **EC-17 — A very long section description.** `❌ NONE` Wraps.
- **EC-18 — 500 rows in a `BarRows`.** `❌ NONE` No cap and no virtualisation; the
  card grows unboundedly.
- **EC-19 — 200 points in an `AreaTrend`.** `❌ NONE` The x-axis prints only the
  first and last labels (`AreaTrend/index.tsx:253-267`), so it degrades
  gracefully; the polyline gets dense.
- **EC-20 — RTL.** `❌ NONE` `BarRows` grows left-to-right and `AreaTrend`'s axis
  is left-anchored; nothing flips for `dir="rtl"`.

**Permission matrix**

- **EC-21 — `admin`.** `✅ E2E` All bands.
- **EC-22 — A role without `content:read`.** `✅ E2E` (`insights.spec.ts:390`).
- **EC-23 — A role with no relevant permission.** `✅ E2E` (`insights.spec.ts:417`).
- **EC-24 — Unauthenticated.** `❌ NONE` `useInsightsLayout` falls back to `[]`
  permissions (`useInsightsLayout/index.ts:41-42`), so every gated widget
  disappears — but the route is behind the shell's gate anyway, so this is
  unreachable.
- **EC-25 — 🔒 A widget with no `permission` at all.** `❌ NONE` It renders for
  every workspace member. Its own request is still guarded server-side, so the
  worst case is a card that shows an error rather than a leak — but a contributor
  who forgets `permission` gets a card that *looks* like it should have data.

**Tenant isolation**

- **EC-26 — Switching workspace with the page open.** `❌ NONE` `useCurrentWorkspace`
  drives only the subtitle here; each widget builds its own request from its own
  hooks. If any widget's query key omits the workspace id, its data would carry
  across workspaces. **Not verifiable from this unit** — it is a per-widget
  concern in `content-admin`/`media-admin`/`i18n-admin`, and it is exactly the
  kind of thing a dashboard makes easy to miss.
- **EC-27 — `useCurrentWorkspace()` returning undefined.** `❌ NONE`
  `workspace.name` (`InsightsPage/index.tsx:79`) would throw and, with no
  boundary above it, blank the page.

**Concurrency**

- **EC-28 — Changing the range twice quickly.** `❌ NONE` Nine queries are
  cancelled and refired; TanStack handles it. With `retry: 1` a mid-flight
  failure surfaces in ~1s.
- **EC-29 — Two widgets hitting the same endpoint.** `❌ NONE` Deduped by
  TanStack only if their query keys match — a per-widget decision.

**State after mutation**

- **EC-30 — Range change → all range-dependent widgets refetch.** `✅ E2E`
  (`insights.spec.ts:370`). The two range-independent widgets do **not**
  (`insights.spec.ts:265`) — a genuinely sharp assertion.
- **EC-31 — Navigating away and back.** `❌ NONE` The range resets to 30d
  (`🐞 BUG-insights-admin-05`).

**Failure & partiality**

- **EC-32 — One endpoint 500s.** `✅ E2E` (`insights.spec.ts:307`, `:242`) —
  the single most important behaviour in the unit, and it is properly covered,
  including "a failing coverage read does not empty the localisation band".
- **EC-33 — Every endpoint 500s.** `❌ NONE` Every card shows its error; the page
  itself has no aggregate "nothing loaded" message.
- **EC-34 — A widget throws during render.** `⚠️ PARTIAL` The boundary catches it;
  the fallback copy is untranslated (`🐞 BUG-insights-admin-01`) and never resets
  (F17 step 5).
- **EC-35 — A widget throws during an effect.** `❌ NONE` Not caught by the
  boundary; it propagates and blanks the page.
- **EC-36 — The lazy chunk fails to load.** `❌ NONE` `Suspense fallback={null}`
  with no error boundary — a network failure on the chunk leaves a blank page.

**Idempotency & replay**

- **EC-37 — Re-selecting the current range.** `✅` Guarded; no refetch.

**UI-specific**

- **EC-38 — Loading / error / empty are three distinct states.** `✅` Enforced
  centrally in `WidgetCard` so no contributed widget can collapse them
  (`WidgetCard/index.tsx:39-48`). This is the unit's best design decision and it
  is verified end-to-end in all three states.
- **EC-39 — Every branch has an i18n message.** `❌` **No** — the
  `WidgetBoundary` fallback is untranslated (`🐞 BUG-insights-admin-01`). Every
  other branch in the package does have one.

---

### 4A. Accessibility & Section 508 Conformance

**Standards tested against:** WCAG 2.1 AA, with the Revised Section 508 provision
cited alongside. 508 E205.4 incorporates WCAG 2.0 A+AA for content; 502.2/502.3
cover AT interoperability; 503.2 covers platform preferences; 504.2 applies
(authoring-tool UI).

**Why axe is not enough here.** `apps/admin-e2e/src/insights/a11y.spec.ts` is the
most conscientious a11y suite in the repo: it scans the loaded state, the loading
state **and** a partially-failed state, and it adds two non-axe assertions
(keyboard operability of the range picker, and that every chart carries a text
alternative). It still cannot answer the questions that matter for a dashboard.
`insights.spec.ts:428` and `a11y.spec.ts:106-131` assert that each chart has a
`role="img"` with a **name** — but a name is a summary, not the data. axe cannot
tell you whether "Editing activity by weekday" is an adequate alternative for a
7×24 grid of numbers (it is not), whether two bar segments are distinguishable
without colour (they are not), whether a hover-only readout has a keyboard route
(one chart does, two do not), or whether the series colours clear 3:1 against
each other in the dark theme (never scanned — there is no dark Playwright
project).

#### ♿ A11Y-insights-admin-01 — `HeatGrid` exposes a summary label and hides its actual data, including its own visible row and column labels

**WCAG:** `1.1.1 Non-text Content (A)`, `1.3.1 Info and Relationships (A)` · **508:** `E205.4 / 502.3.1 (Object Information), 502.3.3 (Row, Column, and Headers)` · **Verdict: Does Not Support**

**Location:** `packages/insights/admin/src/lib/presentation/components/HeatGrid/index.tsx:64-105`

```tsx
<div className="grid gap-[3px]" style={{ gridTemplateColumns: template }}
     role="img" aria-label={ariaLabel}>
    <span />
    {columns.map((column) => <span key={column} …>{column}</span>)}
    {rows.map((row) => (<Fragment key={row.id}>
        <span …>{row.label}</span>
        {row.cells.map((cell) => <span key={cell.id} title={cell.title} …>{cell.text}</span>)}
    </Fragment>))}
</div>
```

`role="img"` on a container makes **everything inside it** presentational to
assistive technology. The column headings, the row labels, and any `cell.text`
are all erased; the per-cell `title` attributes were never exposed in the first
place. A screen-reader user of the Team punchcard receives exactly one string —
something like "Editing activity by weekday" — for a grid of 7×24 = 168 values.

The correct pattern exists **in this same package**: `AreaTrend` pairs its
`role="img"` SVG with a `<details>` disclosure containing a real `<table>` of
period/value pairs, with a comment explaining why ("Hover is not available to
keyboard or screen-reader users, and the crosshair is where the per-point values
live — so the same numbers have to exist as text", `AreaTrend/index.tsx:270-272`).
`HeatGrid` has no equivalent.

**Keyboard-only user:** cannot reach any cell's `title`; the data is
mouse-hover-only.
**Screen-reader user:** receives a one-line summary in place of the entire
dataset.
**Remediation:** give `HeatGrid` the same `<details>`+`<table>` fallback
`AreaTrend` has (rows as `<th scope="row">`, columns as `<th scope="col">`), and
either drop `role="img"` from the container or move it to an inner presentation
wrapper so the visible labels stay in the accessibility tree.

#### ♿ A11Y-insights-admin-02 — Bar segments and heat cells are distinguished by colour alone

**WCAG:** `1.4.1 Use of Color (A)`, `1.4.11 Non-text Contrast (AA)` · **508:** `E205.4 / 503.2` · **Verdict: Partially Supports**

**Location:** `packages/insights/admin/src/lib/presentation/components/BarRows/index.tsx:80-103`; `packages/insights/admin/src/lib/presentation/components/HeatGrid/index.tsx:86-101`; palette contract at `packages/insights/admin/AGENTS.md:118-143`

A split bar (published vs draft, for example) renders two adjacent `<span>`s
whose only difference is `bg-chart-1` vs `bg-chart-2`. There is no pattern, no
border, no direct label, and no legend inside the primitive — the only textual
route to "which segment is which" is the `title` attribute on each span, which is
neither keyboard-reachable nor announced. `HeatGrid` is worse: intensity is the
entire message and it is pure colour, with `cell.text` optional and, per
`♿ A11Y-insights-admin-01`, hidden anyway.

The package has thought carefully about this — the two-categorical-slot rule
exists precisely because a third colour would not clear colourblind separation
(`AGENTS.md:120-125`), and the values are deliberately kept out of the fills so
they never have to be legible against a palette step (`BarRows/index.tsx:50-53`).
Those decisions make the chart *readable*; they do not make the encoding
*non-colour*. And the specific claim — that `series-1`/`series-2` clear
separation against both cards — has never been verified by any automated check,
because no scan runs in dark mode.

**Keyboard-only user:** no route to the segment labels at all.
**Screen-reader user:** hears the row label and the readout (good) but not the
split (bad).
**Remediation:** add a direct label or a small legend row to `BarRows` when a row
has more than one segment; add `RampLegend` output to every `HeatGrid` caption;
and add a dark-theme axe project so the `1.4.11` claim is checked rather than
asserted.

#### ♿ A11Y-insights-admin-03 — Loading, empty and range changes are all silent

**WCAG:** `4.1.3 Status Messages (AA)`, `3.2.2 On Input (A)` · **508:** `E205.4 / 502.3.14 (Event Notification)` · **Verdict: Does Not Support**

**Location:** `packages/insights/admin/src/lib/presentation/components/WidgetCard/index.tsx:83-105`; `packages/insights/admin/src/lib/presentation/components/InsightsRangePicker/index.tsx:43-51`

Three silent transitions:

1. **Into loading.** The skeleton block is a bare `<div>` of `Skeleton`s
   (`WidgetCard/index.tsx:84-91`) — no `role="status"`, no `aria-busy`, no
   `sr-only` label. The design system's `Skeleton` JSDoc explicitly instructs
   consumers to wrap placeholders "in a `role="status"` region with an `sr-only`
   label so the busy state is announced once"
   (`packages/design-system/src/lib/components/ui/skeleton.tsx:12-15`).
   `WidgetCard` is the one place in the repo that could satisfy that contract for
   nine widgets at once, and it does not.
2. **Into empty.** `<p>Nothing to show for this period yet.</p>` with no role. The
   *error* branch correctly uses `role="alert"` (`WidgetCard/index.tsx:94`) — so
   the ladder announces failure and stays silent about success-with-no-data,
   which is the pair the whole design is about telling apart.
3. **Range change.** Selecting "90d" refetches nine widgets; every card returns
   to a skeleton and then to data. Nothing announces the change or its
   completion.

**Keyboard-only user:** sees all of it; unaffected.
**Screen-reader user:** presses `Enter` on "90 days" and hears nothing further.
Reading the page again some seconds later is the only way to know it finished.
**Remediation:** wrap the skeleton branch in `role="status"` with an `sr-only`
"Loading \<title\>…"; give the empty branch `role="status"`; and have
`InsightsPage` own one polite live region reporting "Showing the last 90 days"
once the last query settles. Cross-reference `🐞 BUG-insights-admin-02`.

#### ♿ A11Y-insights-admin-04 — Heading levels skip from `<h2>` to `<h4>`

**WCAG:** `1.3.1 Info and Relationships (A)`, `2.4.6 Headings and Labels (AA)` · **508:** `E205.4 / 502.3.1` · **Verdict: Partially Supports**

**Location:** `packages/insights/admin/src/lib/presentation/pages/InsightsPage/index.tsx:74` (`<h1>`); `packages/insights/admin/src/lib/presentation/components/InsightsSectionBand/index.tsx:62` (`<h2>`); `packages/insights/admin/src/lib/presentation/components/WidgetCard/index.tsx:68` (`<h4>`, JSDoc'd as "Rendered as an `h4` — the page owns the `h1`"); `packages/insights/admin/src/lib/presentation/components/WidgetBoundary/index.tsx:52` (also `<h4>`)

The document outline is `h1 → h2 → h4`. There is no `h3`. axe's `heading-order`
rule is tagged **best-practice**, and the harness includes only
`wcag2a/wcag2aa/wcag21a/wcag21aa` (`apps/admin-e2e/src/support/fixtures.ts:110-115`),
so this passes every existing scan.

**Keyboard-only user:** unaffected. **Screen-reader user:** navigating by heading
level, the jump implies a missing intermediate grouping that does not exist.
**Remediation:** make the widget title an `<h3>`, or make `WidgetCard` accept a
heading level so a contributor nesting cards can keep the outline correct.

#### ♿ A11Y-insights-admin-05 — The range picker's accessible name does not contain its visible label

**WCAG:** `2.5.3 Label in Name (A)` · **508:** `E205.4 / 502.3.1` · **Verdict: Partially Supports**

**Location:** `packages/insights/admin/src/lib/presentation/components/InsightsRangePicker/index.tsx:25-30, 52-60`

The visible text is `7d` / `30d` / `90d` / `12m`; the `aria-label` is
`7 days` / `30 days` / `90 days` / `12 months`. `2.5.3` requires the accessible
name to **contain** the visible label string. "90 days" does not contain "90d".

The intent is sound and documented ("the control is narrow, the long form is the
accessible name", `InsightsRangePicker/index.tsx:24`) — the long form is a better
name. But a speech-input user saying "click 90d" will not match, and the
mismatch is invisible to axe (`label-content-name-mismatch` is a best-practice
rule, excluded by the harness's tag set).

The e2e suite compounds it slightly: `a11y.spec.ts:87-103` locates options by
the accessible name ("30 days"), so the visible/accessible divergence is baked
into the test rather than flagged by it.

**Remediation:** render the visible label as "90d" with an `sr-only` " days"
suffix, so the accessible name is "90d days"-shaped and contains the visible
string; or accept the trade and record it as a known deviation.

#### ♿ A11Y-insights-admin-06 — Chart tooltips are pointer-only; only one of three charts has a keyboard route to its values

**WCAG:** `1.4.13 Content on Hover or Focus (AA)`, `2.1.1 Keyboard (A)`, `1.1.1 (A)` · **508:** `E205.4 / 502.2.2` · **Verdict: Partially Supports**

**Location:** `packages/insights/admin/src/lib/presentation/components/AreaTrend/index.tsx:113-136, 273-303` (has a fallback); `packages/insights/admin/src/lib/presentation/components/BarRows/index.tsx:86` (`title` only); `packages/insights/admin/src/lib/presentation/components/HeatGrid/index.tsx:91` (`title` only)

`AreaTrend`'s crosshair is driven by `onPointerMove`/`onPointerLeave` with no
focus equivalent — but it ships the `<details>` table, so the values are
reachable and it **Supports** on balance. `BarRows` and `HeatGrid` rely on the
native `title` attribute, which browsers surface on hover only, never on focus,
and which is not keyboard-reachable at all. A native `title` tooltip is also not
dismissible with `Esc`, not hoverable in some browsers, and disappears on a
timer — three `1.4.13` failures in one attribute.

`BarRows` partially escapes because its readout column is real text; `HeatGrid`
does not escape at all (see `♿ A11Y-insights-admin-01`).

**Remediation:** replace `title` with the design system's `Tooltip` (which shows
on focus and dismisses on `Esc`) on a focusable wrapper, or — better and cheaper
— add the table fallbacks and drop the tooltips.

#### ♿ A11Y-insights-admin-07 — The lazy route renders nothing while loading, and a chunk failure blanks the page

**WCAG:** `4.1.3 Status Messages (AA)`, `3.2.1 On Focus (A)` · **508:** `E205.4 / 502.3.14` · **Verdict: Partially Supports**

**Location:** `packages/insights/admin/src/lib/utils/insightsPlugin/index.tsx:14-18, 116-122`

`<Suspense fallback={null}>` means navigating to Insights shows an empty content
area with no skeleton, no spinner and no announcement until the chunk arrives.
The design system ships `AppLoader` and `WizardPageSkeleton` for exactly this.
There is also no error boundary around the lazy import, so a failed chunk fetch
(a stale deploy, a flaky network) produces a permanently blank page.

**Keyboard-only user:** activates the rail button and lands on apparently nothing.
**Screen-reader user:** hears no status change at all.
**Remediation:** give `Suspense` a `role="status"` skeleton fallback and wrap it
in an error boundary that offers a reload.

#### Advisory (WCAG 2.2 — not referenced by 508)

- **2.5.8 Target Size (Minimum, AA).** `SegmentedControlItem` is `h-7` (28px);
  the `<summary>` "Table view" is a 12px text row.
- **2.4.11 Focus Not Obscured (Minimum, AA).** The range picker lives in the
  portaled top bar, above the scrollport — a widget focused at the top of the
  scroll region can sit under it.

---

## 5. E2E Coverage Map

This unit has **both** a unit suite (`jest`, node environment, 21 cases over the
pure fold) and a strong e2e suite. The unit suite is cited as `🧪 UNIT`.

| Feature | Spec | Asserts | Verdict |
| --- | --- | --- | --- |
| F1 plugin route + rail | `apps/admin-e2e/src/insights/insights.spec.ts:24` | the page renders every contributed widget in its section | ✅ E2E |
| F3 widget slot | `apps/admin-e2e/src/insights/insights.spec.ts:62` | each widget contributes its slot id to the grid (`data-widget-id`) | ✅ E2E — a precise structural assertion, not a text sniff |
| F4 section slot | `apps/admin-e2e/src/insights/insights.spec.ts:88` | each band renders under its registered id (`data-section-id`) | ✅ E2E |
| F5 section merge, field-by-field | `packages/insights/admin/src/lib/utils/resolveInsightsLayout/index.spec.ts:138, 150, 170` | a later contribution wins by id; an override replaces only the fields it sets; an override does not move the band | 🧪 UNIT — three separate cases, exactly the right decomposition |
| F6 ordering | `.../resolveInsightsLayout/index.spec.ts:52, 71, 83, 94` | sections in order; widgets within a section; ties keep registration order; an order-less section sorts after the built-ins | 🧪 UNIT |
| F7 permissions | `.../resolveInsightsLayout/index.spec.ts:188, 201, 261`; `apps/admin-e2e/src/insights/insights.spec.ts:390` | gated widgets dropped, held permissions kept, orphans still gated; e2e confirms content widgets vanish for a user without `content:read` | ✅ E2E + 🧪 UNIT |
| F8 empty band dropped | `.../resolveInsightsLayout/index.spec.ts:211, 294`; `apps/admin-e2e/src/insights/insights.spec.ts:390` | a band whose every widget is gated out disappears; a registered section with no widgets disappears | ✅ E2E + 🧪 UNIT |
| F9 catch-all band | `.../resolveInsightsLayout/index.spec.ts:234, 251, 277` | an orphan lands in the trailing band; the band is absent when every section is registered; orphans from several unknown sections collect into one | 🧪 UNIT — **no e2e asserts `data-section-fallback` is absent on the real page**, which `AGENTS.md:69-70` says is worth asserting |
| F11 page + empty state | `apps/admin-e2e/src/insights/insights.spec.ts:417` | the empty page when no widget is visible | ✅ E2E |
| F14/F15 range picker | `apps/admin-e2e/src/insights/insights.spec.ts:265, 370`; `apps/admin-e2e/src/insights/a11y.spec.ts:75-103` | range-independent widgets take no range; changing the range refetches the dependent ones; arrow moves focus without selecting and `Enter` commits (`aria-checked` before and after) | ✅ E2E — the keyboard case is the best in the repo |
| F16 ladder — pending | `apps/admin-e2e/src/insights/insights.spec.ts:357`; `a11y.spec.ts:36-46` | a skeleton per widget while its request is open; axe-clean in that state | ✅ E2E |
| F16 ladder — error | `apps/admin-e2e/src/insights/insights.spec.ts:307, 242`; `a11y.spec.ts:48-73` | a failing widget does not take down the page; a failing coverage read does not empty the localisation band; axe-clean in the mixed state | ✅ E2E |
| F16 ladder — empty | `apps/admin-e2e/src/insights/insights.spec.ts:341` | an empty workspace shows empty states, **not** errors | ✅ E2E — this is the assertion that proves the ladder is not collapsed |
| F16 per-widget requests | `apps/admin-e2e/src/insights/insights.spec.ts:280` | each widget calls its own endpoint | ✅ E2E |
| F18 StatWidget error | `apps/admin-e2e/src/insights/insights.spec.ts:327` | a stat tile that cannot load shows **no figure at all** | ⚠️ PARTIAL — asserts the visual em dash; does not assert that the failure is conveyed to assistive tech, which it is not (`🐞 BUG-insights-admin-03`) |
| F21 AreaTrend fallback | `apps/admin-e2e/src/insights/insights.spec.ts:428` | the chart whose values are hover-only offers a table view | ✅ E2E |
| charts have a name | `apps/admin-e2e/src/insights/a11y.spec.ts:106-131` | three charts each expose `role="img"` with a matching name | ⚠️ PARTIAL — proves a name exists; proves nothing about whether it is an adequate alternative. `HeatGrid` passes this test while exposing none of its data |
| F17 WidgetBoundary | — | — | ⚠️ PARTIAL — the *query-failure* path is well covered; a **render throw** is never simulated, so the boundary itself, its console message and its (untranslated) fallback copy are unexercised |
| F2 `InsightsPlugin({ sections })` | `.../resolveInsightsLayout/index.spec.ts:114` (a plugin opening a brand-new band) | the fold handles a custom section set | 🧪 UNIT — the factory option itself is never called with a custom list |
| F10 useInsightsLayout | — | — | ⚠️ PARTIAL — covered transitively by every e2e case; its memo key and its auth fallback are not asserted |
| F13 widget sizing | — | — | ❌ NONE — no spec checks a `col-span-*` class or the `lg`-and-up-only rule |
| F19 Sparkline | — | — | ❌ NONE |
| F20 BarRows | — | — | ⚠️ PARTIAL — rendered inside covered widgets; the zero-segment drop, the 3px floor, the `max=0` guard and the clamp are never asserted |
| F22 ColumnTrend | — | — | ❌ NONE |
| F23 HeatGrid | `apps/admin-e2e/src/insights/a11y.spec.ts:116-120` | it has a `role="img"` name | ⚠️ PARTIAL |
| F24 RampLegend | — | — | ❌ NONE |
| F25 WidgetChip | — | — | ⚠️ PARTIAL — appears in covered widgets; its "always with an icon" rule is unasserted |
| F26 chartTone | — | — | ❌ NONE — the `toneForIntensity` thresholds and the `toneInk` swap are pure functions with no unit test, despite the package having a unit-test harness |
| F27 `retry: 1` | — | — | ❌ NONE — enforced in other packages' hooks; nothing here or there asserts it, and the ~7s-vs-~1s difference is exactly what the e2e error assertions depend on |

**Coverage tally:** `27 features · 12 ✅ · 9 ⚠️ · 6 ❌` (of which 6 are 🧪 UNIT-backed)

---

## 6. 🐞 Potential Bugs

### 🐞 BUG-insights-admin-01 — The widget error boundary's user-facing copy is hard-coded English · Severity: Medium

**Location:** `packages/insights/admin/src/lib/presentation/components/WidgetBoundary/index.tsx:55-61`
**Category:** correctness (i18n)

**What the code does:**

```tsx
<p role="alert" className="rounded-lg border border-destructive/40 …">
    This widget stopped working. The rest of the page is
    unaffected.
</p>
```

No `defineMessages`, no `useIntl`, no message id. It is the only user-facing
string in the entire package that is not localized — every other one, including
`WidgetCard`'s error and empty copy (`WidgetCard/index.tsx:6-15`), the page
title, subtitle and empty state (`InsightsPage/index.tsx:20-34`), and all four
range labels, goes through `react-intl`.

**Why it is wrong:** the package's own conventions require it — "co-located
`react-intl` messages namespaced `insights.<area>.<key>`"
(`packages/insights/admin/AGENTS.md:228-230`) — and the root `AGENTS.md` makes it
a workspace-wide rule. The cause is mechanical: `WidgetBoundary` is a class
component (deliberately, because React still has no hook equivalent of
`componentDidCatch`, `WidgetBoundary/index.tsx:23-25`) and therefore cannot call
`useIntl`. The `title` prop is already resolved by the *caller*
(`InsightsSectionBand/index.tsx:81-84` formats the message and passes the string),
which is exactly the pattern the body copy needs and did not get.

**Repro:**
1. Switch the admin to a non-English locale.
2. Make any contributed widget throw during render.
3. → Observed: a localized title over an English sentence. Expected: both
   localized.

**Blast radius:** every non-English deployment, at the moment a widget breaks —
i.e. precisely when the user most needs to understand what they are reading.
**Suggested fix:** add a `message: string` prop alongside `title` and have
`InsightsSectionBand` format `insights.widget.crashed` the same way it formats
the title.

### 🐞 BUG-insights-admin-02 — `WidgetCard`'s loading and empty states are invisible to assistive technology · Severity: Medium

**Location:** `packages/insights/admin/src/lib/presentation/components/WidgetCard/index.tsx:83-105`
**Category:** a11y

**What the code does:**

```tsx
{isPending ? (
    <div className="flex flex-col gap-2.5" data-testid="widget-skeleton">
        {Array.from({ length: skeletonRows }, (_, index) => (
            <Skeleton key={index} className="h-4 w-full" />
        ))}
    </div>
) : isError ? (
    <p role="alert" …>{intl.formatMessage(messages.error)}</p>
) : isEmpty ? (
    <p …>{intl.formatMessage(messages.empty)}</p>
) : (children)}
```

The error branch has `role="alert"`. The pending branch has no `role="status"`,
no `aria-busy` on the card, and no `sr-only` text. The empty branch has no role
either.

**Why it is wrong:** the design system's `Skeleton` states the contract
explicitly — "Compose several into a content-shaped placeholder, and wrap **that
placeholder** in a `role="status"` region with an `sr-only` label so the busy
state is announced once (the blocks themselves stay silent)"
(`packages/design-system/src/lib/components/ui/skeleton.tsx:12-15`). `WidgetCard`
is the single place that could satisfy that contract for every widget in the
system, and it is the place it is missing. The `AppLoader` primitive shows what
compliance looks like (`app-loader.tsx:30-44`).

The empty branch matters just as much for a different reason: the unit's central
claim is that "'nothing needs attention' and 'we couldn't ask' look identical and
mean opposite things" (`WidgetCard/index.tsx:44-47`). Visually they are now
distinct. To a screen reader, the failure announces itself and the empty state
does not — so the two remain indistinguishable for exactly the users least able
to compare them at a glance.

**Repro:**
1. Load `/workspaces/:id/insights` with a screen reader running.
2. → Observed: nine cards silently swap skeletons for content; a card with no
   data announces nothing. Expected: "Loading Gone quiet…" then a settled
   announcement.

**Blast radius:** every screen-reader user of the dashboard, in the normal case
(loading) rather than the exceptional one.
**Suggested fix:** wrap the pending branch in
`<div role="status" aria-busy="true">` with an `sr-only` "Loading \<title\>…",
and give the empty branch `role="status"`. Cross-reference
`♿ A11Y-insights-admin-03`.

### 🐞 BUG-insights-admin-03 — A failed stat tile is silent to assistive technology · Severity: Medium

**Location:** `packages/insights/admin/src/lib/presentation/components/StatWidget/index.tsx:52-66`
**Category:** a11y / correctness

**What the code does:**

```tsx
) : isError ? (
    <>
        {/* An unreachable count must not render as a real
            figure — an em dash reads as "unknown", a 0 reads as
            "none", and those are opposite facts. */}
        <span className="text-2xl font-semibold tracking-[-0.02em]" aria-hidden="true">
            —
        </span>
        <span className="text-xs text-muted-foreground">{label}</span>
    </>
) : (
```

The comment is exactly right about the visual design, and then the em dash is
marked `aria-hidden="true"` with **nothing** put in its place.

**Why it is wrong:** the resulting accessible output for a failed tile is the
label alone — "Active entries" — which is indistinguishable from a tile whose
value simply has not been announced, and gives no hint that the figure is
unavailable. The component thereby reproduces, for screen-reader users, exactly
the confusion its comment sets out to prevent for sighted ones. Unlike
`WidgetCard`, `StatWidget` renders no `role="alert"` at all in its error branch,
so there is no other channel carrying the failure.

**Repro:**
1. `mockInsightsApi(page, { failing: ['content/totals'] })`.
2. Read the Active-entries tile with a screen reader.
3. → Observed: "Active entries". Expected: "Unavailable, Active entries" or
   similar.

**Blast radius:** the three Overview stat tiles plus the media storage tile —
the first things on the page.
**Suggested fix:** keep the `aria-hidden` em dash and add an `sr-only` localized
"Unavailable" beside it, or give the error branch a `role="status"` with that
text. Cross-reference `♿ A11Y-insights-admin-03`.

### 🐞 BUG-insights-admin-04 — `AreaTrend` draws negative values outside its own chart area · Severity: Low

**Location:** `packages/insights/admin/src/lib/presentation/components/AreaTrend/index.tsx:60-105, 130-132`
**Category:** correctness

**What the code does:**

```ts
function niceMax(value: number): number {
    if (value <= 0) return GRID_STEPS;
    …
}
…
const max = niceMax(Math.max(...points.map((p) => p.value), 0));
…
y: BASELINE - (point.value / max) * plotHeight
```

The scale is anchored at zero and derived from the **maximum** only. A negative
`point.value` produces `y > BASELINE`, i.e. below the axis — and the SVG carries
`className="… overflow-visible"` (`AreaTrend/index.tsx:132`), so the line, the
area fill and the endpoint dot are drawn **outside** the viewBox, over whatever
sits beneath the card.

**Why it is wrong:** the primitive is exported for contributors
(`packages/insights/admin/src/index.ts:62`) with no documented constraint that
values must be non-negative. Today's velocity/uploads widgets are counts, so it
is unreachable — but a "net change" or "delta vs previous period" widget is an
obvious next contribution and would render visibly broken with no error.

**Repro:** render `<AreaTrend points={[{label:'a',value:10},{label:'b',value:-5}]} … />`
→ Observed: the second point is drawn below the card's bottom edge. Expected:
either a scale that accommodates it, or the value clamped with the table fallback
still reporting the true number.

**Blast radius:** none today; a trap for the next contributor.
**Suggested fix:** compute the domain from both `min` and `max` and place the
baseline at zero within it, or clamp and document the non-negative constraint in
the JSDoc.

### 🐞 BUG-insights-admin-05 — The selected range is not in the URL, so a dashboard view cannot be shared and Back does not undo it · Severity: Low

**Location:** `packages/insights/admin/src/lib/hooks/useInsightsRange/index.tsx:43-56`
**Category:** ux-state

**What the code does:** `const [range, setRange] = useState<InsightsRange>(DEFAULT_RANGE)`
— plain component state inside a provider mounted by `InsightsPage`. Nothing
reads or writes `useSearchParams`, and nothing persists it.

**Why it is wrong:** every other filterable surface in this admin puts its state
in the URL — the query builder's whole contract is that a filter is a shareable
deep link (`packages/query-builder/admin/AGENTS.md:5-7`), and the records and
members pages both round-trip through `?filter=`. The Insights page is the one
place where "look at this" cannot be sent to a colleague, where a reload silently
resets the window, and where browser Back after changing the range does nothing.

`AGENTS.md` even notes the absence of a saved layout and names
`InsightsWidget.id` as the handle one would key on (`AGENTS.md:215-217`) — so
persistence has been thought about for layout and not for range.

**Repro:** select 90d, copy the URL, open it in a new tab. → Observed: 30d.

**Blast radius:** every user; low severity but constant.
**Suggested fix:** back the provider with `useSearchParams` (`?range=90d`),
validating against `INSIGHTS_RANGES` and falling back to the default.

### 🐞 BUG-insights-admin-06 — `HeatGrid` has no text equivalent for its data · Severity: Low

**Location:** `packages/insights/admin/src/lib/presentation/components/HeatGrid/index.tsx:64-105`
**Category:** a11y

Filed as a functional bug as well as `♿ A11Y-insights-admin-01` because it is an
inconsistency within the package rather than only a conformance gap: `AreaTrend`
ships a `<details>`+`<table>` fallback with a comment explaining that hover-only
values "have to exist as text" (`AreaTrend/index.tsx:270-272`), and `HeatGrid`
— which encodes *more* data, entirely in colour — ships none. Two of the four
heat grids on the page (the Team punchcard and alt-text coverage) therefore have
no non-visual representation at all.

**Suggested fix:** copy `AreaTrend`'s disclosure pattern into `HeatGrid`.

### 🐞 BUG-insights-admin-07 — Widget and section slot items are not de-duplicated · Severity: Low

**Location:** `packages/insights/admin/src/lib/presentation/components/InsightsSectionBand/index.tsx:74-78`; registry at `packages/utils/admin/src/lib/slot/index.ts:31-38`
**Category:** correctness

`createSlot` appends unconditionally, so two plugins contributing the same widget
`id` both render and React warns about the duplicate key at
`InsightsSectionBand/index.tsx:76`. Sections are safe by construction — `mergeSections`
folds duplicates by id (`resolveInsightsLayout/index.ts:49-72`), which is the
documented override mechanism — but **widgets have no equivalent**, and the
asymmetry is undocumented: a contributor who has learned "sections merge by id"
will reasonably expect widgets to as well.

Under Vite HMR the same registry behaviour duplicates every widget on a hot
reload (dev-only).

**Suggested fix:** de-duplicate widgets by `id` in `resolveInsightsLayout`
(last-wins, matching sections), or de-duplicate in `createSlot` and document it.

### 🐞 BUG-insights-admin-08 — `WidgetBoundary` never resets, so a transient render error is permanent · Severity: Low

**Location:** `packages/insights/admin/src/lib/presentation/components/WidgetBoundary/index.tsx:30-47`

`state = { failed: false }` is set to `true` by `getDerivedStateFromError` and
never set back. A widget that throws once — say, on a first render where a query
result was momentarily `undefined` — shows the failure card for the rest of the
session, even after the data arrives and every subsequent render would succeed.
Changing the range, which refetches everything, does not clear it.

**Suggested fix:** reset `failed` when the `title` prop changes, or expose a
"Try again" button in the fallback that clears the state.

### 🐞 BUG-insights-admin-09 — A widget with an unrecognised `size` collapses to one column of twelve · Severity: Low

**Location:** `packages/insights/admin/src/lib/presentation/components/InsightsSectionBand/index.tsx:17-23, 78`

`cn(SIZE_SPAN[widget.size ?? 'md'])` yields `cn(undefined)` — an empty class
string — for any `size` outside the five known keys. The widget then inherits the
grid's default placement: one column of a twelve-column grid, roughly 8% of the
row. `InsightsWidgetSize` is a TypeScript union so this is unreachable in-repo,
but the slot is explicitly designed for npm-installed plugins, which can pass
anything.

**Suggested fix:** fall back to `SIZE_SPAN.md` for an unknown value.

### Checked and cleared (no defect found)

- **The four-branch ladder.** Pending → error → empty → data, with error taking
  precedence over empty (`WidgetCard/index.tsx:83-105`). Verified end-to-end in
  all three non-data states (`insights.spec.ts:307, 341, 357`). Centralising it
  is what makes it impossible for a contributed widget to collapse the branches,
  and it works.
- **Per-widget isolation.** Each widget owns its request and its boundary, so one
  slow or failing aggregate degrades one card. Asserted at
  `insights.spec.ts:280, 307, 242`.
- **`BarRows` zero-segment drop.** The `> 0` filter (`BarRows/index.tsx:82`)
  correctly prevents the 3px floor from rendering an absent category as a sliver
  of colour — a chart stating the opposite of its data. The `max <= 0` guard
  (`:67`) prevents `NaN%` widths rendering as full-width bars. Both are real
  bugs already fixed.
- **`Sparkline` flat-series guard.** `span = max - min || 1` (`Sparkline/index.tsx:24`).
- **`toneForIntensity` non-finite input.** `!Number.isFinite(intensity)` → `q0`
  (`chartTone/index.ts:68`).
- **Ordering stability.** `Array.prototype.sort` is stable and both sorts copy
  first (`resolveInsightsLayout/index.ts:107, 111`); asserted at
  `resolveInsightsLayout/index.spec.ts:83`.
- **Section merge preserving position.** `Map` insertion order plus a stable sort
  means an override cannot silently move a band; asserted at
  `resolveInsightsLayout/index.spec.ts:170`.
- **Catch-all band.** Orphaned widgets are never dropped, are collected into one
  band, and are still permission-filtered
  (`resolveInsightsLayout/index.spec.ts:234, 261, 277`).
- **`useInsightsRange` outside a provider.** Returns the default rather than
  throwing, with a documented rationale (`useInsightsRange/index.tsx:58-65`).
- **`SegmentedControl` deselect.** Guarded (`InsightsRangePicker/index.tsx:45-49`).
- **Range-independent widgets.** Asserted not to refetch on a range change
  (`insights.spec.ts:265`) — a sharper assertion than most suites make.

**Tally:** 9 🐞 (0 Critical · 0 High · 3 Medium · 6 Low) · 7 ♿
(0 Supports · 5 Partially Supports · 2 Does Not Support)

---

## 7. Recommended E2E Tests

| Priority | Harness | Proposed spec | Asserts | Closes |
| --- | --- | --- | --- | --- |
| 1 | `apps/admin-e2e` POM + `page.route` mock | `src/insights/insights.spec.ts` — new case, with a fixture widget that throws | `WidgetBoundary` shows a titled failure card, neighbours survive, and the copy is **localized** (run with the intl locale forced to `de`) | `🐞 BUG-insights-admin-01`, F17 ⚠️ |
| 2 | `apps/admin-e2e` | `src/insights/a11y.spec.ts` — new cases | The loading state exposes a `role="status"` region naming the widget; a failed stat tile conveys "unavailable" to AT, not just an `aria-hidden` em dash | `🐞 BUG-insights-admin-02`, `-03`, `♿ A11Y-insights-admin-03` |
| 3 | `apps/admin-e2e` | `src/insights/a11y.spec.ts` — chart alternatives | Every `role="img"` chart is accompanied by a text equivalent containing the same numbers (a `<details>` table for `HeatGrid` as well as `AreaTrend`) — assert on the **data**, not on the presence of a name | `🐞 BUG-insights-admin-06`, `♿ A11Y-insights-admin-01` |
| 4 | package unit (`jest`, node — the harness already exists) | `packages/insights/admin/src/lib/utils/chartTone/index.spec.ts` | `toneForIntensity` at 0, 0.2, 0.45, 0.7, 0.9, 1, 1.5, `NaN`, `-1`; `toneInk` swaps at q4 | F26 ❌ |
| 5 | package unit | `packages/insights/admin/src/lib/presentation/components/BarRows/index.spec.tsx` | A zero segment is not rendered; `max=0` yields 0%-wide bars, not full-width; a value above `max` clamps; a negative value is dropped | F20 ⚠️ |
| 6 | package unit | `packages/insights/admin/src/lib/presentation/components/AreaTrend/index.spec.tsx` | `niceMax` ladder; a single point; an all-zero series; **a negative value does not produce a `y` below the baseline** | `🐞 BUG-insights-admin-04`, F21 |
| 7 | `apps/admin-e2e` | `src/insights/insights.spec.ts` — new case | `data-section-fallback="true"` is **absent** on the correctly-wired page, and present when a fixture widget names an unknown section | F9 (e2e half) |
| 8 | `apps/admin-e2e` | `src/insights/insights.spec.ts` — new case | Selecting 90d writes `?range=90d`; reloading that URL restores 90d; Back returns to 30d | `🐞 BUG-insights-admin-05` |
| 9 | `apps/admin-e2e` (new project — see design-system §7) | the whole `src/insights/a11y.spec.ts` under `colorScheme: 'dark'` | Chart series and ramp steps clear contrast in the dark palette, where the ramp's direction flips | `♿ A11Y-insights-admin-02` |
| 10 | `apps/admin-e2e` | `src/insights/insights.spec.ts` — sizing case | An `xs` widget carries `col-span-6 lg:col-span-3` and a `full` widget `col-span-12`; an unknown size falls back to `md` | F13 ❌, `🐞 BUG-insights-admin-09` |
| 11 | package unit | `packages/insights/admin/src/lib/utils/resolveInsightsLayout/index.spec.ts` — new case | Two widgets contributing the same `id` resolve to one (last wins), matching the section behaviour | `🐞 BUG-insights-admin-07` |
| 12 | `apps/server-e2e` testcontainer + supertest | extend `src/server/insights/content-insights.spec.ts` etc. | For `days = 7`, the aggregate's window boundaries are exactly what the endpoint documents — inclusive/exclusive end, timezone, and behaviour across a DST transition | EC-10 (the boundary maths this unit delegates) |
