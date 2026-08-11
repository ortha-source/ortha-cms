# @ortha-cms/utils-server — Test Artifact

> **Unit:** `packages/utils/server` · **Package:** `@ortha-cms/utils-server` · **Kind:** library
> **Source of truth:** `packages/utils/server/AGENTS.md`
> **Generated:** 2026-08-11

## 1. Scope & Preconditions

**Owns.** A pure helper library with no NestJS module, no DI, no routes, no schema. Three
concerns:

1. **The filter query builder** — parse a user-supplied `?filter=<json>` against a
   declared `FilterSchema` (`parse-filter-tree.ts` → `resolve-leaf.ts`), then translate the
   validated tree into a Drizzle `SQL` fragment (`tree-to-drizzle.ts` → `relation-exists.ts`
   → `scalar-op.ts`, with `negation.ts` and `table-helpers.ts`). The schema is the security
   boundary: only whitelisted fields, operators and relations reach SQL.
2. **Pagination parsing** — `clampInt`.
3. **Postgres error introspection** — `isUniqueViolation` / `violatedConstraint`.

**Does NOT own.** The `WHERE` clause — callers `and()` the fragment with their own search
and status predicates ("the engine never owns the full WHERE clause", `AGENTS.md`). Nor
authorization, nor tenancy: a relation's workspace/soft-delete guard arrives as a
caller-supplied `RelationScope` (`types.ts:14`). Nor the extension resolution itself — the
host supplies `resolveExtension`.

**Entry points (`src/index.ts`)**

| Export | Signature | Where |
| --- | --- | --- |
| `parseFilterTree(raw, schema)` | `(unknown, FilterSchema) => ParsedNode \| null` | `src/lib/filters/parse-filter-tree.ts:24` |
| `applyFilterTree(tree, schema, rootTable, db, opts?)` | `=> Promise<SQL \| undefined>` | `src/lib/filters/tree-to-drizzle.ts:42` |
| `clampInt(raw, fallback, min, max)` | `=> number` | `src/lib/clamp-int.ts:7` |
| `isUniqueViolation(error)` | `=> boolean` | `src/lib/pg-errors.ts:16` |
| `violatedConstraint(error)` | `=> string \| undefined` | `src/lib/pg-errors.ts:36` |
| `FilterException` / `FilterErrorCode` | `BadRequestException` subclass + code enum | `src/lib/filters/filter-exceptions.ts:60,4` |
| `FilterOperator`, `ScalarFieldType`, `RelationKind` | const enums | `src/lib/filters/types.ts:17,37,51` |
| `FilterSchema`, `ScalarFieldSchema`, `FieldSchema`, `RelationSchema`, `RelationScope`, `ParsedRule`, `ParsedGroup`, `ParsedNode`, `DbLike`, `TableLike`, `ApplyFilterTreeOptions`, `FilterExtensionResolver` | types | `types.ts`, `table-helpers.ts`, `tree-to-drizzle.ts` |

Internal, deliberately unexported: `resolve-leaf.ts`, `relation-exists.ts`, `scalar-op.ts`,
`negation.ts`, `table-helpers.ts` (`AGENTS.md`, "Internal files").

**No routes, no env vars, no feature flags.** The library is exercised only through its
consumers' endpoints.

**Runtime prerequisites (to exercise it end-to-end).** Postgres up
(`docker compose up -d`), migrations applied, `npm run dev`, and a signed-in `admin`
session — the three live consumers are:

- `GET /api/users?filter=<json>` (`apps/server-e2e/src/server/users/list-users-filter.spec.ts`)
- `GET /api/activity?filter=<json>` (`apps/server-e2e/src/server/activity/activity-filter.spec.ts`)
- `GET /api/content/<type>?filter=<json>` and its public/GraphQL twins
  (`apps/server-e2e/src/server/content/list-entries-relation-filter.spec.ts`)

**How to exercise it manually**

```bash
docker compose up -d && npx nx run server:db:migrate && npm run dev
COOKIE='ortha_session=<paste from devtools>'

# scalar rule
curl -s -H "$COOKIE" --get localhost:3000/api/users \
  --data-urlencode 'filter={"field":"email","op":"ilike","value":"%ada%"}'

# relation rule (EXISTS subquery)
curl -s -H "$COOKIE" --get localhost:3000/api/users \
  --data-urlencode 'filter={"field":"role.key","op":"eq","value":"admin"}'

# OR group
curl -s -H "$COOKIE" --get localhost:3000/api/users \
  --data-urlencode 'filter={"or":[{"field":"status","op":"eq","value":"active"},{"field":"email","op":"ilike","value":"%b%"}]}'

# rejected: out of schema
curl -si -H "$COOKIE" --get localhost:3000/api/users \
  --data-urlencode 'filter={"field":"passwordHash","op":"eq","value":"x"}' | head -1

# unit suites
npx nx test @ortha-cms/utils-server
```

**Dependencies.** `drizzle-orm` ^0.45 (`eq`/`and`/`or`/`not`/`exists`/`inArray`/`ilike`… and
`getTableColumns`, `alias`), `@nestjs/common` (only for `BadRequestException`).

## 2. Feature Inventory

| # | Feature | Where it lives | Coverage |
| --- | --- | --- | --- |
| F1 | `parseFilterTree` accepts a JSON **string** and parses it | `parse-filter-tree.ts:31-43` | 🧪 UNIT · ✅ E2E |
| F2 | `parseFilterTree` accepts an already-parsed **object** | `parse-filter-tree.ts:45-53` | 🧪 UNIT |
| F3 | Returns `null` for missing / empty-string / `{}` input | `parse-filter-tree.ts:28,33,53` | 🧪 UNIT · ✅ E2E |
| F4 | Rejects a non-object (string-after-parse, array, primitive) with `InvalidShape` | `parse-filter-tree.ts:45-50` | 🧪 UNIT |
| F5 | Parses `and` / `or` groups, rejecting a node declaring both | `parse-filter-tree.ts:95-131` | 🧪 UNIT · ✅ E2E |
| F6 | Rejects a non-array or empty `and`/`or` payload | `parse-filter-tree.ts:115-126` | 🧪 UNIT |
| F7 | Parses a leaf rule (`field` + `op` + `value`), rejecting a missing/empty `field` or `op` | `parse-filter-tree.ts:134-158` | 🧪 UNIT |
| F8 | Caps total node count (`maxNodes`, default 50) | `parse-filter-tree.ts:85-92` | 🧪 UNIT · ✅ E2E |
| F9 | Caps group nesting depth (`maxGroupDepth`, default 5) | `parse-filter-tree.ts:106-112` | 🧪 UNIT · ✅ E2E |
| F10 | Caps dotted-path depth (`maxDepth`, default 3) | `resolve-leaf.ts:30-36` | 🧪 UNIT |
| F11 | Rejects an operator outside the vocabulary | `resolve-leaf.ts:37-43` | 🧪 UNIT · ✅ E2E |
| F12 | Whitelists the leaf field against `schema.fields` | `resolve-leaf.ts:51-59` | 🧪 UNIT · ✅ E2E |
| F13 | Whitelists each mid-path segment against `schema.relations` | `resolve-leaf.ts:72-79` | 🧪 UNIT |
| F14 | Coerces `string` / `number` / `boolean` / `uuid` / `date` / `enum` | `resolve-leaf.ts:138-203` | 🧪 UNIT · ✅ E2E |
| F15 | `null` operator accepts only `true`/`false` (string or boolean) | `resolve-leaf.ts:98-106` | 🧪 UNIT |
| F16 | `in`/`nin` accepts an array or a comma-separated string | `resolve-leaf.ts:107-112` | 🧪 UNIT · ✅ E2E |
| F17 | Rejects an **empty** `in`/`nin` list (would silently match none / all) | `resolve-leaf.ts:117-123` | 🧪 UNIT · ✅ E2E |
| F18 | Caps `in`/`nin` list length (`maxInListLength`, default 100) | `resolve-leaf.ts:126-132` | 🧪 UNIT · ✅ E2E |
| F19 | UUIDs must be canonical 8-4-4-4-12 | `resolve-leaf.ts:8-9,166-177` | 🧪 UNIT |
| F20 | `applyFilterTree` returns `undefined` for a null/empty tree | `tree-to-drizzle.ts:49,69` | 🧪 UNIT |
| F21 | Groups emit `and(...)` / `or(...)`; a single-child group flattens to the child | `tree-to-drizzle.ts:64-71` | 🧪 UNIT |
| F22 | A one-segment rule becomes a scalar predicate on the root table | `tree-to-drizzle.ts:92-94` | 🧪 UNIT · ✅ E2E |
| F23 | Extension fields route through `resolveExtension`, and throw when none is supplied | `tree-to-drizzle.ts:82-91` | 🧪 UNIT |
| F24 | A negating rule on a **relation** path becomes `NOT EXISTS(… positive …)` | `tree-to-drizzle.ts:111-113`, `negation.ts:9-57` | 🧪 UNIT · ✅ E2E |
| F25 | Negative scalar operators are NULL-inclusive (`col <> v OR col IS NULL`) | `scalar-op.ts:32-34,55,67,73` | 🧪 UNIT |
| F26 | `one-to-one` / `one-to-many` EXISTS (target FK → parent key) | `relation-exists.ts:47-62` | 🧪 UNIT · ✅ E2E |
| F27 | `many-to-one` EXISTS (parent FK → target key) | `relation-exists.ts:63-76` | 🧪 UNIT · ✅ E2E |
| F28 | `self-referential` EXISTS aliases the target so the correlation binds outward | `relation-exists.ts:77-95` | 🧪 UNIT |
| F29 | `many-to-many` junction-only fast path when filtering on the target `id` with no scope | `relation-exists.ts:106-120` | 🧪 UNIT |
| F30 | `many-to-many` full join to the target when filtering a target field or when a scope exists | `relation-exists.ts:121-139` | 🧪 UNIT · ✅ E2E |
| F31 | A relation's `scope` is ANDed **inside** every EXISTS shape | `relation-exists.ts:53,67,86,136` | 🧪 UNIT |
| F32 | Parent-side columns are `rebind`-ed to the queried (possibly aliased) table | `table-helpers.ts:67-74`, `relation-exists.ts:48-49,66,86,97-99` | 🧪 UNIT |
| F33 | Multi-hop descent through nested relations | `relation-exists.ts:149-166` | 🧪 UNIT · ✅ E2E |
| F34 | `FilterException` carries a machine-readable `code` + `context` on a 400 body | `filter-exceptions.ts:60-81` | ✅ E2E |
| F35 | `clampInt` parses, truncates and clamps a query-string integer | `clamp-int.ts:7-16` | 🧪 UNIT |
| F36 | `violatedConstraint` returns the tripped index name, `''` when unattributed, `undefined` otherwise, walking `cause` ≤5 deep | `pg-errors.ts:36-52` | 🧪 UNIT |
| F37 | `isUniqueViolation` is `violatedConstraint(...) !== undefined` | `pg-errors.ts:16-18` | 🧪 UNIT |

## 3. Manual Test Plan

Every block below is executable against `GET /api/users` with an `admin` session cookie
unless stated. Set `COOKIE='ortha_session=…'` first. `--data-urlencode` is required —
the JSON contains characters the shell and URL both mangle.

### F1 / F2 / F3 — Input shapes

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `--data-urlencode 'filter={"field":"email","op":"eq","value":"a@b.c"}'` | `200`, filtered list |
| 2 | Omit `filter` entirely | `200`, unfiltered list (parser returned `null`) |
| 3 | `--data-urlencode 'filter='` (empty) | `200`, unfiltered — `trimmed.length === 0` → `null` |
| 4 | `--data-urlencode 'filter=   '` (whitespace) | `200`, unfiltered |
| 5 | `--data-urlencode 'filter={}'` | `200`, unfiltered — `Object.keys(obj).length === 0` → `null` |
| 6 | `--data-urlencode 'filter={"email":'` (truncated JSON) | `400`, body `code: "FILTER_INVALID_JSON"`, and a `reason` field carrying the raw `JSON.parse` message |

### F4 — Non-object payloads

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `filter=[{"field":"email","op":"eq","value":"x"}]` (array) | `400`, `code: "FILTER_INVALID_SHAPE"`, message `filter: expected object` |
| 2 | `filter="hello"` (JSON string) | `400`, same code |
| 3 | `filter=42` | `400`, same code |
| 4 | `filter=null` | `200`, unfiltered — `null` short-circuits at `parse-filter-tree.ts:28` |

### F5 / F6 — Groups

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `{"or":[{"field":"status","op":"eq","value":"active"},{"field":"email","op":"ilike","value":"%b%"}]}` | `200`; the result is the **union** of both |
| 2 | Same with `"and"` | `200`; the intersection |
| 3 | `{"and":[…],"or":[…]}` | `400`, `code: "FILTER_INVALID_NODE"`, message `group node must declare exactly one of \`and\` or \`or\`` |
| 4 | `{"and":"nope"}` | `400`, `` `and` must be an array of nodes `` |
| 5 | `{"and":[]}` | `400`, `` `and` group must contain at least one child `` |
| 6 | `{"and":[{"and":[{"field":"email","op":"eq","value":"x"}]}]}` | `200` — a single-child group flattens to its child (`tree-to-drizzle.ts:70`) |

### F7 — Leaf shape

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `{"field":"email","op":"eq"}` (no `value`) | `200` — `value` is `undefined`, coerced by `String(undefined)` to the literal `"undefined"` for a string field. See EC-14 |
| 2 | `{"field":"","op":"eq","value":"x"}` | `400`, `` rule `field` must be a non-empty string `` |
| 3 | `{"field":"email","op":"","value":"x"}` | `400`, `` rule `op` must be a non-empty string `` |
| 4 | `{"field":123,"op":"eq","value":"x"}` | `400`, same field message |
| 5 | `{"foo":"bar"}` | `400`, `` tree node must have `and`, `or`, or (`field` + `op`) `` |

### F8 / F9 / F10 — Caps

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | An `and` group with 51 rules | `400`, `code: "FILTER_MAX_NODES_EXCEEDED"`, `maxNodes: 50` in the body |
| 2 | An `and` group with 48 rules | `200` |
| 3 | Six levels of nested `and` groups | `400`, `code: "FILTER_GROUP_DEPTH_EXCEEDED"`, `maxGroupDepth: 5` |
| 4 | `{"field":"a.b.c.d","op":"eq","value":"x"}` | `400`, `code: "FILTER_DEPTH_EXCEEDED"`, body carries `path` and `maxDepth` |

### F11 / F12 / F13 — Whitelists (the security boundary)

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `{"field":"passwordHash","op":"eq","value":"x"}` | `400`, `code: "FILTER_UNKNOWN_FIELD"`, `path: "passwordHash"` — **never** a 200 with a widened result |
| 2 | `{"field":"email","op":"regex","value":"x"}` | `400`, `code: "FILTER_UNKNOWN_OPERATOR"`, `op: "regex"` |
| 3 | `{"field":"sessions.token","op":"eq","value":"x"}` (undeclared relation) | `400`, `code: "FILTER_UNKNOWN_RELATION"`, body carries `segment` and `path` |
| 4 | `{"field":"role.key","op":"eq","value":"admin"}` (declared relation) | `200`, admins only |
| 5 | `{"field":"role.secretColumn","op":"eq","value":"x"}` | `400`, `FILTER_UNKNOWN_FIELD` — the nested `fields` map is checked, not the physical table |

### F14 / F19 — Coercion

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | number field, `"value":"12"` | `200`; the SQL parameter is the number `12` |
| 2 | number field, `"value":"abc"` | `400`, `code: "FILTER_INVALID_VALUE"`, `expectedType: "number"` |
| 3 | number field, `"value":"Infinity"` | `400` — `Number.isFinite` guard (`resolve-leaf.ts:149`) |
| 4 | boolean field, `"value":"true"` / `"value":true` | `200` for both |
| 5 | boolean field, `"value":"1"` | `400`, `expectedType: "boolean"` |
| 6 | uuid field, a canonical uuid | `200` |
| 7 | uuid field, 36 dashes | `400`, `expectedType: "uuid"` — **not** a 500 from a failed Postgres cast |
| 8 | uuid field, a valid uuid in upper case | `200` — the regex is `/i` |
| 9 | date field, `"2024-01-01T00:00:00Z"` | `200` |
| 10 | date field, `"not-a-date"` | `400`, `expectedType: "date"` |
| 11 | enum field, a declared value | `200` |
| 12 | enum field, an undeclared value | `400`, `expectedType: "enum"`, body lists `allowed` |

### F15 / F16 / F17 / F18 — `null`, `in`, `nin`

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `{"field":"name","op":"null","value":true}` | `200`; rows whose `name` is NULL |
| 2 | `{"field":"name","op":"null","value":"true"}` | Identical (`resolve-leaf.ts:99`) |
| 3 | `{"field":"name","op":"null","value":"yes"}` | `400`, `null filter accepts only true\|false` |
| 4 | `{"field":"status","op":"in","value":["active","disabled"]}` | `200`; union |
| 5 | `{"field":"status","op":"in","value":"active,disabled"}` | Identical — comma-split (`resolve-leaf.ts:110`) |
| 6 | `{"field":"status","op":"in","value":[]}` | `400`, `code: "FILTER_EMPTY_IN_LIST"` — never a silent match-none |
| 7 | `{"field":"status","op":"nin","value":[]}` | `400`, same code — never a silent match-all |
| 8 | `in` with 101 values | `400`, `code: "FILTER_MAX_IN_LIST_EXCEEDED"`, body carries `length` and `maxInListLength` |
| 9 | `in` with 100 values | `200` |

### F20 / F21 / F22 / F23 — Translation

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | No filter | The endpoint's own predicates only; no extra `WHERE` term |
| 2 | Enable Postgres statement logging and issue an `or` of two rules | The emitted SQL contains one `OR` and two parameters — values are **bound**, never interpolated |
| 3 | `{"field":"role","op":"eq","value":"admin"}` where `role` is in `extensionFields` | `200`; the host's `resolveExtension` subquery appears in the plan |
| 4 | Same, on an endpoint whose caller passes no `resolveExtension` | `400`, `extension field "role" referenced but no resolver provided` |

### F24 / F25 — Negation (the two non-obvious rules)

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | On content: `{"field":"tags.name","op":"nin","value":["x"]}` on an entry tagged `[x, y]` | The entry is **excluded**. `NOT EXISTS(tag WHERE name IN ('x'))` — not `EXISTS(tag WHERE name <> 'x')`, which would wrongly include it |
| 2 | `{"field":"author.id","op":"null","value":true}` | Entries with **no author**. Rewritten to `NOT EXISTS(author WHERE id IS NOT NULL)` |
| 3 | `{"field":"author.id","op":"null","value":false}` | Entries **with** an author — a plain `EXISTS`, not negated (`negation.ts:16`) |
| 4 | `{"field":"title","op":"ne","value":"Hello"}` on a row whose `title` is NULL | The row **is returned** — `col <> 'Hello' OR col IS NULL` (`scalar-op.ts:33`) |
| 5 | `{"field":"title","op":"nilike","value":"%foo%"}` on a NULL title | Returned, same reason |
| 6 | A negated rule inside a scoped relation | The scope predicate stays **inside** the negated subquery, so the negation cannot escape the workspace boundary |

### F26–F33 — Relation shapes

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `many-to-one`: `{"field":"author.name","op":"eq","value":"Ada"}` | `EXISTS (SELECT 1 FROM author WHERE author.id = entry.author_id AND …)` |
| 2 | `one-to-many`: `{"field":"comments.body","op":"ilike","value":"%x%"}` | `EXISTS (SELECT 1 FROM comment WHERE comment.entry_id = entry.id AND …)` |
| 3 | `many-to-many` on the target **id** with no scope | `EXISTS (SELECT 1 FROM join_table WHERE …)` — the target table is **not** joined |
| 4 | Same relation with a `scope` declared | The junction fast path is abandoned; the target table is inner-joined so the scope can apply (`relation-exists.ts:100-107`) |
| 5 | `self-referential`: `{"field":"parent.name","op":"eq","value":"X"}` | The subquery reads `FROM t AS <alias>`; results are rows whose **parent** is named X, not rows that are their own parent |
| 6 | Nested under a self-hop: `{"field":"parent.author.name","op":"eq","value":"Ada"}` | Filters the **parent's** author, not the root row's (`rebind`, `table-helpers.ts:67-74`) |
| 7 | A relation filter whose target row is soft-deleted or in another workspace | Excluded — the `scope` is ANDed inside the EXISTS |

### F34 — Error envelope

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Any rejected filter | `400` with `{ statusCode: 400, error: "Bad Request", code: "FILTER_…", message: "filter: …", …context }` |
| 2 | Client branches on `body.code` | Every code is a member of `FilterErrorCode` (`filter-exceptions.ts:4-35`) |

### F35 — `clampInt`

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `clampInt(undefined, 25, 1, 100)` | `25` |
| 2 | `clampInt('abc', 25, 1, 100)` | `25` |
| 3 | `clampInt('7.9', 25, 1, 100)` | `7` (truncated) |
| 4 | `clampInt('1000', 25, 1, 100)` | `100` |
| 5 | `clampInt('-5', 25, 1, 100)` | `1` |
| 6 | `clampInt('', 25, 1, 100)` | **`1`**, not `25` — `Number('')` is `0`, which is finite. Asserted as intended at `src/lib/__test__/clamp-int.spec.ts:21` |

### F36 / F37 — `pg-errors`

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `violatedConstraint({ code: '23505', constraint: 'users_email_key' })` | `'users_email_key'` |
| 2 | Same error wrapped in `{ cause: { cause: <it> } }` | Still `'users_email_key'` |
| 3 | `{ code: '23505' }` with no `constraint` | `''` — "a violation, unattributed" |
| 4 | `{ code: '23503' }` (FK violation) | `undefined` |
| 5 | `null`, `undefined`, `'string'`, `new Error('x')` | `undefined` for each |
| 6 | A self-referential `cause` cycle | `undefined` after 5 hops — the loop is bounded (`pg-errors.ts:38`) |
| 7 | `isUniqueViolation` on cases 1-3 / 4-6 | `true` / `false` |

## 4. Edge Cases & Negative Paths

**Empty / zero / absent**

- **EC-01 — `filter` absent, `''`, `'   '`, `'{}'`, `null`.** `🧪 UNIT` All return `null`
  → no `WHERE` term (`parse-filter-tree.ts:28,33,53`; `parse-filter-tree.spec.ts:34,39,162`).
  ✅ E2E at `list-users-filter.spec.ts:223`.
- **EC-02 — `applyFilterTree` given a group whose children all resolve to `undefined`.**
  `🧪 UNIT` Returns `undefined`, not an empty `and()` (`tree-to-drizzle.ts:69`;
  `tree-to-drizzle.spec.ts:110`). Correct — an empty `and()` in drizzle would be a no-op
  that still forces a clause.
- **EC-03 — Empty `in`/`nin`.** `🧪 UNIT · ✅ E2E` Rejected rather than translated, because
  drizzle emits `false`/`true` for them (`resolve-leaf.ts:113-123`;
  `list-users-filter.spec.ts:186`). This is the single most important edge case in the
  library and it is correctly handled: a silent "matches everything" on a `nin` would be a
  tenant-scoping bypass in a caller that relies on the filter to narrow.
- **EC-04 — Empty string as a scalar value.** `❌ NONE` `{"field":"email","op":"eq","value":""}`
  is accepted for a `string` field and emits `email = ''`. Reasonable, but note it differs
  from "absent".

**Boundary**

- **EC-05 — Exactly `maxNodes` / `maxNodes + 1`.** `🧪 UNIT` `parse-filter-tree.spec.ts:252`
  covers the reject. The at-limit case is covered for `in` lists
  (`:317`) but **not** for node count.
- **EC-06 — Exactly `maxGroupDepth`.** `🧪 UNIT` The check is `depth >= maxGroupDepth`
  (`parse-filter-tree.ts:106`) counting from 0 at the root, so five *nested* groups are the
  maximum and the sixth rejects. Reject covered at `:269`; the at-limit case is not.
- **EC-07 — Exactly `maxDepth` path segments.** `🧪 UNIT` `path.length > maxDepth`
  (`resolve-leaf.ts:30`) — so `a.b.c` passes at the default 3, `a.b.c.d` rejects.
- **EC-08 — `maxNodes: 0` in a schema.** `❌ NONE` The first `walkNode` increments to 1 and
  rejects, so a schema that sets `0` makes **every** filter a 400. No validation of the
  schema's own caps.
- **EC-09 — Combined worst case.** `❌ NONE` 50 nodes × 100 `in` values = 5 000 bound
  parameters, each node potentially a 3-deep nest of `EXISTS` subqueries. The caps bound
  each dimension independently but not their product; there is no cost model.

**Size & encoding**

- **EC-10 — Very long string value.** `❌ NONE` No length cap on a scalar value; a 1 MB
  `ilike` pattern is accepted and sent to Postgres.
- **EC-11 — Unicode / emoji / RTL in a value.** `❌ NONE` Passed through unchanged as a bound
  parameter — correct. Not asserted.
- **EC-12 — `%` / `_` in a `like`/`ilike` value.** `❌ NONE` Not escaped
  (`scalar-op.ts:68-73`). A value of `%` matches everything, and `\` has no defined
  meaning. Arguably intended for a wildcard operator, but it is undocumented and means
  "contains a literal percent sign" is inexpressible. Callers that wrap the value as
  `%${v}%` inherit the same gap.
- **EC-13 — Leading-wildcard `ilike`.** `❌ NONE` `%foo%` cannot use a b-tree index; on a
  large table this is a sequential scan a caller can trigger at will. Perf, not correctness.
- **EC-14 — Non-string value coerced with `String(v)`.** `❌ NONE`
  `scalarOf` does `typeof v === 'string' ? v : String(v)` (`resolve-leaf.ts:143`), so for a
  `string` field: `null` → `"null"`, `undefined` → `"undefined"`, `{}` → `"[object Object]"`,
  `[1,2]` → `"1,2"`. These are silently *matched against* rather than rejected. A JSON client
  sending `"value": null` intending "is null" gets a search for the literal text `null`.
- **EC-15 — SQL-ish input.** `🧪 UNIT (by construction)` Every value reaches drizzle as a
  bound parameter (`scalar-op.ts`), and every column reaches it as a resolved `Column`
  object via `columnOf` (`table-helpers.ts:37-43`) — never as a string. There is no string
  concatenation into SQL anywhere in the package. Injection is structurally prevented, not
  filtered.
- **EC-16 — Path-traversal-shaped field name.** `❌ NONE` `"field":"../../x"` splits on `.`
  into `['','','/','/x']`-ish segments and fails the whitelist → `FILTER_UNKNOWN_RELATION`.
  Safe by whitelist.
- **EC-17 — 10 MB `filter` payload.** `❌ NONE` `JSON.parse` runs on the whole string before
  any cap applies (`parse-filter-tree.ts:38`), so the node/depth caps do not bound parse
  cost or memory. The only real bound is express's body/URL limit, which is a different
  layer's concern.
- **EC-18 — Deeply nested JSON below the group cap.** `❌ NONE` A 10 000-deep nesting of
  non-group objects is rejected at the first `walkNode` (no `and`/`or`/`field`), but only
  after `JSON.parse` has already built the whole structure — same as EC-17.

**Permission matrix & tenant isolation**

- **EC-19 — Filtering a field the caller may not read.** `🧪 UNIT · ✅ E2E` The `FilterSchema`
  is the whitelist, so a field not in `fields` is a 400 regardless of role
  (`list-users-filter.spec.ts:153`). Note the **library has no role concept at all** — a
  caller that declares a privileged field in `fields` exposes it to every role that can
  reach the endpoint. The boundary is the schema the caller writes, not this code.
- **EC-20 — Cross-tenant traversal through a relation.** `⚠️ PARTIAL` Prevented only if the
  caller supplies a `scope`. `relation-scope.spec.ts:70,91,115,136` proves the scope is
  applied in all four shapes and that the m2m fast path yields to it — the correct design.
  But a caller that **forgets** `scope` gets a filter that traverses foreign and
  soft-deleted rows with no warning; `scope` is optional in every `RelationSchema` variant
  (`types.ts:94,108,132,155`). 🔒 by omission.
- **EC-21 — Enumeration through error messages.** `❌ NONE` `FILTER_UNKNOWN_FIELD` names the
  path and `FILTER_INVALID_VALUE` reports the expected type, so a caller can map the exact
  filterable surface of an endpoint. Since that surface is a declared public contract this
  is acceptable — but it does differ from the "keep responses uniform" rule in
  `.cursor/BUGBOT.md`, and `FILTER_INVALID_VALUE` echoes the submitted `value` back
  (`resolve-leaf.ts:154,164,174,185,196`), which will appear in logs.

**Failure & partiality**

- **EC-22 — Schema declares `many-to-many` `fields` but no `table`.** `❌ NONE` The parser
  accepts a target-field path (it only checks `rel.fields`), then the translator throws a
  bare `Error` (`relation-exists.ts:121-125`) → **500** on a well-formed user request.
  → `🐞 BUG-utils-server-01`.
- **EC-23 — Schema declares a `fields` entry whose column does not exist.** `❌ NONE`
  `columnOf` throws `Error('column "x" not on table')` (`table-helpers.ts:41`) → 500,
  user-triggerable, no `FilterException`.
- **EC-24 — Schema declares nested `fields` but no matching `relations` entry.** `❌ NONE`
  `descend` throws `Error('nested relation missing: …')` (`relation-exists.ts:159`) → 500.
- **EC-25 — Table with no `id` and no explicit key.** `❌ NONE` `primaryKey` throws a bare
  `Error` (`table-helpers.ts:85-87`) → 500.
- **EC-26 — A `resolveExtension` that rejects.** `❌ NONE` The rejection propagates out of
  `applyFilterTree` unwrapped; whether it becomes a 400 or a 500 depends entirely on what
  the host threw (`tree-to-drizzle.ts:90`).
- **EC-27 — Async extension latency.** `❌ NONE` Documented: resolvers are awaited
  sequentially and "latency adds linearly per leaf" (`tree-to-drizzle.ts:17-20`). With
  `maxNodes` 50 that is up to 50 serial round trips in one request.
- **EC-28 — `rebind` name collision.** `⚠️ PARTIAL` `rebind` matches by DB column name and
  returns the first match (`table-helpers.ts:70-72`), which is why the JSDoc says "Only ever
  call this for columns that live on the parent **by construction**". Nothing enforces that
  — it is a comment-level invariant on an internal function.
- **EC-29 — Self-referential `alias` reused across two rules.** `🧪 UNIT` `types.ts:144-147`
  says the alias "Must be unique per **occurrence** in the filter tree, not per relation".
  The schema is a **tree** — each nested hop is its own `RelationSchema` object — so the
  requirement *is* expressible, and the only real producer honours it: `entry-filter-surface.ts:284`
  derives the alias from the path (`qb_${nextPath.join('__')}`), pinned by
  `entry-filter-surface.spec.ts:159-177` (`qb_parent` vs `qb_parent__parent`). A hand-written
  schema that reuses one alias at two nesting levels would shadow the correlation name, but
  nothing in the repo does, and two *sibling* subqueries sharing a name are legal SQL in
  separate scopes. **No defect — this package leaves alias uniqueness to the schema author
  and the one author gets it right.**
- **EC-30 — Extension field name colliding with a relation name.** `❌ NONE`
  `translateRule` checks `extensionFields` on `path[0]` **before** the length check
  (`tree-to-drizzle.ts:82`), so if both a relation and an extension field are named `role`,
  the extension silently wins for `role.key` too and receives the multi-segment path.

**Idempotency & determinism**

- **EC-31 — Same filter parsed twice.** `❌ NONE` `parseFilterTree` is pure; `resolveLeaf`
  returns a fresh object each call. No shared mutable state anywhere — verified by reading:
  the only module-level values are `OPS` and the regex (`resolve-leaf.ts:5,8`), both frozen
  by use.
- **EC-32 — `positiveLeaf` on a non-negating leaf.** `🧪 UNIT` Returns the leaf unchanged
  (`negation.ts:55-56`); `negation.spec.ts:217,235` asserts no double-negation.

### 4A. Accessibility & Section 508 Conformance

`@ortha-cms/utils-server` is a pure library: a filter parser/translator, `clampInt`, and two
Postgres error predicates. It has no module, no route, no schema, no string shown to a user,
and no markup (`src/index.ts`). Every WCAG 2.1 AA success criterion, and Chapter 5's
502.2/502.3 and 503.4, are **Not Applicable** on that basis alone — enumerating them
individually would be padding, so they are dismissed as a class here.

Two questions are worth asking anyway, because they are the ones a 508 audit of a CMS
actually asks of a data-shaping layer, and both resolve to Not Applicable for a concrete
reason rather than by default:

| 508 question | Verdict | Justification |
| --- | --- | --- |
| 504.2 / 504.2.1 — can the layer carry, and preserve, alt text, a table caption or a language marker? | **Not Applicable** | It carries **no content at all**. It reads a `FilterSchema` and emits a Drizzle `SQL` fragment; it never stores, copies or transforms a content value. The one place a user string passes through is a filter *predicate* value (`resolve-leaf.ts:138-146`), which is bound as a parameter and discarded. There is nothing here for accessibility metadata to be lost in. |
| Does it make accessibility metadata **queryable**? | **Not Applicable — but note the enabling half** | A schema author can whitelist any column, including a media `alt` (`packages/media/server/src/lib/infrastructure/schema/media-asset.ts:62`) or an entry `locale` (`packages/content/server/src/lib/collection/table-builder.ts:204`), so nothing in this library prevents "find every image with no alt text". Whether such a filter surface is actually exposed is `content-server`'s and `media-server`'s decision, not this package's. |
| 504.3 — does it prompt for accessibility information? | **Not Applicable** | No UI, no authoring path. |
| 504.4 — do shipped templates default to conformant output? | **Not Applicable** | Ships no template. |

**No accessibility findings.** Specifically checked and cleared: the package exports no
user-visible message except `FilterException`'s `filter: <message>` body
(`filter-exceptions.ts:75`), which is a machine-readable API error consumed by
`query-builder-admin` and rendered there — so 3.3.1 Error Identification is assessed in
`docs/testing/query-builder-admin.md`, not here. `clampInt` and the `pg-errors` helpers
touch nothing perceivable.

**♿ tally:** `0 findings — 0 Supports · 0 Partially Supports · 0 Does Not Support · 6 Not Applicable`

## 5. E2E Coverage Map

This unit is unusual: it carries the repo's **best** unit-test coverage (5 spec files, 1 294
lines, `packages/utils/server/src/lib/**/__test__/`) and is additionally exercised through
three consumers' e2e suites.

| Feature | Spec | Asserts | Verdict |
| --- | --- | --- | --- |
| F1/F3 input shapes | `src/lib/filters/__test__/parse-filter-tree.spec.ts:34,39,46,162` | Missing / empty-string / `{}` → `null`; JSON string parsed | 🧪 UNIT ✅ |
| F1/F3 (live) | `apps/server-e2e/src/server/users/list-users-filter.spec.ts:171,223` | Malformed JSON → 400; empty filter → all rows | ✅ E2E |
| F5/F6 groups | `parse-filter-tree.spec.ts:87,101,114,166,191,197` | AND/OR/nested; bracket-shaped legacy payload, both-`and`-and-`or`, non-array all rejected | 🧪 UNIT ✅ |
| F5 (live) | `list-users-filter.spec.ts:97`, `apps/server-e2e/src/server/activity/activity-filter.spec.ts` | OR group returns the union against real rows | ✅ E2E |
| F7 leaf shape | `parse-filter-tree.spec.ts:203,212` | Missing / empty `field` rejected inside a group | 🧪 UNIT ✅ |
| F8/F9 caps | `parse-filter-tree.spec.ts:252,269`; `list-users-filter.spec.ts:179` | Node cap and group-depth cap reject | 🧪 UNIT ✅ / ✅ E2E — ⚠️ neither asserts the **at-limit** case passes |
| F10 path depth | — | — | ⚠️ PARTIAL — `maxDepth` is exercised implicitly by the relation specs, never asserted at its boundary |
| F11/F12/F13 whitelists | `parse-filter-tree.spec.ts:220,226`; `list-users-filter.spec.ts:153,162` | Unknown field and unknown operator → 400 both in unit and against the live endpoint | 🧪 UNIT ✅ · ✅ E2E |
| F14/F19 coercion | `parse-filter-tree.spec.ts:148,232,240` | Number coercion; canonical uuid accepted; non-canonical uuid rejected as `InvalidValue` rather than reaching Postgres | 🧪 UNIT ✅ — ⚠️ boolean, date and enum coercion have **no** direct test |
| F16/F17/F18 `in`/`nin` | `parse-filter-tree.spec.ts:280,288,295,317`; `list-users-filter.spec.ts:186,209` | Empty `in` and empty `nin` rejected; list cap rejected; at-cap accepted | 🧪 UNIT ✅ · ✅ E2E — the strongest-covered behaviour in the package |
| F15 `null` operator | — | — | ❌ NONE — no test asserts `{"op":"null","value":"yes"}` is a 400 |
| F20/F21 translation | `src/lib/filters/__test__/tree-to-drizzle.spec.ts:41,62,78,93,110,121` | `undefined` for null input; `and`/`or` composition; single-child flatten; empty group → `undefined`; nested AND-of-ORs | 🧪 UNIT ✅ |
| F23 extension hook | `tree-to-drizzle.spec.ts:163,188,211` | Routed through `resolveExtension`, composed inside AND and OR, throws with no resolver | 🧪 UNIT ✅ |
| F24 relation negation | `src/lib/filters/__test__/negation.spec.ts:114,128,139,149,162,172,184,226,235,246` | All four rewrites, the "is empty" case, scope retention inside the negation, no double-negation, and coercion preserved | 🧪 UNIT ✅ — exemplary |
| F24 (live) | `apps/server-e2e/src/server/content/list-entries-relation-filter.spec.ts` | Relation filters and their negations against real rows | ✅ E2E |
| F25 NULL-inclusive scalars | `negation.spec.ts:195,201,209,217` | `ne`/`nin`/`nilike` each also match NULL; positives untouched | 🧪 UNIT ✅ |
| F26–F30 relation shapes | `src/lib/filters/__test__/relation-scope.spec.ts:70,91,115,136` | `many-to-one` EXISTS scoping; self-join aliasing; m2m fast path **yields** to a scope; m2m fast path kept without one | 🧪 UNIT ✅ — the security-critical m2m case is covered |
| F31/F32 scope + rebind | `src/lib/filters/__test__/relation-nesting.spec.ts:82,109,131,156,183,207` | Nested `many-to-one`/self/`one-to-many`/m2m parent keys all bind to the alias; scope lands on the nested target; unaliased chains unaffected | 🧪 UNIT ✅ — exemplary |
| F33 multi-hop | `relation-nesting.spec.ts` + `list-entries-relation-filter.spec.ts` | Descent through nested relations | 🧪 UNIT · ✅ E2E |
| F34 error envelope | `list-users-filter.spec.ts:153,162,171,179,186,209` | Each rejection is a 400 (status only) | ⚠️ PARTIAL — no e2e asserts the `code` field, which is the whole point of `FilterException` |
| F35 `clampInt` | `src/lib/__test__/clamp-int.spec.ts:4,9,14,21` | Fallback, truncation, clamping, and the empty-string→`min` quirk pinned deliberately | 🧪 UNIT ✅ |
| F36/F37 `pg-errors` | `src/lib/pg-errors.spec.ts:11,23,36,42,48,54,64,69` | Named constraint, `cause` chain, unattributed `''`, other codes, non-errors, and a **cycle-safe** walk | 🧪 UNIT ✅ — exemplary |
| F2, F4, F22 | — | Object input, `InvalidShape` rejections, root scalar translation | ⚠️ PARTIAL — covered incidentally by other assertions, never directly |

**Coverage tally:** `37 features · 12 ✅ · 6 ⚠️ · 1 ❌ · 30 🧪`
(features frequently carry both a unit and an e2e marker; ❌ is `F15`.)

## 6. 🐞 Potential Bugs

### 🐞 BUG-utils-server-01 — A parser-accepted filter can reach a bare `Error` in the translator and become a 500 instead of a 400 · Severity: Medium

**Location:** `packages/utils/server/src/lib/filters/relation-exists.ts:121-125,159` and `packages/utils/server/src/lib/filters/table-helpers.ts:41,85-87`
**Category:** correctness

**What the code does:** four throw sites in the translation layer use a bare `Error`, not a
`FilterException`:

```ts
// relation-exists.ts:121-125 — many-to-many with a target-field path
if (!rel.table) {
    throw new Error('many-to-many filter on target field requires `table`');
}
// relation-exists.ts:159
if (!next) throw new Error(`nested relation missing: ${f.path[0]}`);
// table-helpers.ts:41
if (!col) throw new Error(`column "${name}" not on table`);
// table-helpers.ts:85-87
throw new Error('table has no `id` column — declare parentKey/targetKey explicitly');
```

**Why it is wrong:** the parser and the translator validate against **different** parts of
the same schema. `resolveLeaf` walks `fields` and `relations` maps (`resolve-leaf.ts:48-82`)
and never inspects `rel.table`, so a `many-to-many` relation that declares `fields` but omits
the optional `table` (`types.ts:121` — "Target table — required when filtering on target
fields", i.e. optional in the type) produces a filter the parser accepts and the translator
cannot build. The result is a **500 on a well-formed user request**. The same asymmetry
applies to a `fields` entry naming a column that is not on the table, and to a nested
`fields` map with no matching `relations` entry.

`.cursor/BUGBOT.md` calls out precisely this pattern for shared tool handlers — "Bare
`Error` … treats a non-`HttpException` as a bug and returns an opaque 500" — and the whole
of `filter-exceptions.ts` exists so filter failures are legible 400s. These four sites are
the exception.

**Repro:**
1. In any `FilterSchema`, declare a `many-to-many` relation with `through`, `fk`, `targetFk`
   and `fields: { name: { type: 'string' } }` but **no** `table`.
2. `GET /api/<endpoint>?filter={"field":"<rel>.name","op":"eq","value":"x"}`
→ Observed: the parser accepts (the path validates against `rel.fields`), then
`relationExists` throws a bare `Error` → Nest's default filter returns
`{"statusCode":500,"message":"Internal server error"}`.
→ Expected: either a 400 naming the misconfiguration, or — better — the parser rejecting the
path at parse time so the schema error is caught in development.

**Blast radius:** manifests only on a mis-declared schema, so it is a developer-facing bug
rather than an exploitable one. The cost is a 500 (which alerts, pages and pollutes error
budgets) for what is a 400-shaped input, and an opaque message for the operator.
**Suggested fix:** convert the four sites to `FilterException` with a new
`FILTER_SCHEMA_INVALID` code, and/or have `resolveLeaf` reject a target-field path on a
`many-to-many` whose `table` is absent.

### 🐞 BUG-utils-server-03 — `FilterException` spreads caller-supplied `context` over the reserved response keys · Severity: Low

**Location:** `packages/utils/server/src/lib/filters/filter-exceptions.ts:66-80`
**Category:** correctness

**What the code does:**

```ts
constructor(code, message, context: Record<string, unknown> = {}) {
    super({
        statusCode: 400,
        error: 'Bad Request',
        code,
        message: `filter: ${message}`,
        ...context
    });
```

**Why it is wrong:** `...context` is spread **last**, so a context key named `message`,
`code`, `statusCode` or `error` silently overwrites the field the class exists to guarantee.
The class's whole contract is that "the response body carries a `code` … so clients can key
off the category rather than string-matching the message" (`:44-46`) — a contract a caller
can break by accident. Today the only risky payload is the `InvalidJson` case, which passes
`{ reason: (err as Error).message }` (`parse-filter-tree.ts:41`) — safe by name, but it does
put the raw `JSON.parse` message into a client-visible body, and it is one rename away from
being `{ message: … }`.

**Repro:**
1. Call `new FilterException(FilterErrorCode.UnknownField, 'x', { statusCode: 200, code: 'nope' })`.
2. Inspect the response body.
→ Observed: `{"statusCode":200,"error":"Bad Request","code":"nope","message":"filter: x"}` —
a 400 response whose body claims 200 and whose machine-readable code is wrong.
→ Expected: reserved keys are not overridable.

**Blast radius:** internal-only today; a latent trap for whoever adds the next context key.
**Suggested fix:** spread `context` **first**, or nest it under a `context` key rather than
flattening it into the body.

### 🐞 BUG-utils-server-04 — `scalarOf` coerces any non-string value with `String(v)`, so `null` becomes the literal text `"null"` · Severity: Low

**Location:** `packages/utils/server/src/lib/filters/resolve-leaf.ts:138-146`
**Category:** correctness

**What the code does:**

```ts
function scalarOf(v: unknown, field: ScalarFieldSchema, pathStr: string): unknown {
    const s = typeof v === 'string' ? v : String(v);
    switch (field.type) {
        case ScalarFieldType.String:
            return s;
```

**Why it is wrong:** for a `string` field every non-string input is stringified rather than
rejected. `null` → `"null"`, `undefined` → `"undefined"`, `{}` → `"[object Object]"`,
`[1,2]` → `"1,2"`, `true` → `"true"`. A JSON client that sends `"value": null` meaning "no
value" gets a search for rows whose column literally contains the four characters `null`,
with a `200` and a wrong (usually empty) result set — the failure is silent, which is worse
than a 400. The library rejects a bad number, a bad boolean, a bad uuid, a bad date and a
bad enum with `FILTER_INVALID_VALUE`; `string` is the one type with no validation at all.
Note the omission is also how `{"field":"email","op":"eq"}` (no `value` key) becomes a
search for `"undefined"` rather than a 400.

**Repro:**
1. `GET /api/users?filter={"field":"email","op":"eq","value":null}`
→ Observed: `200` with an empty list — the query was `email = 'null'`.
→ Expected: `400 FILTER_INVALID_VALUE`, or an explicit rule that `null` means `IS NULL`
(which the `null` operator already provides).

**Blast radius:** a wrong-but-plausible empty result, attributed by the client to "no
matches" rather than to a bad request. No security impact — the value is still bound.
**Suggested fix:** in `scalarOf`, reject `null`/`undefined`/objects/arrays for a `string`
field with `FILTER_INVALID_VALUE` instead of stringifying them.

**Checked and cleared** (no defect found, having read the code): **SQL injection is
structurally impossible** — every value reaches drizzle as a bound parameter
(`scalar-op.ts:52-75`) and every column as a resolved `Column` object from `getTableColumns`
(`table-helpers.ts:37-43`); there is no string concatenation into SQL anywhere in the
package. The empty-`in`/`nin` rejection (`resolve-leaf.ts:113-123`) correctly prevents the
silent match-none / match-all inversion — the single highest-risk behaviour here, and it is
right. The NULL-inclusive negative operators (`scalar-op.ts:32-34`) are correct SQL
three-valued-logic handling with a clear rationale. The relation-negation rewrite
(`negation.ts` + `tree-to-drizzle.ts:111-113`) is correct for to-many relations and is the
subtlest thing in the package; `negation.spec.ts` covers all four rewrites. `rebind`
(`table-helpers.ts:67-74`) genuinely fixes the aliased-correlation bug it describes and is
correctly a no-op on unaliased chains (`relation-nesting.spec.ts:207`). The `many-to-many`
fast path correctly **yields** to a `scope` (`relation-exists.ts:106-107`), which is the
tenant-isolation-critical branch, and `relation-scope.spec.ts:115` pins it. `clampInt`'s
empty-string→`min` behaviour is deliberate and pinned by
`clamp-int.spec.ts:21`, so it is documented behaviour rather than a bug (though it does mean
`?pageSize=` yields `min`, worth a caller-side note). `violatedConstraint`'s `cause` walk is
bounded at 5 and cycle-safe (`pg-errors.ts:38`, asserted at `pg-errors.spec.ts:54`), and its
`''`-vs-`undefined` distinction is a genuine improvement over a boolean. `parseFilterTree`
is pure with no shared mutable state. **Also cleared during verification:** the
`self-referential` `alias` uniqueness requirement (`types.ts:144-147`) — the schema is a
tree, so each hop is its own object, and the only real producer derives the alias from the
path (`packages/content/server/src/lib/entries/infrastructure/queries/entry-filter-surface.ts:284`,
pinned by `entry-filter-surface.spec.ts:159-177`). An earlier draft of this artifact filed
that as a defect; it was withdrawn.

**Tally:** `3 🐞 — 0 Critical · 0 High · 1 Medium · 2 Low (0 🔒)` ·
`♿ 0 findings — 0 Supports · 0 Partially Supports · 0 Does Not Support · 6 Not Applicable`

## 7. Recommended E2E Tests

| Priority | Harness | Proposed spec | Asserts | Closes |
| --- | --- | --- | --- | --- |
| 1 | Unit (`packages/utils/server/src/lib/filters/__test__/schema-misconfiguration.spec.ts`) | translator error typing | A `many-to-many` relation with `fields` but no `table`, a `fields` entry naming a missing column, and a nested `fields` with no `relations` entry each throw a `FilterException` (400-shaped), not a bare `Error`. Currently fails | `🐞 BUG-utils-server-01`, EC-22, EC-23, EC-24 |
| 2 | Unit (`.../__test__/self-referential-alias.spec.ts`) | alias uniqueness | A two-hop self-referential path (`parent.parent.name`) built from **distinct** per-hop aliases produces two distinct correlation names in the emitted SQL and binds the predicate to the outermost hop; a schema that reuses one alias at both levels is shown to shadow it — turning the `types.ts:144-147` comment-level invariant into an executable guard rather than a footnote | EC-29 |
| 3 | Unit (`.../__test__/resolve-leaf.spec.ts`) | coercion completeness | Boolean (`'1'` → 400), date (`'not-a-date'` → 400, `'2024-01-01'` → `Date`), enum (undeclared → 400 with `allowed`), and **string with `null`/`undefined`/object** are each asserted — closing the biggest gap in an otherwise excellent suite | F14, F15, `🐞 BUG-utils-server-04`, EC-14 |
| 4 | Unit (`.../__test__/parse-filter-tree.spec.ts`, extend) | at-limit boundaries | Exactly `maxNodes` nodes, exactly `maxGroupDepth` nested groups and exactly `maxDepth` path segments all **pass**; one more of each rejects. Today only the reject side is covered | F8, F9, F10, EC-05, EC-06 |
| 5 | `apps/server-e2e` (testcontainer + supertest) | extend `apps/server-e2e/src/server/users/list-users-filter.spec.ts` | Each 400 asserts `res.body.code` equals the specific `FilterErrorCode`, not merely the status — pinning the machine-readable contract `FilterException` exists for | F34 |
| 6 | Unit (`.../__test__/null-operator.spec.ts`) | `null` operator | `true`/`'true'`/`false`/`'false'` accepted, anything else → `FILTER_INVALID_VALUE`; on a relation path `null:true` rewrites to `NOT EXISTS(… IS NOT NULL …)` and `null:false` stays a plain `EXISTS` | F15, EC-32 |
| 7 | `apps/server-e2e` | `apps/server-e2e/src/server/content/list-entries-relation-scope.spec.ts` | 🔒 A relation filter on a `many-to-many` **cannot** match a target row in another workspace or a soft-deleted one — via the target-field path *and* via the `relation.id in […]` fast path, proving both take the scope | EC-20, F31 |
| 8 | Unit (`.../__test__/filter-exceptions.spec.ts`) | error envelope | A `context` carrying `message`/`code`/`statusCode` does **not** override the reserved fields. Currently fails | `🐞 BUG-utils-server-03` |
| 9 | Unit (`.../__test__/scalar-op.spec.ts`) | `like` semantics | Pins today's behaviour that `%` and `_` in a value are **not** escaped, so the wildcard passthrough is a decision rather than an accident, and a future escape change is deliberate | EC-12 |
| 10 | Unit (`.../__test__/extension-collision.spec.ts`) | extension precedence | A schema where a name appears in both `extensionFields` and `relations` — assert which wins and that the resolver receives the full path, so `tree-to-drizzle.ts:82` is a documented rule rather than an emergent one | EC-30 |
