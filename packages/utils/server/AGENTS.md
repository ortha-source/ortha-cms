# @ortha-cms/utils-server

Server-side shared utilities for Ortha CMS. Two concerns:

- the **filter query builder** — translates a REST-style `?filter=` payload into
  a Drizzle SQL fragment that callers splice into their `WHERE` clause (the bulk
  of this document);
- **Postgres error introspection** (`pg-errors.ts`) — `isUniqueViolation` and
  `violatedConstraint`, for mapping a `23505` to a clean HTTP error instead of a 500. `violatedConstraint` returns the offending index's **name** (or `''` when
  the driver didn't supply one, so a caller can still tell "unattributed
  violation" from "not a violation"): a table with several unique indexes needs
  to know _which_ one tripped, because reporting one as the other tells the user
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
  prebuilt against the _physical_ parent table, which is wrong whenever the
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
      whole chain. The naive `EXISTS(… negated …)` asserts the _opposite_
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
- **Values must be scalars.** `string` / `number` / `boolean` are accepted (a
  JSON client legitimately sends any of the three for a URL-shaped API);
  `null`, a missing `value` key, objects and arrays are a
  `FILTER_INVALID_VALUE` 400. They used to be run through `String(v)` and
  *matched against*: `null` → `"null"`, no `value` → `"undefined"`,
  `{}` → `"[object Object]"`, `[]` → `""` → `0` for a number field — a 200 with
  a wrong, usually empty, result set, which is the only silent failure mode a
  library that 400s every other bad value can have. "Is null" is the `null`
  operator, not a `null` value.
- **`FilterException`** (a `BadRequestException`) carries a `FilterErrorCode`
  so controllers translate validation failures to clean HTTP 400s. Its
  `context` is spread **before** the reserved keys, so a context field named
  `code` / `statusCode` / `error` / `message` can never rewrite the envelope the
  class exists to guarantee.
- **`FilterSchemaException`** (an `InternalServerErrorException`, code
  `FILTER_SCHEMA_INVALID`) is the other half: the request was well-formed and
  the whitelist accepted it, but the **schema the caller declared** cannot be
  translated — a `many-to-many` with target `fields` but no `table`, a `fields`
  entry naming a column that is not on the table, a nested `fields` map with no
  matching `relations` entry, a table with no `id` and no explicit key, an
  unrecognised scalar `type` or relation `kind`. Deliberately a **500**: a 400
  would blame the client, hide the fault from alerting, and leave the schema bug
  in place. These four sites used to throw a bare `Error`, which reaches a
  transport as an opaque 500 and, through MCP, an untyped JSON-RPC internal
  error.

The schema is the security boundary: only whitelisted fields/ops/relations
reach SQL, and depth/node caps bound payload blow-up.

**Every lookup of a user-supplied name in a schema map goes through
`own()` (`own-property.ts`), never bare bracket notation.** `fields`,
`relations`, a `RelationSchema`'s nested maps and drizzle's own column map are
all plain object literals, so `map[name]` resolves `constructor`, `toString`,
`valueOf`, `hasOwnProperty` and the rest of `Object.prototype` to truthy values
and a `if (!map[name])` guard accepts a name nobody declared. Both downstream
outcomes were live defects reachable from any filterable endpoint with a
one-word query param: a scalar path handed a `Function` to drizzle as a
`Column` and emitted `$1 = `, a Postgres syntax error — a **user-triggerable
500**; a relation-shaped path (`toString.constructor`) fell out of
`relationExists`'s `switch` as `undefined` and the predicate was **silently
dropped**, answering 200 unfiltered. Both are pinned by
`__test__/own-property-whitelist.spec.ts` and, end-to-end, by
`apps/server-e2e/src/server/users/list-users-filter.spec.ts`.

Internal files (not exported): `parse-filter-tree.ts`, `tree-to-drizzle.ts`,
`relation-exists.ts`, `scalar-op.ts`, `negation.ts`, `resolve-leaf.ts`,
`table-helpers.ts`, `own-property.ts`.

## Commands

- `npx nx typecheck @ortha-cms/utils-server`
- `npx nx test @ortha-cms/utils-server`
