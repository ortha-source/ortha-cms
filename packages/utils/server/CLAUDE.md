# @ortha-cms/utils-server

Server-side shared utilities for Ortha CMS. Currently one concern: the
**filter query builder** — translates a REST-style `?filter=` payload into a
Drizzle SQL fragment that callers splice into their `WHERE` clause.

The package has no NestJS module of its own — it's a pure helper library any
plugin can import.

## Package

- Name: `@ortha-cms/utils-server`
- Import: `import { applyFilterTree, parseFilterTree } from '@ortha-cms/utils-server'`

## Conventions

- Uses `interface` for type contracts (not `type`)
- All exported symbols must have JSDoc comments
- No `.js` extensions in TypeScript imports
- Filter-only types/interfaces go in `src/lib/filters/types.ts`
- Always import types/interfaces with the `type` keyword

## Filter pipeline

Translate a user-supplied `?filter=<json>` into a Drizzle `SQL` fragment:

1. `parseFilterTree(raw, schema)` → `ParsedNode | null` (group/rule tree,
   validated against a `FilterSchema`; `null` for an empty filter)
2. `applyFilterTree(node, schema, table, db, opts)` → `SQL | undefined`
   (Drizzle fragment, or `undefined` for an empty tree)

Callers `and()` the result with their own search/status predicates — the
engine never owns the full WHERE clause.

Key concepts:

- **`FilterSchema`** declares which columns are filterable (`fields`), which
  relations are traversable (`relations`), optional `extensionFields` resolved
  by a host-supplied `resolveExtension` hook (e.g. a `role` filter), and the
  `maxDepth` / `maxNodes` / `maxGroupDepth` guards.
- **Relation kinds** — `one-to-one` / `one-to-many` / `many-to-one` /
  `many-to-many` / `self-referential` — discriminate the EXISTS subquery shape.
- **Operators** — `eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `in`, `nin`, `like`,
  `ilike`, `null` — each mapped to a parameterized Drizzle helper. Values are
  never string-interpolated into SQL.
- **Scalar coercion** — `string` / `number` / `boolean` / `uuid` / `date` /
  `enum`; the parser coerces raw URL strings to the declared type before they
  hit Drizzle.
- **`FilterException`** (a `BadRequestException`) carries a `FilterErrorCode`
  so controllers translate validation failures to clean HTTP 400s.

The schema is the security boundary: only whitelisted fields/ops/relations
reach SQL, and depth/node caps bound payload blow-up.

Internal files (not exported): `parse-filter-tree.ts`, `tree-to-drizzle.ts`,
`relation-exists.ts`, `scalar-op.ts`, `resolve-leaf.ts`, `table-helpers.ts`,
`filter-exceptions.ts`.

## Commands

- `npx nx typecheck @ortha-cms/utils-server`
- `npx nx test @ortha-cms/utils-server`
