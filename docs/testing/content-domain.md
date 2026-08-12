# @ortha-cms/content-domain — Test Artifact

> **Unit:** `packages/content/domain` · **Package:** `@ortha-cms/content-domain` · **Kind:** library (shared kernel)
> **Source of truth:** `packages/content/domain/AGENTS.md`
> **Findings verified:** 2026-08-11 — 9 confirmed · 0 deleted · 1 corrected · 0 unverified
> **Generated:** 2026-08-11

## 1. Scope & Preconditions

**Owns** three pure rules that `content-server` and `content-admin` must apply
identically (ADR-0003 decision #7 — the single sanctioned FE↔BE code share):
the entry-status state machine, field-value validation, and the publish gate.
Plus the small vocabulary they need: `CONTENT_FIELD_TYPE`, `isEmptyFieldValue`,
and the serialized `EntryFieldSpec` shape.

**Does NOT own:** anything requiring a framework or I/O. It cannot check that a
relation target exists, that a media asset is in the workspace, that a slug is
unique, that a required **link-managed** relation has links, or that an asset's
MIME satisfies a field's `accept` — all of those need the database and live in
`content-server`. It also owns no persistence, no HTTP, no React, and no
migrations.

- **Entry points** — the whole public surface is `src/index.ts:10-35`:

    | Export | Kind | Defined at |
    | --- | --- | --- |
    | `ENTRY_STATUS` | const object `{Draft:'draft',Published:'published'}` | `src/lib/status/entry-status.ts:20-23` |
    | `EntryStatus` | derived union type | `src/lib/status/entry-status.ts:26` |
    | `canTransition(from,to)` | predicate | `src/lib/status/entry-status.ts:47-49` |
    | `assertTransition(from,to)` | throws `EntryStatusTransitionError` | `src/lib/status/entry-status.ts:72-76` |
    | `EntryStatusTransitionError` | `Error` subclass carrying `from`/`to` | `src/lib/status/entry-status.ts:56-64` |
    | `CONTENT_FIELD_TYPE` | 12 field-type identifiers | `src/lib/fields/field-type.ts:11-24` |
    | `FieldType` | derived union type | `src/lib/fields/field-type.ts:27-28` |
    | `isEmptyFieldValue(value)` | the canonical empty test | `src/lib/fields/field-type.ts:37-44` |
    | `EntryFieldSpec` / `EntryFieldSpecMap` / `FieldValidationRules` | structural types | `src/lib/fields/field-spec.ts:11-63` |
    | `validateFieldValue(name,spec,value)` | returns `ValidationIssue[]` | `src/lib/validation/validate-entry-values.ts:56-183` |
    | `validateEntryValues(fields,values,options?)` | returns `ValidationResult` | `src/lib/validation/validate-entry-values.ts:204-225` |
    | `ValidateEntryValuesOptions` | `{rejectUnknownKeys?,typeName?}` | `src/lib/validation/validate-entry-values.ts:186-196` |
    | `ValidationIssue` / `ValidationResult` | result types | `src/lib/validation/validation-result.ts:4-13` |
    | `canPublish(fields,values)` | predicate | `src/lib/validation/publish-gate.ts:25-30` |

    No routes, no slots, no DI ports — this package is consumed as plain
    function calls.

- **Runtime prerequisites:** none. No database, no server, no environment
  variables, no build step. `package.json` declares **zero dependencies**
  (`packages/content/domain/package.json`), which is the package's defining
  constraint.

- **How to exercise it manually**

    ```bash
    npx nx test @ortha-cms/content-domain      # the three DB-free unit suites
    npx nx typecheck @ortha-cms/content-domain
    npx nx lint @ortha-cms/content-domain
    ```

    Or interactively, since it is pure:

    ```bash
    npx tsx -e "
      const { validateEntryValues, CONTENT_FIELD_TYPE } = require('./packages/content/domain/src/index.ts');
      console.log(validateEntryValues(
        { title: { type: CONTENT_FIELD_TYPE.Text, required: true, validation: { minLength: 3 } } },
        { title: 'no' },
        { rejectUnknownKeys: true, typeName: 'article' }
      ));
    "
    ```

- **Dependencies that must be healthy:** none of its own. Its *consumers*
  matter for meaning: `content-server`'s `EntryValidationService` delegates to
  `validateEntryValues(type.fields, values, { rejectUnknownKeys: true, typeName })`
  and its `Entry` model uses `assertTransition`; `content-admin` mirrors the
  same rules in its editor. If either drifts, this package's guarantees are
  hollow — verifying that delegation is part of testing this unit.

## 2. Feature Inventory

| # | Feature | Where it lives | Coverage |
| --- | --- | --- | --- |
| F1 | `draft → published` is a legal transition | `src/lib/status/entry-status.ts:38` | 🧪 UNIT |
| F2 | `published → draft` is a legal transition | `src/lib/status/entry-status.ts:39` | 🧪 UNIT |
| F3 | A same-state pair is **not** a transition (`canTransition` → `false`) | `src/lib/status/entry-status.ts:47-49` | 🧪 UNIT |
| F4 | `assertTransition` throws `EntryStatusTransitionError` carrying `from`/`to` | `src/lib/status/entry-status.ts:56-76` | 🧪 UNIT |
| F5 | `canTransition` returns `false` for an unknown status rather than throwing | `src/lib/status/entry-status.ts:48` (`?.` + `?? false`) | ❌ NONE |
| F6 | `isEmptyFieldValue`: null/undefined/blank-string/empty-array are empty | `src/lib/fields/field-type.ts:37-44` | 🧪 UNIT (indirectly) |
| F7 | `0` and `false` are **present**, not empty | same | 🧪 UNIT |
| F8 | Required check on an empty value | `src/lib/validation/validate-entry-values.ts:78-81` | 🧪 UNIT |
| F9 | Link-managed relations (`many`/`inverse`) are skipped entirely | `validate-entry-values.ts:71-76` | 🧪 UNIT |
| F10 | `text`/`richtext`: string type, `minLength`, `maxLength`, `pattern` | `validate-entry-values.ts:85-98` | 🧪 UNIT |
| F11 | `number`/`money`: numeric type, `integer`, `min`, `max` | `validate-entry-values.ts:99-112` | 🧪 UNIT |
| F12 | `boolean`: strict `typeof === 'boolean'` | `validate-entry-values.ts:113-115` | ⚠️ PARTIAL |
| F13 | `date`: `YYYY-MM-DD` shape | `validate-entry-values.ts:116-119` | ⚠️ PARTIAL |
| F14 | `datetime`: ISO date-time shape, or a `Date` instance | `validate-entry-values.ts:120-128` | 🧪 UNIT |
| F15 | `select`: string, member of `options` | `validate-entry-values.ts:129-135` | 🧪 UNIT |
| F16 | `multiselect`: array, every item a member of `options` | `validate-entry-values.ts:136-147` | ❌ NONE |
| F17 | `json`: any value accepted | `validate-entry-values.ts:148-149` | ❌ NONE |
| F18 | `relation` (owning single): a UUID string | `validate-entry-values.ts:150-162` | 🧪 UNIT |
| F19 | `media` (single): a UUID string | `validate-entry-values.ts:164-179` | 🧪 UNIT |
| F20 | `media` (`multiple`): an array of UUIDs | `validate-entry-values.ts:168-175` | 🧪 UNIT |
| F21 | Unknown keys reported as `unknown field on "<typeName>"` when asked | `validate-entry-values.ts:211-219` | 🧪 UNIT |
| F22 | Unknown keys ignored when `rejectUnknownKeys` is off | same | 🧪 UNIT |
| F23 | Issue ordering: unknown keys first, then fields in schema order | `validate-entry-values.ts:209-222` | ❌ NONE |
| F24 | `pattern` regexes are compiled once and cached by source | `validate-entry-values.ts:38-46` | ❌ NONE |
| F25 | `canPublish` == `validateEntryValues(...).valid` | `src/lib/validation/publish-gate.ts:25-30` | 🧪 UNIT |
| F26 | Zero runtime dependencies / no framework imports (the one hard rule) | `packages/content/domain/package.json`, every source file | ❌ NONE (not lint-enforced) |

## 3. Manual Test Plan

This unit is a pure library; "manual" means calling the exports directly. Every
block below is executable from a Node REPL with the package imported. No
keyboard or screen-reader path applies — see §4A.

### F1 / F2 / F3 / F4 / F5 — Entry-status state machine

**Preconditions:** none.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `canTransition('draft','published')` | `true` |
| 2 | `canTransition('published','draft')` | `true` |
| 3 | `canTransition('draft','draft')` | `false` — a same-state pair is not a transition |
| 4 | `canTransition('published','published')` | `false` |
| 5 | `assertTransition('draft','published')` | returns `undefined`, no throw |
| 6 | `assertTransition('published','published')` | throws `EntryStatusTransitionError`, message `Illegal entry status transition: published → published.` |
| 7 | Inspect the thrown error | `err.name === 'EntryStatusTransitionError'`, `err.from === 'published'`, `err.to === 'published'` |
| 8 | `canTransition('archived' as any, 'draft')` | `false` — the optional chain absorbs an unknown key (`entry-status.ts:48`) |
| 9 | `assertTransition('archived' as any, 'draft')` | throws, `from` is the unknown value verbatim |

### F6 / F7 / F8 — Emptiness and `required`

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `isEmptyFieldValue(undefined)` / `(null)` | `true` / `true` |
| 2 | `isEmptyFieldValue('')` / `('   ')` / `('\t\n')` | `true` for all three (whitespace is trimmed) |
| 3 | `isEmptyFieldValue([])` | `true` |
| 4 | `isEmptyFieldValue(0)` / `(false)` / `(NaN)` | `false` for all three |
| 5 | `isEmptyFieldValue({})` | `false` — an empty object is **present** |
| 6 | Validate `{title:{type:'text',required:true}}` against `{}` | one issue `{field:'title',message:'is required'}` |
| 7 | Same against `{title:'  '}` | the same "is required" issue — a blank string does not satisfy `required` |
| 8 | Same against `{title:0}` (a number in a text field) | **not** "is required"; instead `must be a string` |

### F9 — Link-managed relations are skipped

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Field `tags: {type:'relation', required:true, relation:{many:true}}`, values `{}` | **no** issue — a required many-relation is never flagged (`validate-entry-values.ts:71-76`) |
| 2 | Field `authors: {type:'relation', required:true, relation:{inverse:{field:'x'}}}`, values `{}` | no issue |
| 3 | Values `{tags:['not-a-uuid']}` on the same field | **no** issue — the whole spec returns early before any shape check |
| 4 | Field `author: {type:'relation', required:true, relation:{many:false}}`, values `{}` | issue `is required` — an owning single relation **is** validated |
| 5 | `{author:'nope'}` | issue `must be an entry id` |

### F10 — Text and rich text

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `{type:'text',required:false}` with `42` | `must be a string` |
| 2 | `validation:{minLength:3}` with `'no'` | `must be at least 3 characters` |
| 3 | `validation:{maxLength:10}` with `'x'.repeat(11)` | `must be at most 10 characters` |
| 4 | Exactly 3 and exactly 10 characters | no issue (inclusive bounds) |
| 5 | `validation:{pattern:'^[a-z-]+$'}` with `'Bad Slug'` | `must match pattern ^[a-z-]+$` |
| 6 | `validation:{pattern:'abc'}` with `'xxabcxx'` | **no issue** — an unanchored pattern matches anywhere |
| 7 | `validation:{maxLength:1}` with `'👍'` | `must be at most 1 characters` — see `🐞 BUG-content-domain-04` |
| 8 | `{type:'richtext'}` with `'<h1>Hi</h1>'` | no issue — richtext is validated as a bare string, with no structural checking |

### F11 — Number and money

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `'5'` (a string) in a `number` field | `must be a number` |
| 2 | `NaN` | `must be a number` (explicitly guarded, `validate-entry-values.ts:101`) |
| 3 | `Infinity` | **no issue** — `typeof Infinity === 'number'` and it is not `NaN` |
| 4 | `validation:{integer:true}` with `2.5` | `must be a whole number` |
| 5 | `validation:{min:1}` with `0` | `must be ≥ 1` (note the Unicode `≥` in the message) |
| 6 | `validation:{max:5}` with `99` | `must be ≤ 5` |
| 7 | `validation:{min:1,max:5}` with `0` and `integer:true` and `0.5` | **two** issues on the same field, in rule order: whole-number then `≥` |
| 8 | `{type:'money'}` with `19.99` | no issue — money is validated exactly as `number`; see `🐞 BUG-content-domain-05` |

### F12 — Boolean

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `true` / `false` | no issue |
| 2 | `'true'` (string) | `must be true or false` |
| 3 | `1` / `0` | `0` is a **present** value that fails as `must be true or false`; `1` likewise |
| 4 | `null` on a non-required boolean | no issue (empty) |

### F13 — Date

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `'2026-01-02'` | no issue |
| 2 | `'01-02-2026'` | `must be an ISO date (YYYY-MM-DD)` |
| 3 | `new Date()` (a `Date` instance) | `must be an ISO date (YYYY-MM-DD)` — unlike `datetime`, a `Date` is **not** accepted here |
| 4 | `'2026-13-45'` | **no issue** — see `🐞 BUG-content-domain-02` |
| 5 | `'2025-02-30'` | **no issue** — same defect |
| 6 | `'2026-1-2'` | `must be an ISO date (YYYY-MM-DD)` (the regex requires two digits) |

### F14 — Datetime

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `'2026-01-02T03:04:05Z'` | no issue |
| 2 | `'2026-01-02 03:04'` (space separator, no seconds) | no issue — both are permitted by the regex |
| 3 | `'2026-01-02T03:04:05.123+02:00'` / `'+0200'` | no issue (fractional seconds and both offset spellings) |
| 4 | `'2026-01-02'` (date only) | `must be an ISO date-time` — deliberately rejected so `Date.parse` cannot coerce it to UTC midnight |
| 5 | `new Date('2026-01-02T00:00:00Z')` | no issue |
| 6 | `new Date('nonsense')` (an **Invalid Date**) | **no issue** — see `🐞 BUG-content-domain-03` |
| 7 | `'2026-13-45T99:99:99Z'` | `must be an ISO date-time` — here the `Date.parse` guard **does** run and rejects it |

### F15 / F16 — Select and multiselect

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `select` with `options:['red','blue']`, value `'red'` | no issue |
| 2 | value `'green'` | `must be one of: red, blue` |
| 3 | `select` with **no** `options` key at all, any string value | `must be one of: ` (empty list) — every value fails |
| 4 | `multiselect` with `['red']` | no issue |
| 5 | `multiselect` with `['red','green']` | `must be a subset of: red, blue` |
| 6 | `multiselect` with `'red'` (a bare string) | `must be a subset of: red, blue` |
| 7 | `multiselect` with `['red','red']` | **no issue** — duplicates are permitted |
| 8 | `multiselect` with `[]` | no issue (empty ⇒ skipped, or `is required` if required) |

### F17 — JSON

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `{a:1}`, `[1,2]`, `'string'`, `42`, `true` | no issue for any — the case body is a bare `break` |
| 2 | A 10 MB nested object | no issue — there is no size or depth limit here (see EC-19) |
| 3 | `{}` on a `required` json field | no issue — `isEmptyFieldValue({})` is `false`, so an empty object satisfies `required` |
| 4 | `[]` on a `required` json field | `is required` — an empty **array** is empty. The asymmetry with step 3 is worth pinning |

### F18 / F19 / F20 — Relation and media ids

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Owning single relation, `'11111111-1111-1111-1111-111111111111'` | no issue |
| 2 | Same, uppercase hex | no issue (`UUID_RE` carries the `i` flag) |
| 3 | Same, `'nope'` | `must be an entry id` |
| 4 | Media single, a UUID | no issue |
| 5 | Media single, `'not-a-uuid'` | `must be a media asset id` |
| 6 | Media `multiple:true`, `[uuid,uuid]` | no issue |
| 7 | Media `multiple:true`, a bare uuid string | `must be an array of media asset ids` |
| 8 | Media `multiple:true`, `[uuid,'nope']` | `must be an array of media asset ids` (one issue for the whole array, not per item) |
| 9 | Media `multiple:true`, `[uuid,uuid]` with the same id twice | no issue — duplicates permitted |

### F21 / F22 / F23 — Unknown keys and ordering

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `validateEntryValues(fields,{title:'hello',mystery:1},{rejectUnknownKeys:true,typeName:'thing'})` | one issue `{field:'mystery',message:'unknown field on "thing"'}` |
| 2 | Same without the options object | no `mystery` issue |
| 3 | `rejectUnknownKeys:true` with **no** `typeName` | message is `unknown field on ""` — an empty type name, not an error |
| 4 | Values with both an unknown key and an invalid known field | the unknown-key issue comes **first**, then fields in `Object.entries(fields)` order |
| 5 | `{toString:1}` with `rejectUnknownKeys:true` | **no issue** — see `🐞 BUG-content-domain-01` |

### F24 — Pattern caching

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Validate the same `pattern` field 1000 times | one `RegExp` is constructed; subsequent calls hit the module-level `patternCache` |
| 2 | Validate with a `pattern` of `'^(a+)+$'` against `'aaaaaaaaaaaaaaaaaaaaaaaaaaaaX'` | the call hangs — see `🐞 BUG-content-domain-06` |

### F25 — Publish gate

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `canPublish({title:{type:'text',required:true,validation:{minLength:3}}}, {})` | `false` |
| 2 | `canPublish(..., {title:'no'})` | `false` |
| 3 | `canPublish(..., {title:'hello'})` | `true` |
| 4 | With an optional field absent | `true` |
| 5 | With a required **many** relation and no links | `true` — the gate cannot see links; the server's link count is the other half of the precondition (`publish-gate.ts:9-13`) |
| 6 | With an unknown key in `values` | `true` — `canPublish` never passes `rejectUnknownKeys` (`publish-gate.ts:29`) |

### F26 — The one hard rule

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `cat packages/content/domain/package.json` | no `dependencies`, `peerDependencies` or `devDependencies` block at all |
| 2 | `grep -rn "from '" packages/content/domain/src --include=*.ts \| grep -v "from '\."` | no output — every import is relative |
| 3 | Grep for `@nestjs`, `drizzle-orm`, `react`, `class-validator`, `node:` | no matches |
| 4 | `npx nx typecheck @ortha-cms/content-domain` in isolation | passes with no workspace project references beyond itself |

## 4. Edge Cases & Negative Paths

**Empty / zero**

- **EC-01 — `validateEntryValues({}, {})`.** `❌ NONE` Expected: `{valid:true,issues:[]}` — a type with no fields validates anything (with `rejectUnknownKeys` off).
- **EC-02 — `validateEntryValues({}, {a:1}, {rejectUnknownKeys:true})`.** `❌ NONE` Expected: one unknown-key issue.
- **EC-03 — `0` and `false` are present.** `🧪 UNIT` `src/lib/validation/validate-entry-values.spec.ts:87-95` — asserts `active:false` trips no issue and `count:0` trips the `≥ 1` bound rather than `is required`. This is the single most important behaviour in the file and it is well covered.
- **EC-04 — `{}` vs `[]` on a required `json` field.** `❌ NONE` Asymmetric: `{}` satisfies `required`, `[]` does not (`isEmptyFieldValue` only treats arrays as emptiable, `field-type.ts:42`). Defensible but undocumented.
- **EC-05 — `select` with no `options` key.** `❌ NONE` Every non-empty value fails with the degenerate message `must be one of: `. Arguably a schema error that should be caught at registry-load time, not per value.

**Boundary**

- **EC-06 — `minLength`/`maxLength` exactly at the bound.** `❌ NONE` Both comparisons are strict (`< min`, `> max`, lines 91-94), so the bounds are inclusive. Untested.
- **EC-07 — `min`/`max` exactly at the bound.** `❌ NONE` Same, lines 107-110.
- **EC-08 — `minLength: 0`.** `❌ NONE` A blank value is caught by the empty check first, so `minLength:0` is a no-op.
- **EC-09 — `min: 0` with value `0`.** `❌ NONE` Passes — `0 < 0` is false. Important because `0` is a present value.
- **EC-10 — `Infinity` / `-Infinity` in a number field.** `❌ NONE` Accepted (`typeof` is `'number'`, not `NaN`). A `Infinity` reaching a Postgres `numeric` column is a downstream failure the kernel does not prevent.
- **EC-11 — `Number.MAX_SAFE_INTEGER + 1` with `integer:true`.** `❌ NONE` `Number.isInteger` is still `true` at that magnitude, so it passes and loses precision downstream.
- **EC-12 — A `date` of `'0000-00-00'`.** `❌ NONE` Passes the regex. See `🐞 BUG-content-domain-02`.

**Size & encoding**

- **EC-13 — Emoji and combining marks against `maxLength`.** `❌ NONE` `String.length` counts UTF-16 code units: `'👍'.length === 2`, `'é'` (e + U+0301) is 2, and a family emoji can be 11. See `🐞 BUG-content-domain-04`.
- **EC-14 — RTL / bidi control characters in a text value.** `❌ NONE` Accepted verbatim; the kernel neither strips nor flags `U+202E`, so a stored value can visually reverse surrounding text in any consumer that renders it raw.
- **EC-15 — `'<script>alert(1)</script>'` in a `text` or `richtext` field.** `❌ NONE` Accepted — correct for a kernel that does not know the output context, but it means **no sanitisation happens anywhere in this package**. Whoever renders richtext owns escaping.
- **EC-16 — A 10 MB string in a `text` field with no `maxLength` rule.** `❌ NONE` Accepted. There is no default length cap for any field type.
- **EC-17 — A UUID with surrounding whitespace (`' <uuid> '`).** `❌ NONE` Rejected — `UUID_RE` is anchored and no trimming occurs. Correct, but note that `isEmptyFieldValue` **does** trim, so `' '` is empty while `' x'` is a present, invalid value.
- **EC-18 — A `pattern` containing a `/` or flags syntax (`'/abc/i'`).** `❌ NONE` `new RegExp('/abc/i')` compiles a pattern that literally matches `/abc/i` — a silent author foot-gun with no error.
- **EC-19 — A deeply nested / 10 MB `json` value.** `❌ NONE` Accepted unconditionally (`validate-entry-values.ts:148-149`). No depth or size guard exists in the kernel.

**Type confusion / prototype**

- **EC-20 — A values key named `toString`, `constructor`, `__proto__`, `valueOf`, `hasOwnProperty`.** `❌ NONE` `rejectUnknownKeys` uses `key in fields`, which walks the prototype chain, so none of these is reported as unknown. See `🐞 BUG-content-domain-01`.
- **EC-21 — A *field* legitimately named `toString`.** `❌ NONE` `Object.entries(fields)` yields only own enumerable keys, so a real field named `toString` **is** validated normally. The asymmetry with EC-20 is the tell.
- **EC-22 — `values` created with `Object.create(null)`.** `❌ NONE` `Object.keys` still works; `key in fields` is unaffected (the chain walked is `fields`', not `values`'). No change in behaviour.
- **EC-23 — A `spec` with `type` naming no known field type (e.g. `'colorpicker'`).** `❌ NONE` The `switch` falls through every case with no `default`, so **any value passes** on an unknown type — a typo in a field-type identifier silently disables all validation for that field. Worth pinning even though field types are code-defined.

**Relation / media specifics**

- **EC-24 — `relation` with `many:true` **and** a value present.** `🧪 UNIT` `validate-entry-values.spec.ts:146-150` asserts `tags:['nope']` produces no issue. This is correct per the design, and it means the `if (spec.relation?.many)` branch inside the `Relation` case is **unreachable** — see `🐞 BUG-content-domain-07`.
- **EC-25 — `relation:{many:false, inverse:undefined}`.** `❌ NONE` Falsy on both, so it is validated as an owning single relation. Correct.
- **EC-26 — `relation:{}` (an empty object).** `❌ NONE` Same as above — treated as owning-single.
- **EC-27 — `media` with `multiple` undefined vs `false`.** `❌ NONE` Both take the single-id branch (`spec.multiple` is falsy). Correct.
- **EC-28 — A media field with an `accept` restriction.** `❌ NONE` Not modelled in `EntryFieldSpec` at all — the kernel deliberately shape-checks ids only, delegating MIME/kind to the server (`field-spec.ts:52-58`). Confirm `content-server` actually enforces it; if it does not, nothing does.

**Permission matrix / tenant isolation / concurrency**

- **Not applicable.** This unit has no authentication, no authorization, no
  workspace concept, no I/O and no shared mutable state other than the
  `patternCache`. It cannot leak across tenants because it never reads anything.
  The one piece of module-level state, `patternCache`
  (`validate-entry-values.ts:38`), is keyed by pattern source and stores only
  compiled `RegExp` objects — it carries no request data, so a cross-request
  leak through it is not possible. Recorded explicitly so the absence is a
  finding, not an oversight.

**Consumer-contract risks (where this unit's guarantees can be hollowed out)**

- **EC-29 — `content-server` stops passing `rejectUnknownKeys:true`.** `❌ NONE` The kernel defaults it **off** (`validate-entry-values.ts:207`), so a caller that forgets the option silently accepts arbitrary keys. Fail-open default on the option that makes "the schema is the contract" true.
- **EC-30 — `content-admin` and `content-server` disagree on `canPublish`.** `❌ NONE` `canPublish` ignores unknown keys and cannot see links, so the admin's Publish button can be enabled while the server refuses. Expected by design (`publish-gate.ts:9-13`) but there is no test pinning the two halves together.
- **EC-31 — `AnyFieldSpec` / `ContentField` drifting out of structural compatibility with `EntryFieldSpec`.** `❌ NONE` The whole no-adapter design rests on structural assignability (`field-spec.ts:5-7`). Only a typecheck catches a drift, and only if both packages are typechecked together.

### 4A. Accessibility & Section 508 Conformance

This unit renders **no UI**, so every Chapter 4 hardware provision and every
Perceivable/Operable WCAG criterion is **Not Applicable**. What *is* in scope —
and is the more valuable question — is **508 Chapter 5, 504 Authoring Tools**:
Ortha is an authoring tool, this package is its content **model kernel**, and a
model that has nowhere to store accessibility information guarantees that no
amount of editor polish can produce conformant output. That is a schema-level
finding, and it belongs here.

Standards: Revised Section 508 (36 CFR Part 1194, App. A–C) incorporates WCAG
2.0 A + AA by reference (E205.4 content; **504.2** authoring tools); this repo's
`accessibility` skill targets WCAG **2.1** AA
(`.agents/skills/accessibility/SKILL.md:10`).

| Provision | Verdict | Basis |
| --- | --- | --- |
| 508 E205.4 → WCAG Perceivable / Operable / Understandable / Robust | **Not Applicable** | No rendered content |
| 508 502.2 / 502.3 / 503.2 | **Not Applicable** | No platform UI |
| **508 504.2** — the tool enables production of conformant content | **Does Not Support** | ♿ A11Y-content-domain-01, -02 |
| **508 504.2.1** — accessibility information is preserved | **Partially Supports** | ♿ A11Y-content-domain-03 |
| **508 504.3** — the tool prompts for accessibility information | **Not Applicable here** | No authoring surface; assessed in `content-admin.md`. But 504.3 is unsatisfiable while 504.2 fails at the model level — you cannot prompt for a field that does not exist |
| **508 504.4** — templates support conformant output | **Not Applicable here** | Content-type definitions live in `content-server`; assessed there |

#### ♿ A11Y-content-domain-01 — The media field type models an asset id and nothing else: there is no alt-text channel in the content model

- **WCAG:** `1.1.1 Non-text Content (A)` · **508:** `504.2` · **Verdict:** **Does Not Support**
- **Location:** `packages/content/domain/src/lib/fields/field-spec.ts:52-59` and
  `packages/content/domain/src/lib/validation/validate-entry-values.ts:164-180`

    ```ts
    case CONTENT_FIELD_TYPE.Media: {
        // Shape only — an asset id is a uuid (single) or a uuid[] (multiple).
        if (spec.multiple) { … 'must be an array of media asset ids' }
        else if (typeof value !== 'string' || !UUID_RE.test(value)) {
            fail('must be a media asset id');
        }
    }
    ```

    A `media` value is *exactly* a UUID, or an array of UUIDs. The shape admits
    no per-usage alternative text, no "decorative" marker, and no caption. The
    `EntryFieldSpec` interface has no member that could carry one.
- **Why it matters:** alt text is per-**usage**, not per-asset — the same logo
  is "Acme logo" in a header and decorative in a footer strip. Even if the media
  library stores a default description on the asset row (assessed in the media
  unit), this model cannot express the override, and it cannot express
  "decorative" as distinct from "missing", which is the distinction 1.1.1 turns
  on. A validator that enforces `required` on the *id* while having no opinion
  at all on the *description* means an author can publish an image with no text
  alternative and the tool will report the entry as valid and publishable
  (`canPublish` returns `true`).
- **Repro:** define `hero: { type: 'media', required: true }`; call
  `canPublish({hero:{type:'media',required:true}}, {hero:'<uuid>'})`.
  → Observed: `true`. Expected (for 504.2): a model in which the tool *can*
  know whether a text alternative was supplied.
- **Keyboard / screen-reader experience:** downstream, any site rendering this
  entry emits an `<img>` with no `alt`, or with a single asset-level default
  repeated in every context. A screen-reader user hears the filename or nothing.
- **Remediation:** extend the media value shape to
  `{ id: string; alt?: string; decorative?: boolean }` (or add a sibling
  `alt`-carrying spec member), and make `canPublish` require `alt` **or**
  `decorative` on a required media field. This is the highest-leverage
  accessibility change available anywhere in the codebase, because it is the one
  that makes every downstream fix possible.

#### ♿ A11Y-content-domain-02 — `richtext` is validated as an opaque string, so heading, list and table-header semantics are unmodelled and uncheckable

- **WCAG:** `1.3.1 Info and Relationships (A)`, `2.4.6 Headings and Labels (AA)` · **508:** `504.2` · **Verdict:** **Does Not Support**
- **Location:** `packages/content/domain/src/lib/validation/validate-entry-values.ts:85-98`
  — `case CONTENT_FIELD_TYPE.RichText` shares the `Text` branch verbatim: a
  `typeof === 'string'` check plus `minLength` / `maxLength` / `pattern`.
- **Why it matters:** 504.2 asks whether the authoring tool enables production
  of conformant content. The kernel — the one place both runtimes agree on what
  a value *is* — treats a rich-text body as a flat string with a character
  count. It therefore cannot express or check: that headings descend without
  skipping levels, that a table has header cells or a caption, that a link's
  text is meaningful rather than "click here", or that a `lang` marker is
  attached to a foreign-language passage (3.1.2). Note also that `maxLength` on
  a richtext value counts **markup characters**, so adding a `<strong>` consumes
  the author's budget — a symptom of the same category error.
- **Repro:** `validateFieldValue('body', {type:'richtext',required:true}, '<h4>Intro</h4><h1>Title</h1><table><tr><td>a</td></tr></table>')`
  → Observed: `[]` — no issues. A skipped heading level, an `<h1>` after an
  `<h4>`, and a header-less table all validate clean.
- **Keyboard / screen-reader experience:** downstream consumers get a document
  with no navigable heading structure and tables a screen reader cannot
  associate cells in.
- **Remediation:** model rich text as a structured document (the editor already
  produces a TipTap/ProseMirror JSON tree — see `wysiwyg/admin`) rather than an
  opaque string, and add kernel-level structural rules (heading-level continuity,
  table header presence) that both runtimes can apply. At minimum, stop applying
  character-count rules to markup.

#### ♿ A11Y-content-domain-03 — No language-of-parts marker exists on any field type

- **WCAG:** `3.1.2 Language of Parts (AA)` · **508:** `504.2 / 504.2.1` · **Verdict:** **Partially Supports**
- **Location:** `packages/content/domain/src/lib/fields/field-type.ts:11-24` — the
  full field-type vocabulary; none of the twelve types carries or permits a
  language attribute, and `EntryFieldSpec` (`field-spec.ts:33-60`) has no
  language member.
- **Why it matters:** the platform localises whole entries (the i18n plugin
  scopes rows per locale), which handles the *page* language (3.1.1) but not a
  quoted passage in another language inside an otherwise-English body. Because
  the value is an opaque string, a `lang` marker an author might type as HTML is
  neither validated nor guaranteed to survive — which is the 504.2.1
  preservation question.
- **Repro:** there is no API to exercise; the finding is the absence.
  `grep -rn "lang" packages/content/domain/src` returns nothing.
- **Screen-reader experience:** a French quotation inside an English entry is
  announced with English phonemes.
- **Remediation:** decide whether language-of-parts is in scope; if so it rides
  on the same structured-rich-text change as ♿-02.
- **Cross-reference:** the same gap at the workspace level is
  `♿ A11Y-workspaces-server-01`.

## 5. E2E Coverage Map

This package has **no** e2e coverage and cannot have any directly — it is a pure
library with no routes, no UI and no wire format. Its behaviour is reachable
from e2e only *through* `content-server`'s write path
(`apps/server-e2e/src/server/content/content-entries-write.spec.ts`) and
`content-admin`'s editor (`apps/admin-e2e/src/content/*.spec.ts`), where the
messages asserted are the ones produced here. Its real coverage is three unit
suites, all DB-free.

| Feature | Spec | Asserts | Verdict |
| --- | --- | --- | --- |
| F1 draft→published | `packages/content/domain/src/lib/status/entry-status.spec.ts:9` | `canTransition` true | 🧪 UNIT |
| F2 published→draft | `entry-status.spec.ts:15` | `canTransition` true | 🧪 UNIT |
| F3 same-state | `entry-status.spec.ts:21` | both same-state pairs are `false` | 🧪 UNIT |
| F4 assert + error payload | `entry-status.spec.ts:30,36,42` | passes a legal transition; throws the typed error; `from`/`to` carried | 🧪 UNIT |
| F5 unknown status | — | — | ❌ NONE |
| F8 required | `validate-entry-values.spec.ts:83` | a missing required field is flagged | 🧪 UNIT |
| F7 `0`/`false` present | `validate-entry-values.spec.ts:87` | `active:false` clean; `count:0` trips `≥ 1` | 🧪 UNIT |
| F10 text | `validate-entry-values.spec.ts:97` | minLength and pattern | 🧪 UNIT — no `maxLength` case, no non-string case, no boundary case |
| F11 number | `validate-entry-values.spec.ts:104` | `integer` and `max` | 🧪 UNIT — no `min` case in isolation, no non-number case, no `NaN`/`Infinity` |
| F13 date | `validate-entry-values.spec.ts:128` | rejects `'01-02-2026'` | ⚠️ PARTIAL — only a *shape* failure; **no calendar-validity case**, which is exactly where 🐞-02 lives |
| F14 datetime | `validate-entry-values.spec.ts:113,119` | rejects a date-only string; accepts a `Date` instance | ⚠️ PARTIAL — no Invalid-Date case (🐞-03) |
| F15 select | `validate-entry-values.spec.ts:134` | rejects a non-option | 🧪 UNIT |
| F16 multiselect | — | — | ❌ NONE — the type is entirely untested |
| F17 json | — | — | ❌ NONE |
| F18 relation single | `validate-entry-values.spec.ts:140` | rejects a non-uuid | 🧪 UNIT |
| F9 link-managed skip | `validate-entry-values.spec.ts:146,152` | a `many` value is not shape-checked; a required `many`/`inverse` does not trip `required` | 🧪 UNIT — the most important behaviour after F7, and well covered |
| F19/F20 media | `validate-entry-values.spec.ts:202-256` | single uuid, non-uuid, uuid[], bare string, mixed array, empty-as-absent, required-empty | 🧪 UNIT — the best-covered field type in the package |
| F21/F22 unknown keys | `validate-entry-values.spec.ts:173,185` | reported with the type name when asked; ignored when not | 🧪 UNIT — **no prototype-key case** (🐞-01) |
| F23 issue ordering | — | — | ❌ NONE |
| F24 pattern cache | — | — | ❌ NONE |
| F25 canPublish | `packages/content/domain/src/lib/validation/publish-gate.spec.ts:19-33` | false while required empty; false when invalid; true when complete; true when an optional field is absent | 🧪 UNIT |
| F12 boolean | — | exercised only incidentally via `active:false` | ⚠️ PARTIAL |
| F26 purity | — | — | ❌ NONE — not enforced by lint; ADR-0003 lists the boundary rule as **follow-up work** (`docs/adr/0003-tactical-ddd-inside-plugins.md:127-131`) |

**Coverage tally:** `26 features · 16 🧪 · 4 ⚠️ · 6 ❌ · 0 ✅ E2E`

## 6. 🐞 Potential Bugs

### 🐞 BUG-content-domain-01 — `rejectUnknownKeys` can be bypassed with any `Object.prototype` member name · Severity: Medium · 🔒

**Location:** `packages/content/domain/src/lib/validation/validate-entry-values.ts:211-219`
**Category:** correctness (validation bypass)

**What the code does:**

```ts
if (options.rejectUnknownKeys) {
    for (const key of Object.keys(values)) {
        if (!(key in fields))
            issues.push({
                field: key,
                message: `unknown field on "${options.typeName ?? ''}"`
            });
    }
}
```

`key in fields` is the `in` operator, which walks `fields`' **prototype chain**.
`fields` is an ordinary object literal built from the content-type registry, so
it inherits `Object.prototype`. Therefore `'toString' in fields`,
`'constructor' in fields`, `'hasOwnProperty' in fields`, `'valueOf' in fields`
and `'__proto__' in fields` are all `true` — and none of those keys is reported
as unknown.

**Why it is wrong:** the option exists precisely because "the schema is the
contract, not a suggestion" (`validate-entry-values.ts:188-191`), and
`content-server` passes it on every write
(`packages/content/domain/AGENTS.md`: `validateEntryValues(type.fields, values,
{ rejectUnknownKeys: true, typeName })`). A caller can therefore smuggle a
fixed set of ~12 keys past the only schema-conformance gate the kernel offers.
The correct predicate is `Object.hasOwn(fields, key)`. Note the *field* loop
directly below uses `Object.entries(fields)` — own enumerable keys only — so
the two halves of the function disagree about what "a field" means.

**Repro:**
```js
validateEntryValues(
    { title: { type: 'text', required: true } },
    { title: 'hello', toString: 'x', constructor: 1, valueOf: 2 },
    { rejectUnknownKeys: true, typeName: 'article' }
);
```
→ Observed: `{ valid: true, issues: [] }` — three unknown keys accepted.
Expected: three `unknown field on "article"` issues. (`__proto__` written in an
object **literal** sets the prototype rather than creating an own key, so it is
not one of the smuggleable names; `Object.defineProperty` or `JSON.parse` are
the routes that make it one, and `JSON.parse` is exactly how a request body
arrives.)

**Blast radius:** the impact depends on what `content-server` does with the
values bag *after* validation. If it writes only schema columns, this is inert
noise; if it spreads the bag into a JSON envelope, a row is written with a
`constructor`/`__proto__` key that later `JSON.parse`/merge steps can mishandle.
The severity is Medium rather than High because the key set is fixed and
non-arbitrary, but the gate is defeated deterministically and the fix is one
token. Verify the downstream write path in `content-server.md`.

**Suggested fix:** replace `!(key in fields)` with `!Object.hasOwn(fields, key)`
(or `!Object.prototype.hasOwnProperty.call(fields, key)`), matching the
`Object.entries` semantics used two lines later.

### 🐞 BUG-content-domain-02 — A `date` field accepts calendar-impossible dates like `2026-13-45` · Severity: Medium

**Location:** `packages/content/domain/src/lib/validation/validate-entry-values.ts:22-23,116-119`
**Category:** correctness

**What the code does:**

```ts
/** ISO-8601 calendar date, no time of day. */
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
…
case CONTENT_FIELD_TYPE.Date:
    if (typeof value !== 'string' || !DATE_RE.test(value))
        fail('must be an ISO date (YYYY-MM-DD)');
    break;
```

The check is **shape only**. `'2026-13-45'`, `'2025-02-30'`, `'0000-00-00'` and
`'9999-99-99'` all match `\d{4}-\d{2}-\d{2}` and pass.

**Why it is wrong:** the sibling `datetime` case three lines below does it
correctly — it pairs its regex with `Number.isNaN(Date.parse(value))`
(`validate-entry-values.ts:120-128`), and its comment explains that the regex
alone is insufficient. The `date` case has the same need and no such guard, so
the two date-ish types disagree about how much they check. Downstream this value
is written to a Postgres `date` column, which will reject `2026-13-45` with
`22008 datetime field value out of range` — turning a field-level 400 with a
useful message into a 500 with a driver error, or aborting a transaction that
had already done work. The unit test that looks like it covers this
(`validate-entry-values.spec.ts:128-132`, "rejects a malformed calendar date")
uses `'01-02-2026'`, which fails the **regex**, not the calendar — so the gap is
invisible from the suite.

**Repro:**
```js
validateFieldValue('publishOn', { type: 'date', required: false }, '2026-13-45');
```
→ Observed: `[]`. Expected: `[{field:'publishOn', message:'must be an ISO date (YYYY-MM-DD)'}]`.
End to end: `POST` an entry with `publishOn: '2025-02-30'` and observe the
server's response status.

**Blast radius:** every content type with a `date` field, on every write from
every surface — the admin editor, the public content API, the GraphQL adapter,
MCP tools and the copilot. The admin's date picker will not produce such a value,
but the API accepts JSON from anywhere.

**Suggested fix:** after the regex, parse and round-trip:
`const d = new Date(value + 'T00:00:00Z'); if (Number.isNaN(d.getTime()) || d.toISOString().slice(0,10) !== value) fail(...)`.
The round-trip comparison is what catches `2025-02-30`, which `Date.parse`
silently rolls forward to March 2.

### 🐞 BUG-content-domain-03 — An `Invalid Date` instance passes `datetime` validation · Severity: Low

**Location:** `packages/content/domain/src/lib/validation/validate-entry-values.ts:120-128`
**Category:** correctness

**What the code does:**

```ts
case CONTENT_FIELD_TYPE.Datetime:
    if (
        !(value instanceof Date) &&
        (typeof value !== 'string' ||
            !DATETIME_RE.test(value) ||
            Number.isNaN(Date.parse(value)))
    )
        fail('must be an ISO date-time');
    break;
```

`value instanceof Date` short-circuits the entire condition. `new Date('nope')`
**is** a `Date` instance — its internal time value is `NaN`, but the
`instanceof` test does not care — so it is accepted without any further check.

**Why it is wrong:** the string branch is careful to reject anything
`Date.parse` cannot handle; the `Date`-instance branch performs no validity
check at all, so the two paths guarantee different things. An `Invalid Date`
serialises to `null` via `JSON.stringify` and throws `RangeError` from
`.toISOString()`, so it fails loudly and confusingly somewhere further down
rather than as a field-level validation issue here.

**Repro:**
```js
validateFieldValue('publishAt', { type: 'datetime', required: false }, new Date('nonsense'));
```
→ Observed: `[]`. Expected: `must be an ISO date-time`.

**Blast radius:** limited, because values arriving over HTTP are JSON and
therefore strings — a `Date` instance can only appear when a caller constructs
one first. That does happen: `class-transformer`'s `@Type(() => Date)` and any
in-process caller (the copilot's write path, an MCP tool handler, a seed script)
can hand a `Date` straight in. Low severity, one-line fix.

**Suggested fix:** `!(value instanceof Date && !Number.isNaN(value.getTime()))`.

### 🐞 BUG-content-domain-04 — `minLength`/`maxLength` count UTF-16 code units, so an emoji costs two characters · Severity: Low

**Location:** `packages/content/domain/src/lib/validation/validate-entry-values.ts:91-94`
**Category:** correctness

**What the code does:**

```ts
if (v.minLength !== undefined && value.length < v.minLength)
    fail(`must be at least ${v.minLength} characters`);
if (v.maxLength !== undefined && value.length > v.maxLength)
    fail(`must be at most ${v.maxLength} characters`);
```

`String.prototype.length` is a UTF-16 code-unit count, not a character count.

**Why it is wrong:** the user-facing message says "characters", and a CMS field
is exactly where non-BMP characters show up — emoji in a title, CJK text with
variation selectors, or a combining accent. `'👍'.length === 2`, so a
`maxLength: 1` field rejects a single emoji with "must be at most 1
characters"; a family emoji (`👨‍👩‍👧‍👦`) is 11. Conversely a `minLength: 3`
field accepts a single 2-code-unit emoji plus one letter as "3 characters".
The kernel is the one place both runtimes agree on this rule, so the admin's
character counter (if it uses the same measure) and the server will at least be
consistently wrong — but both will be wrong in front of the author.

**Repro:**
```js
validateFieldValue('title', { type: 'text', required: true, validation: { maxLength: 1 } }, '👍');
```
→ Observed: `[{field:'title', message:'must be at most 1 characters'}]`.
Expected (per the message's own wording): no issue.

**Blast radius:** authors writing non-Latin or emoji content in any length-
constrained field. Cosmetic in the common case, genuinely blocking for CJK/emoji
titles under tight limits.

**Suggested fix:** count with `[...value].length` (code points) or an
`Intl.Segmenter` grapheme count, and say which unit the message means. Whatever
is chosen must match what `content-admin` shows in its counter.

### 🐞 BUG-content-domain-05 — `money` is validated as an IEEE-754 double with no scale or currency rule · Severity: Low

**Location:** `packages/content/domain/src/lib/validation/validate-entry-values.ts:99-112`
(`case CONTENT_FIELD_TYPE.Money` shares the `Number` branch verbatim)
**Category:** correctness

**What the code does:** a `money` value is accepted if
`typeof value === 'number' && !Number.isNaN(value)`, then checked against the
same optional `integer` / `min` / `max` rules as a plain number. There is no
scale (decimal-places) rule, no currency, and no fixed-point representation.

**Why it is wrong:** the kernel gives `money` its own field-type identifier
(`field-type.ts:15`) — a deliberate statement that it is not just a number —
and then applies literally the same rules. `19.99` cannot be represented exactly
as a double; `0.1 + 0.2 !== 0.3` applies to any consumer that sums these values.
Nothing constrains a value to two decimal places, so `19.999999` and
`1e21` are both accepted, and nothing records the currency, so `100` is
ambiguous between $1.00 (minor units) and $100.00. Because this is the **shared
kernel**, whatever it decides binds both runtimes and the public API's wire
format — a later change to a minor-unit integer or a decimal string is a
breaking change to stored data.

**Repro:**
```js
validateFieldValue('price', { type: 'money', required: false }, 0.1 + 0.2);
```
→ Observed: `[]` for `0.30000000000000004`. Expected: either a scale rule
rejecting it, or a documented decision that `money` is a plain float.

**Blast radius:** any content type with a `money` field. No immediate failure,
but it is the kind of modelling decision that is very expensive to reverse once
entries exist — which is precisely why it is worth raising while the type is
young.

**Suggested fix:** decide now — either give `money` a `scale` rule (default 2)
enforced here, plus a currency member on the spec; or drop the distinct type and
call it a number. Do not leave a type named `Money` with number semantics.

### 🐞 BUG-content-domain-06 — An author-supplied `pattern` is compiled and run with no complexity bound (ReDoS) · Severity: Low

**Location:** `packages/content/domain/src/lib/validation/validate-entry-values.ts:38-46,95-96`
**Category:** perf

**What the code does:**

```ts
const patternCache = new Map<string, RegExp>();
function compiledPattern(pattern: string): RegExp {
    let re = patternCache.get(pattern);
    if (!re) { re = new RegExp(pattern); patternCache.set(pattern, re); }
    return re;
}
…
if (v.pattern && !compiledPattern(v.pattern).test(value))
```

An arbitrary regex source from the field spec is compiled and executed against
caller-supplied input, on the main thread, with no timeout and no
catastrophic-backtracking check.

**Why it is wrong:** a pattern such as `^(a+)+$` or `^(\w+\s?)*$` against a
crafted ~30-character input takes exponential time. Because this code runs in
**both** runtimes, the same pattern hangs the Node event loop on the server
(blocking every other request in the process) and freezes the admin tab on the
client. `new RegExp(pattern)` will also throw `SyntaxError` on an invalid
pattern — that exception is **not caught**, so it escapes `validateFieldValue`
as an unhandled error rather than a validation issue.

**Repro:**
1. Define a field `{ type: 'text', validation: { pattern: '^(a+)+$' } }`.
2. `validateFieldValue('f', spec, 'a'.repeat(30) + 'X')`.
→ Observed: the call does not return in reasonable time.
3. Separately: `{ validation: { pattern: '(' } }` with any value → `SyntaxError:
Invalid regular expression` thrown out of the validator.

**Blast radius:** **Low, because content types are code-defined** — the pattern
comes from a registry file a developer edits, not from a UI or an API, so the
"attacker" is someone who already commits code. It is filed anyway because
(a) the `SyntaxError` path is a plain bug reachable by a typo, (b) `content/admin`
receives the pattern over the wire from `GET /content-schema` and compiles it
client-side, widening the trust boundary by one hop, and (c) if content types
ever become author-editable this silently becomes a High.

**Suggested fix:** wrap `new RegExp` in a try/catch that turns a bad pattern
into a validation issue (or a startup-time registry error), and validate pattern
safety at registry-load time — a linear-time matcher or a
`safe-regex`-style check — rather than per value.

### 🐞 BUG-content-domain-07 — The `many` branch inside the `Relation` case is unreachable dead code · Severity: Low

**Location:** `packages/content/domain/src/lib/validation/validate-entry-values.ts:71-76` vs `150-162`
**Category:** correctness (dead code)

**What the code does:** the function returns early for any link-managed
relation:

```ts
if (
    spec.type === CONTENT_FIELD_TYPE.Relation &&
    (spec.relation?.many || spec.relation?.inverse)
) {
    return issues;
}
```

but the `Relation` case in the switch still branches on exactly that condition:

```ts
case CONTENT_FIELD_TYPE.Relation: {
    if (spec.relation?.many) {
        if (!Array.isArray(value) || value.some(…))
            fail('must be an array of entry ids');
    } else if (typeof value !== 'string' || !UUID_RE.test(value)) {
        fail('must be an entry id');
    }
    break;
}
```

`spec.relation?.many` is guaranteed falsy by the time the switch runs, so the
`if` branch and its `'must be an array of entry ids'` message can never execute.

**Why it is wrong:** it is not a behavioural defect — the early return is the
intended semantics and the unit test confirms it
(`validate-entry-values.spec.ts:146-150`) — but the dead branch is actively
misleading. A reader (or an agent) modifying the file sees an apparently-live
rule for many-relations and may reason from it; the unreachable message
`'must be an array of entry ids'` is also a string a consumer might grep for and
expect to encounter. Dead code that looks like a rule is how the early return
gets accidentally weakened later.

**Repro:** `grep -n "must be an array of entry ids" packages/content/domain/src`
→ one hit, at `validate-entry-values.ts:158`; no test asserts it, and no input
can produce it.

**Blast radius:** none at runtime. Maintenance hazard only.

**Suggested fix:** delete the `if (spec.relation?.many)` branch, leaving the
owning-single check, and reference the early return in a comment.

### Checked and cleared

- **The one hard rule (ADR-0003 purity).** Verified two ways:
  `packages/content/domain/package.json` declares **no** dependency block of any
  kind, and `grep -rn "from '" packages/content/domain/src --include=*.ts |
  grep -v "from '\."` returns nothing — every import in the package is
  relative. No `@nestjs/*`, no `drizzle-orm`, no `react`, no `class-validator`,
  no `node:` builtins. This package genuinely is what it claims to be, and it is
  the only one of the six units in this batch where the layering rule is
  perfectly kept. Note that this is **not** lint-enforced — ADR-0003 lists the
  boundary rule as follow-up work
  (`docs/adr/0003-tactical-ddd-inside-plugins.md:127-131`) — so it holds by
  discipline alone.
- **Value-object invariants.** There are, strictly, no value-object *classes*
  here — the kernel is functions over plain data, which is a legitimate reading
  of ADR-0003 for a shared kernel. `ENTRY_STATUS`, `CONTENT_FIELD_TYPE` and
  `ENTRY_STATUS_TRANSITIONS` are `as const` / `Readonly<>` objects, so they are
  compile-time immutable; `ENTRY_STATUS_TRANSITIONS` is additionally not
  exported. None is `Object.freeze`d, so a determined consumer could mutate
  `ENTRY_STATUS` at runtime — noted, not filed, since it requires a cast and no
  consumer does it.
- **Purity of the functions.** `validateEntryValues`, `validateFieldValue`,
  `canPublish`, `canTransition` and `isEmptyFieldValue` mutate none of their
  arguments — verified by reading each; the only writes are to locally-created
  `issues` arrays. The single piece of module-level state is `patternCache`,
  which holds compiled `RegExp`s keyed by pattern source and no request data.
- **Tenant isolation.** Structurally impossible to violate — the package has no
  workspace concept, no identifiers, and no I/O.
- **Message stability.** The exact issue strings (`'is required'`,
  `'must be an entry id'`, `'must be a media asset id'`,
  `'unknown field on "X"'`) are asserted verbatim by the unit suite and are the
  strings surfaced to API clients, so a wording change is a contract change.
  Worth noting because the AGENTS.md claims this was a *behaviour-preserving*
  extraction from the server's original `EntryValidationService`.
- **`0`/`false` handling.** The classic falsy-value bug is explicitly guarded in
  `isEmptyFieldValue` (`field-type.ts:37-44`) and explicitly tested
  (`validate-entry-values.spec.ts:87-95`). Clean.

**Defect tally:** `7 🐞 · 0 Critical · 0 High · 2 Medium · 5 Low · 1 🔒`

**Accessibility tally:** `3 ♿ · 0 Supports · 1 Partially Supports · 2 Does Not Support · 4 Not Applicable provisions`
No axe or keyboard coverage applies — there is no rendered surface. The three
findings are **504 Authoring Tools** modelling gaps, which no UI-level test can
detect.

## 7. Recommended E2E Tests

Everything here is a **unit** test — this package cannot be reached by an e2e
harness directly. The two e2e rows at the bottom exist to pin the *delegation*,
which is where the kernel's guarantees actually become real.

| Priority | Harness | Proposed spec | Asserts | Closes |
| --- | --- | --- | --- | --- |
| 1 | Unit (`packages/content/domain`) | `validation/validate-entry-values.spec.ts` (new case) | `{toString:1, constructor:2, __proto__:3}` with `rejectUnknownKeys:true` yields three unknown-field issues | 🐞 BUG-content-domain-01, EC-20 |
| 2 | Unit | `validation/validate-entry-values.spec.ts` (new cases) | `'2026-13-45'`, `'2025-02-30'`, `'0000-00-00'` are rejected by the `date` rule | 🐞 BUG-content-domain-02, EC-12 |
| 3 | `apps/server-e2e` | `content/content-entries-write.spec.ts` (new case) | `POST` an entry with `date: '2025-02-30'` returns **400** with a field-level message, not 500 | 🐞 BUG-content-domain-02 end-to-end |
| 4 | Unit | `validation/validate-entry-values.spec.ts` (new case) | `new Date('nonsense')` is rejected by the `datetime` rule | 🐞 BUG-content-domain-03, F14 |
| 5 | Unit | `validation/validate-entry-values.spec.ts` (new file section) | The whole `multiselect` type: valid subset, non-member, bare string, empty array, duplicates | F16 ❌ |
| 6 | Unit | `validation/validate-entry-values.spec.ts` (new cases) | `json` accepts object/array/scalar; `{}` satisfies `required` but `[]` does not | F17 ❌, EC-04 |
| 7 | Unit | `validation/validate-entry-values.spec.ts` (new cases) | Every boundary: `minLength`/`maxLength`/`min`/`max` exactly at the bound; `NaN`, `Infinity`, `'5'` in a number field | F11/F12 ⚠️, EC-06, EC-07, EC-10 |
| 8 | Unit | `validation/validate-entry-values.spec.ts` (new case) | Emoji length semantics are pinned in whichever direction the team chooses | 🐞 BUG-content-domain-04, EC-13 |
| 9 | Unit | `validation/validate-entry-values.spec.ts` (new case) | An invalid `pattern` source yields a validation issue rather than throwing `SyntaxError` | 🐞 BUG-content-domain-06 |
| 10 | Unit | `status/entry-status.spec.ts` (new case) | `canTransition('archived','draft')` is `false` and does not throw | F5 ❌ |
| 11 | Unit | `validation/validate-entry-values.spec.ts` (new case) | Issue ordering: unknown keys precede field issues, and field issues follow schema order | F23 ❌ |
| 12 | Unit | `validation/publish-gate.spec.ts` (new case) | `canPublish` ignores unknown keys, documenting the deliberate divergence from the server's `rejectUnknownKeys` write check | EC-30, F25 |
| 13 | Lint / CI | an ESLint module-boundary rule (per ADR-0003 follow-up) | `packages/content/domain` imports nothing non-relative — a CI failure, not a review catch | F26 ❌ |
| 14 | `apps/server-e2e` | `content/content-entries-write.spec.ts` (new case) | The exact kernel messages (`'is required'`, `'must be an entry id'`) reach the HTTP 400 body unchanged, proving the delegation is live | Message-stability risk in "Checked and cleared" |
