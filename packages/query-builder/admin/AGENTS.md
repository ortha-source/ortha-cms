# @ortha-cms/query-builder-admin

Admin-side React component for visually composing filter trees against a
typed schema. Emits the JSON tree grammar consumed by `parseFilterTree`
in `@ortha-cms/utils-server`:
`?filter={"and":[{"field":"email","op":"ilike","value":"%@x"}]}`.
The state shape, wire format, and UI all round-trip OR + nested groups
end-to-end. Each group owns an AND/OR toggle and an Add group action.

## Package

- Name: `@ortha-cms/query-builder-admin`
- Import: `import { QueryBuilder, QueryBuilderDrawer, type FilterField } from '@ortha-cms/query-builder-admin'`
- Pure UI library — depends only on `@ortha-cms/design-system`,
  `lucide-react`, `react-intl` (+ React peers). No router / data layer.

## Conventions

- Uses `type` for type contracts (not `interface`)
- All exported symbols must have JSDoc comments
- No `.js` extensions in TypeScript imports
- Types go in `src/lib/types/`; plain functions in `src/lib/utils/`
- Components go in `src/lib/components/{ComponentName}/index.tsx`
- i18n: each component co-locates its own `defineMessages` (no shared
  `messages.ts`), per the admin i18n convention
- Always import types with the `type` keyword

## Key exports

- `QueryBuilder` — headless controlled component over a `FilterTree`
- `QueryBuilderDrawer` — drawer wrapper owning open state, a staged
  draft, JSON preview, and the Apply/Reset footer; consumer passes a
  `trigger`
- `FilterField`, `FieldType`, `FilterEnumValue` — schema types the
  consumer declares (a static mirror of the BE `FilterSchema`)
- `FilterTree`, `FilterGroup`, `FilterRule`, `OpId`, `RuleValue` — tree types
- `treeToJsonFilter(tree, now?)` — serialise tree → JSON string for `?filter=`
- `jsonFilterToTree(params)` — inverse; reads `params.get('filter')`
- `countRules(tree)` — leaf count for a "Filters (N)" badge
- `treeHasInvalidRules` / `validateRule` — the Apply gate

## Wire grammar

Each leaf serialises to `{ field, op, value }`; groups to `{ and: [...] }` /
`{ or: [...] }`. UI ops map to BE operators:

| UI op                   | Wire op                                                   |
| ----------------------- | --------------------------------------------------------- |
| `equals` / `not_equals` | `eq` / `ne`                                               |
| `contains`              | `ilike`, value wrapped in `%v%`                           |
| `is_one_of`             | `in` (value stays an array)                               |
| `is_empty`              | `null`, value `true`                                      |
| `between`               | small `and` group of `gte` + `lte`                        |
| `gt`/`gte`/`lt`/`lte`   | matching wire op                                          |
| `within_last`           | `gte` with resolved ISO cutoff (pinned at serialise time) |

Incomplete rules and empty groups are pruned at serialise time, so the
wire payload is always well-formed even while the drawer holds drafts.

## Deferred

Compound-string fallback, SQL preview tab, async value editors for FK
fields (a polished multi-select replaces the CSV input for `is_one_of`).

## Commands

- `npx nx typecheck @ortha-cms/query-builder-admin`
