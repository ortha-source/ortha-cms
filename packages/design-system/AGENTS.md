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

## TS conventions

- `type` over `interface`
- JSDoc on exported symbols
- `import type` for type-only imports
- No `.js` extensions in imports
