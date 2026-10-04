# 0020 — The schema builder writes code, and only in development

- **Status:** Accepted
- **Date:** 2026-10-04
- **Accepted:** 2026-10-04
- **Deciders:** Engineering

## Context

Content types are TypeScript. `collection()` / `single()` normalise a
declaration, `buildTables` turns it into Drizzle tables at import time, and
`ContentPlugin({ types })` builds an immutable `ContentTypeRegistry` once at
boot. Every surface derives from that registry: the entry form, the records
list and its filters, the public REST API, GraphQL, the MCP and copilot tools,
the OpenAPI document. The generated tables' migrations are **host**-owned
SQL produced by drizzle-kit and committed with the code.

That arrangement was never recorded as a decision. It lives as a rule —
content dossier `[content:I-01]`, "no HTTP route creates, changes or deletes a
type or a field" — and as a sentence in the dossier's "what content is not".

Adding a type today is three hand edits (`collections/<name>.ts`, the
`contentTypes` array, the table re-exports in `src/content/index.ts`), then
`db:generate`, `db:migrate`, a restart, and a workspace grant. People ask for a
visual builder. There are two very different products behind that request:

- a **developer** tool that edits the schema the way a developer would, and
- an **administrator** tool that changes the schema of a running production
  system, the way Directus or Contentful do.

The forces:

- The registry is fixed at boot on purpose. Drizzle `PgTable` objects are
  closed over by every query; the OpenAPI document is assembled once; GraphQL
  refuses name collisions at boot. Making the registry mutable touches some
  forty consumers and every one of those boot checks.
- A schema change is a migration. Migrations here are reviewed SQL in git.
  Running DDL from a request handler, across several instances, is a different
  operational model with its own failure modes.
- Destructive changes — dropping a field with data in it — must be visible and
  deliberate, not one click away in production.

## Decision

We will build the **developer** tool.

1. **The schema stays code.** The builder edits the TypeScript **source** of
   content types and produces an ordinary drizzle-kit migration. It never runs
   DDL of its own and never changes the registry of a running process; a
   change takes effect through the restart the dev watcher already performs.
2. **Editing is development-only.** The plugin refuses to plan or apply when
   `NODE_ENV=production` or when `SCHEMA_BUILDER` is not `true`. In production
   the same page is a read-only view of the registry.
3. **The builder owns only what it generated.** A type file it writes starts
   with `// @orthacms-generated`. A hand-written type is shown read-only, and is
   handed over by adding that line.
4. **A type is one file.** `src/content/index.ts` becomes a generated manifest
   (`content:sync`), so neither a person nor the builder edits three places.
5. **The builder offers nothing the DSL does not.** Every control maps to one
   option of `ContentTypeOptions`, `*FieldOptions` or `AdminProps`. A missing
   capability — a default value, option labels, scalar uniqueness — is added to
   the DSL first, then to the builder.
6. **One rule set.** The define-time checks move to `@orthacms/content-domain`
   as pure functions; the DSL throws the first, the builder shows all of them.
7. **The copilot proposes, never applies, a schema.** This is a deliberate
   exception to [ADR-0009](0009-copilot-applies-directly.md): a schema change
   rewrites code and the database of the whole application, not one record.
8. `[content:I-01]` is reworded: **in production** no route changes the schema;
   in development only the builder does, and only through source and a
   migration.

## Consequences

- Schema changes stay reviewable in git, as TypeScript and as SQL, and roll out
  like any other code change.
- A change takes effect after a restart; the builder waits for it rather than
  pretending the running process changed.
- drizzle-kit asks interactively whether a dropped-and-added column is a
  rename. The builder avoids the question by generating removals and additions
  as two migrations; true renames are out of scope until the builder can write
  the rename SQL itself.
- Apply is all-or-nothing: work happens in a stage outside `src/`, the
  migrations run in one transaction, and `src/content` is written once, last.
- A new type is granted to no workspace implicitly; the builder offers the
  grant through the existing workspaces API.
- Production installs cannot change their schema from the admin. That is the
  point, and the page says so.

## Alternatives considered

- **A runtime, database-held schema** (the Directus model). Rejected: it makes
  the registry mutable, needs DDL under an advisory lock and coordination
  across instances, invalidation of the GraphQL and OpenAPI caches, and turns
  schema review into an admin action. It would be a different product.
- **A builder that writes JSON the server loads at boot.** Rejected: it keeps
  the migration problem and adds a second schema format beside the DSL that
  every consumer would have to learn.
- **Editing hand-written files through an AST.** Rejected for now: preserving
  arbitrary comments and formatting is a large problem, and the ownership
  marker gives a clear, reversible line instead.
