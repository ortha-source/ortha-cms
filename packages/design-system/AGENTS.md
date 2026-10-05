# @orthacms/design-system

shadcn/ui library. Import as `import { Button, cn } from '@orthacms/design-system'`.

## Adding/editing components

Component work is driven by the **shadcn skill** — it runs the CLI with
`-c packages/design-system`. Two rules apply to every component (CLI-added or
hand-written):

1. **Relative imports, not `@/`** — Vite's dev server can't resolve the
   library-local `@/*` alias when the admin app consumes design-system source.
   e.g. `import { cn } from '../../utils'`.
2. **Export from `src/index.ts`** — the package's only public surface.

## Layout

- UI components → `src/lib/components/ui/`
- utilities → `src/lib/` · hooks → `src/lib/hooks/`
- Theme tokens (Tailwind v4 `@theme`) live in `apps/admin/src/styles.css`
- The package also ships a small global stylesheet at `src/styles.css` (the
  `wizard-step-in` animation used by `WizardStepCard`, the dropdown entrance,
  and the `Sheet` slide-in — entrance only, off under reduced motion, for the
  reasons written above its rules); the host imports it once,
  after `@import 'tailwindcss'`. Generic multi-step wizard chrome (`Stepper`,
  `WizardStepCard`, `WizardFooter`) lives in `ui/wizard.tsx` — copy-free and
  i18n-free, configured by the consumer.

## Notes

- `TopBar` composes with `TopBarIcon` (leading tile) and **`TopBarActions`** (the
  trailing, `ml-auto` region for page actions — place it as the bar's _last_
  child). `TopBarActions` is presentational only; who fills it is the consumer's
  business, because the design system can't reach the shell's context.
- **`SidebarInset` is split into a fixed bar strip and a scrollport**, and
  `TopBar` **hoists itself into that strip by portal** when there's an inset
  above it (it renders in place otherwise, e.g. on public pages). That is what
  keeps the bar out of the scrolling region, so the scrollbar starts under the
  bar instead of running its full height beside it. A page still just writes
  `<TopBar>` first in its tree and knows nothing about this. Because it's a
  portal, the bar keeps its page's React context — which is what lets the
  shell's page-actions region work from inside it.
- **`InsetFooterEnd`** portals its children to the **right end of the
  `InsetFooter`** — the strip under the work area's card, on the sidebar's
  frame — on every page: chrome that belongs to the app rather than the page
  (the copilot's "Ask Ortha AI"). The shell renders `InsetFooter` as the card's
  sibling; empty, it keeps only the frame's 8px bottom gutter. Its host lives in
  `SidebarProvider`'s context, because what fills it is usually mounted outside
  the inset (the sidebar's footer slot). Nothing floats `fixed` over the page,
  so no scrollport reserves a bottom gutter.

## Notes on specific components

- **`SegmentedControl` has two variants, and the default is the toolbar one.**
  `variant="field"` is for a segmented control used as a **form control** — the
  entry editor's boolean field — and matches `Input` / `Textarea` /
  `SelectTrigger` on radius, border token and height. Those are not
  interchangeable with the toolbar's: `border-input` is deliberately a step
  darker than `border`, so an editable surface reads as editable, and the
  toolbar's 38px box left the boolean field standing proud of its neighbours.
  Five of the six call sites are toolbars, which is why the fix is a variant
  rather than a change to the base class.
- **`ContainerHeader` is where the admin's `<h1>` lives** — every page,
  including the two that used to draw their own. Its optional `icon` takes a
  sized icon element and draws the tile itself; the tile is `aria-hidden`,
  because the heading beside it already names the page.
- **Under a top bar, `ContainerHeader` folds away.** The shell hands it the
  bar's actions region through `PageHeaderHost`; with one present on a desktop
  viewport the header keeps its `<h1>` and subtitle for assistive technology
  only (`sr-only`) and portals its `actions` into the bar inside a
  `DensityProvider density="compact"`, which steps every control one notch
  down (`Button`, `InputGroup`, `SelectTrigger`, a toolbar `SegmentedControl`)
  so a page's controls fit the shorter line box without the page knowing where
  they are drawn. `SearchToolbar` sets the same density, so a list's search box
  and its Columns / Filters buttons take the top bar's 32px line too. `keepSubtitle` keeps a subtitle on screen when it is
  data rather than a gloss (a webhook's URL). Below the breakpoint, or with no
  bar, it draws in full — the bar has no room there for a page's actions.
- **A page's tabs go in the top bar's second row** — wrap the `TabsList` (or
  `TabNav`) in `TopBarTabs`. Inside a `SidebarInset` it portals into the strip
  under the bar, the way `TopBar` hoists itself, so the breadcrumb, the page's
  actions and its tabs read as one header band ruled once at the bottom. The
  `Tabs` root stays in the page and still owns the triggers (a portal keeps the
  React tree). Tabs inside a sheet or a dialog are not page tabs and stay put.
- **`FieldError` is set like `FieldDescription`, on purpose.** They occupy the
  same line under the same control, one replacing the other, so size, weight,
  line box and vertical rhythm all have to match — colour is the only thing that
  should change. `InputField` hides the hint with `sr-only` rather than
  unmounting it when an error appears (`ORT-197`): it has to stay in the
  document for `aria-describedby` to resolve, and the instruction is worth most
  to the reader who just tripped the rule it states.
- **`MultiSelect` is a closed list by default.** Passing `onCreate` opens it:
  the search box then offers an "Add …" row for a query that matches no option,
  and the caller decides what the query means (it may name several values). The
  row is suppressed for a query that already names an option — two rows for one
  value would toggle different code paths. Without the prop the search box
  answers "No results." and cannot invent a value, which is what a picker over
  a fixed vocabulary needs.

## Tests

The package has a vitest + Testing Library suite (`npx nx test design-system`),
co-located as `<component>.spec.tsx`. `src/test-setup.ts` shims the browser APIs
jsdom lacks and Radix/cmdk/sonner require (`matchMedia`, `ResizeObserver`,
pointer capture, `scrollIntoView`) — without it, anything built on `Popover`,
`Command` or `Sheet` throws before the assertion.

It is not a coverage exercise. What belongs here is the seam a _page_ test
cannot reach: a prop combination no shipped consumer passes
(`invalid={false}` beside an error), a collision no shipped data produces (two
options sharing a label), a value a browser test cannot see (the seconds in a
datetime), or a preference the e2e harness does not emulate. Behaviour that a
real page exercises belongs in `apps/admin-e2e`, where it is exercised for real.

Two platform preferences are covered from `admin-e2e`, not here, because they
are properties of the composed stylesheet:
`apps/admin-e2e/src/host/platform-preferences.spec.ts` scans the **dark**
palette (every other axe scan runs light) and asserts a focus indicator
survives `forced-colors: active` — where the UA drops `box-shadow`, and so
drops every Tailwind `ring-*` in this library along with it.

## TS conventions

- `type` over `interface`
- JSDoc on exported symbols
- `import type` for type-only imports
- No `.js` extensions in imports
