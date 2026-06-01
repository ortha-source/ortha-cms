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

## TS conventions

- `type` over `interface`
- JSDoc on exported symbols
- `import type` for type-only imports
- No `.js` extensions in imports
