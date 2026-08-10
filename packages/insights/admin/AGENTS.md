# @ortha-cms/insights-admin

The **Insights feature plugin** for the Ortha CMS admin UI — a workspace
dashboard at `/workspaces/:id/insights`.

It ships the **frame and nothing else**: the route, the range picker, the
section bands, the widget card shell, a per-widget error boundary, and a small
set of chart primitives. It contributes **no widgets of its own** and imports no
other feature package. Every card on the page arrives through
`INSIGHTS_WIDGET_SLOT` from the plugin that owns the data behind it. That is the
whole point — a dashboard is the module most likely to slowly become the one
that has to know about every other one, and the slot is what prevents it.

## The extension points

```ts
export const INSIGHTS_WIDGET_SLOT =
    createSlot<InsightsWidget>('insights.widget');
export const INSIGHTS_SECTION_SLOT =
    createSlot<InsightsSection>('insights.section');
```

An `InsightsWidget` is `{ id, section, order, size?, permission?, titleId,
defaultTitle, Component }`. The shape follows `shell-admin`'s
`HOME_SECTION_SLOT` — a zero-prop `Component` that reads what it needs — rather
than inventing a new one.

Two details are load-bearing:

- **`permission` is on the item _and_ checked inside the component.** The page
  has to know whether a band has any visible widgets _before_ it renders that
  band's heading, or a reader without `content:read` gets a "Content" header
  sitting over nothing. Same reason the workspace sidebar checks twice.
- **`titleId` / `defaultTitle` exist for the error boundary.** The widget renders
  its own title through `WidgetCard`; the item's copy is what the boundary shows
  when the component throws, because "Gone quiet stopped working" is a far more
  useful failure than an anonymous broken card.

The plugin registers four sections — `overview`, `content`, `reach`, `team`
(`INSIGHTS_SECTION_IDS`). A band with no visible widgets renders nothing at all,
so an install without `media-admin` simply has no "Localisation & media" band.

**Registration order does not matter.** `createAdmin` walks every plugin's
contributions in one pass _after_ all factories have run, so a package
contributing widgets here may be registered before `InsightsPlugin()`.

## Layout — layered (ADR-0003)

A read-only viewer, so per ADR-0003 there is **no `domain/` layer** — nothing
here has client-side business rules:

```
src/lib/
  utils/insightsPlugin/        # the AdminPlugin factory
  utils/chartTone/             # palette ROLES (series-1/2, the q0..q5 ramp)
  hooks/useInsightsRange/      # the shared window + its provider
  hooks/useInsightsLayout/     # sections × permitted widgets, ordered
  presentation/
    slots/insightsSlots/       # the two extension points
    pages/InsightsPage/
    components/                # the card shell + the chart primitives
```

## Charts — hand-built, deliberately

There is **no charting dependency**, and adding one should be argued for rather
than assumed. The whole page is bar lists, one area chart and two heat grids;
Recharts is ~500 KB and brings its own reconciliation for marks that are a few
`div`s and one `path`. These primitives also read the same design tokens as the
rest of the admin, so they follow the theme instead of needing a parallel
styling system.

Exported for contributors: `BarRows`, `AreaTrend`, `ColumnTrend`, `HeatGrid`,
`RampLegend`, `StatWidget`, `Sparkline`, plus `WidgetCard` / `WidgetChip`.

### The colour rules a contributed widget must follow

The palette lives in `apps/admin/src/styles.css` as `--color-chart-*`, and is
addressed through `ChartTone` roles rather than by colour name.

- **Exactly two categorical slots.** `series-1` / `series-2` are the only pair
  that clears colourblind separation against **both** the light card (`#ffffff`)
  and the dark card (`#19191f`). Blue + violet — the obvious next choice — fails
  at ΔE 1.9 under protanopia in dark mode. A widget needing a third category
  needs a different chart, not a third colour.
- **`q0`…`q5` are a sequential ramp**, for magnitude only. Never use ramp steps
  to distinguish categories; readers infer an ordering that isn't there.
- **The ramp's direction flips between themes** — low sits near the surface and
  high reads bright, so "more" always means "more visible". Any caption written
  about it must be phrased that way: "colour intensifies with age", **never**
  "darker means older", which is true in exactly one theme.
- **No text inside a fill.** Values go in the readout column in an ink token.
  A number printed on a bar has to stay legible against whichever palette step
  it lands on in both themes; moving it out removes the whole class of bug.
- **Status colours (`WidgetChip`) are separate from the series palette** and
  always ship with an icon, so a chip can never be mistaken for a series.

The palette values are stored as **hex, not oklch** like every other token —
they are the validator's output, and re-expressing them would let rounding drift
from the numbers that were actually checked.

## State, loading and failure

`WidgetCard` owns the **four-branch ladder** — pending, error, empty, data — so
no contributed widget can collapse them by accident. A failed load rendered as
an empty state is the most misleading thing a dashboard can do: "nothing needs
attention" and "we couldn't ask" look identical and mean opposite things. The
same reason `StatWidget` renders an em dash rather than `0` on error.

Each widget owns **its own request**, so a slow or failing aggregate degrades one
card instead of blanking the page, and each is wrapped in a `WidgetBoundary` so a
throw from another package's component can't unmount its neighbours.

Insights queries set **`retry: 1`**, not TanStack's default 3. Three attempts
with exponential backoff leave a broken widget sitting on a skeleton for about
seven seconds — on a page whose premise is that one card fails alone, that reads
as a hang rather than a failure.

## Contributing a widget

From the owning plugin's factory — it needs a dependency on
`@ortha-cms/insights-admin`, the same direction as any slot filler:

```tsx
slots: [
    {
        slot: INSIGHTS_WIDGET_SLOT,
        items: [
            {
                id: 'insights.content.stale',
                section: INSIGHTS_SECTION_IDS.Content,
                order: 10,
                size: 'md',
                permission: CONTENT_READ,
                titleId: 'content.insights.stale.title',
                defaultTitle: 'Gone quiet',
                Component: StaleEntriesWidget
            }
        ]
    }
];
```

Sizes map to twelfths — `xs` 3, `sm` 4, `md` 6, `lg` 8, `full` 12 — and only
apply from the `lg` breakpoint up; below that widgets collapse toward full
width, because a heat grid in a third of a phone screen is not a smaller
dashboard, it is a broken one.

**Who contributes what today.** `content-admin`: three Overview stat tiles, Gone
quiet, Draft/published by type, Publishing velocity, and the Team punchcard.
`media-admin`: the storage stat tile, storage by kind, Uploads, and alt-text
coverage. Their endpoints live in `content-server` (`/api/insights/content/*`)
and `media-server` (`/api/insights/media/*`) — **live aggregates, no
projection**; the seam to change that later is those query classes alone.

## Not built yet

Top contributors and Copilot usage (both sketched, neither wired). Delivery
traffic — API reads, popular entries, error rates — is **not possible** today:
nothing records a public-API request beyond `api_tokens.last_used_at`, so it
needs its own capture work rather than another widget.

There is no saved layout; `InsightsWidget.id` is the handle one would key on.

## Package

- Name: `@ortha-cms/insights-admin`
- Grouped package (`packages/insights/admin`), admin-only. Consumed from source.
- Register after `WorkspacesPlugin()` — it contributes to the workspace shell's
  `WORKSPACE_NAV_SLOT` / `WORKSPACE_ROUTE_SLOT`.

## Conventions

`type` over `interface`; JSDoc on exports; `<name>/index.ts(x)` folders; one
component per file; co-located `react-intl` messages namespaced
`insights.<area>.<key>`; UI from `@ortha-cms/design-system` only.

## End-to-end cover

`apps/admin-e2e/src/insights/{insights,a11y}.spec.ts`, driven by `InsightsPage`
and seeded by `support/api/insights.ts` (which can fail or empty **one** route,
since degrading a single widget is the behaviour worth pinning). Covers the slot
contract, per-widget requests, error-vs-empty, the permission gate collapsing a
whole band, range refetching, and axe scans of the loaded, loading and
partially-failed states.

## Commands

- `npm exec nx typecheck @ortha-cms/insights-admin`
- `npm exec nx lint @ortha-cms/insights-admin`
