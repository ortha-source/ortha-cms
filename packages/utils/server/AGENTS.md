# @ortha-cms/utils-server

Server-side shared utilities for Ortha CMS. Two concerns:

- the **filter query builder** — translates a REST-style `?filter=` payload into
  a Drizzle SQL fragment that callers splice into their `WHERE` clause (the bulk
  of this document);
- **Postgres error introspection** (`pg-errors.ts`) — `isUniqueViolation` and
  `violatedConstraint`, for mapping a `23505` to a clean HTTP error instead of a
  500. `violatedConstraint` returns the offending index's **name** (or `''` when
  the driver didn't supply one, so a caller can still tell "unattributed
  violation" from "not a violation"): a table with several unique indexes needs
  to know *which* one tripped, because reporting one as the other tells the user
  to fix something that isn't wrong.

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
  `many-to-many` / `self-referential` — discriminate the EXISTS subquery
  shape. `self-referential` aliases the target so the correlation binds to
  the outer row (an unaliased self-join would degrade to "a row that is its
  own parent"). Each `RelationSchema` variant takes an optional `scope`
  (`RelationScope = (target) => SQL | undefined`) ANDed **inside** the
  EXISTS — the host's workspace + soft-delete guard, so a relation filter
  never traverses rows the root query excludes. It is a function, not a
  prebuilt `SQL`, because a self-join must scope the alias, not the physical
  table; when a `scope` is set the many-to-many junction-only fast path
  yields to the full target join.
- **Parent-side columns are re-bound to the queried table.** A relation's
  `fk` (on `many-to-one` / `self-referential`) and any `parentKey` are
  prebuilt against the *physical* parent table, which is wrong whenever the
  parent is an **alias** — i.e. for anything nested under a
  `self-referential` hop. Postgres resolves the unaliased column from the
  outermost `FROM` instead of erroring, so `parent.author.name` would filter
  the ROOT row's author and `parent.parent.name` would collapse to
  `parent.name`. `rebind()` (in `table-helpers.ts`) re-resolves those columns
  against whatever table the translator is querying; it is a no-op on an
  unaliased chain. Never rebind a target-side `fk` (`one-to-many`).
- **Operators** — `eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `in`, `nin`, `like`,
  `ilike`, `nilike`, `null` — each mapped to a parameterized Drizzle helper.
  Values are never string-interpolated into SQL.
- **Negation has two rules, both non-obvious** (`negation.ts`):
    - **On a relation path**, a negating leaf (`ne` / `nin` / `nilike`, and
      `null: true`) is rewritten into `NOT EXISTS(… positive …)` — the
      negation wraps the **outermost** hop, so a multi-hop path negates the
      whole chain. The naive `EXISTS(… negated …)` asserts the *opposite*
      once a relation can hold >1 row: `tags.name nin ['x']` would mean "has
      some tag that isn't x" and match an entry tagged `[x, y]`. It also
      makes `relation.id null:true` ("is empty") a dead filter, since a
      target's `id` is a NOT NULL primary key.
    - **On a plain column**, negative operators are **NULL-inclusive**
      (`col <> v OR col IS NULL`). SQL's three-valued logic would otherwise
      drop NULL rows, and a publishable type keeps its required fields
      nullable — "Title does not contain foo" must not hide untitled drafts.
- **Scalar coercion** — `string` / `number` / `boolean` / `uuid` / `date` /
  `enum`; the parser coerces raw URL strings to the declared type before they
  hit Drizzle.
- **`FilterException`** (a `BadRequestException`) carries a `FilterErrorCode`
  so controllers translate validation failures to clean HTTP 400s.

The schema is the security boundary: only whitelisted fields/ops/relations
reach SQL, and depth/node caps bound payload blow-up.

Internal files (not exported): `parse-filter-tree.ts`, `tree-to-drizzle.ts`,
`relation-exists.ts`, `scalar-op.ts`, `negation.ts`, `resolve-leaf.ts`,
`table-helpers.ts`, `filter-exceptions.ts`.

## Commands

- `npx nx typecheck @ortha-cms/utils-server`
- `npx nx test @ortha-cms/utils-server`
