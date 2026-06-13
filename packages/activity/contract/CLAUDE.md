# @ortha-cms/activity-contract

The **contract** package for the audit-log feature: a tiny, dependency-light
module shared by the emit-side, the read API, and the admin renderer. It exists
to keep the package graph **acyclic**.

## Why it exists

`@ortha-cms/activity-server`'s read controller imports identity's guard, so
`activity-server → identity-server`. Instrumenting identity's own login/logout
needs `identity-server → activity-server` — a cycle. This package breaks it:
both servers (and the admin) depend only on **this**, never on each other for
the audit contract.

```
activity-contract  (kinds + meta + recorder port/token — no Nest, no cycle)
   ▲          ▲            ▲
identity-server  activity-server  activity-admin
```

- `identity-server` injects the `ACTIVITY_RECORDER` token (with `@Optional()`),
  never `activity-server`.
- `activity-server`'s `ActivityService` **implements** `ActivityRecorder` and
  binds it to the token in its global module.
- `activity-admin` imports only the catalogue/types for rendering.

## Key exports

- `ACTIVITY_KINDS` / `ActivityKind` / `ACTIVITY_KIND_VALUES` — the single source
  of truth for the event catalogue.
- `ActivityMetaMap` / `ActivityMeta` — the per-kind shape of the `meta` column.
- `ActivityRecordInput` — a per-kind discriminated record shape (meta is
  type-checked against the chosen `kind`).
- `ActivityRecorder` (port) + `ACTIVITY_RECORDER` (DI token) + `ActivityExecutor`
  (`Pick<Database, 'insert'>`, so callers pass a transaction).

## Conventions

- Pure TS — **no** NestJS, no React. The only dependency is a **type-only**
  import of `Database` from `@ortha-cms/database` (erased at build, so the admin
  bundle never pulls it at runtime).
- `type`/`interface` contracts with JSDoc on every export; 4-space, single quotes.

## Commands

- `npx nx typecheck @ortha-cms/activity-contract`
- `npx nx lint @ortha-cms/activity-contract`
