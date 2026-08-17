# @ortha-cms/design-system

shadcn/ui library. Import as `import { Button, cn } from '@ortha-cms/design-system'`.

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
  `wizard-step-in` animation used by `WizardStepCard`); the host imports it once,
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

## Tests

The package has a vitest + Testing Library suite (`npx nx test design-system`),
co-located as `<component>.spec.tsx`. `src/test-setup.ts` shims the browser APIs
jsdom lacks and Radix/cmdk/sonner require (`matchMedia`, `ResizeObserver`,
pointer capture, `scrollIntoView`) — without it, anything built on `Popover`,
`Command` or `Sheet` throws before the assertion.

It is not a coverage exercise. What belongs here is the seam a *page* test
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
