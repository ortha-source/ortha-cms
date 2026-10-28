# Package dossiers

A combined technical and business description of every package in the monorepo: what it is
for and why it exists, the data model, the HTTP API, the admin screens, the invariants and a
testing checklist.

Written to serve as the basis for QA runs and for admin- and product-facing documentation.
The source of every claim is the **source code** as it stood when the dossier was written;
the `AGENTS.md` files were used as a skeleton, but each claim was checked against the
implementation. Discrepancies found along the way are collected in the last section of each
dossier.

Every file is Markdown, so a dossier is read, searched and diffed with the same tools as
the code it describes. They were authored as self-contained HTML pages and converted in
place; the published HTML copies that used to be linked here are no longer maintained and
will diverge from these.

## Contents

| Package             | File                                             |
| ------------------- | ------------------------------------------------ |
| identity            | [identity.md](identity.md)                       |
| users               | [users.md](users.md)                             |
| workspaces          | [workspaces.md](workspaces.md)                   |
| api-tokens          | [api-tokens.md](api-tokens.md)                   |
| segments            | [segments.md](segments.md)                       |
| activity            | [activity.md](activity.md)                       |
| content             | [content.md](content.md)                         |
| media               | [media.md](media.md)                             |
| i18n                | [i18n.md](i18n.md)                               |
| wysiwyg             | [wysiwyg.md](wysiwyg.md)                         |
| alarms              | [alarms.md](alarms.md)                           |
| protection          | [protection.md](protection.md)                   |
| schema-builder      | [schema-builder.md](schema-builder.md)           |
| transfer            | [transfer.md](transfer.md)                       |
| copilot             | [copilot.md](copilot.md)                         |
| tools               | [tools.md](tools.md)                             |
| mcp                 | [mcp.md](mcp.md)                                 |
| webhooks            | [webhooks.md](webhooks.md)                       |
| mail                | [mail.md](mail.md)                               |
| inbox               | [inbox.md](inbox.md)                             |
| shell               | [shell.md](shell.md)                             |
| design-system       | [design-system.md](design-system.md)             |
| insights            | [insights.md](insights.md)                       |
| query-builder       | [query-builder.md](query-builder.md)             |
| bootstrap           | [bootstrap.md](bootstrap.md)                     |
| database            | [database.md](database.md)                       |
| utils               | [utils.md](utils.md)                             |
| nx                  | [nx.md](nx.md)                                   |
| cli                 | [cli.md](cli.md)                                 |
| create-orthacms-app | [create-orthacms-app.md](create-orthacms-app.md) |

## Structure of a dossier

Sections a package does not have are dropped; package-specific ones are added (the storage
adapter matrix in `media`, the `canRead` truth table in `segments`, the tool registry in
`tools`, the event-kind catalogue in `activity`).

1. Business description — why, for whom, what the value is, what it is **not**
2. Composition of the package group
3. Roles and permissions
4. Data model — tables, columns, constraints, migrations
5. Lifecycle of the key entity
6. Step-by-step flows — with the reasoning for "why it was done this way"
7. HTTP API — method, path, guard, input, success, failures
8. Admin UI — routes, screens, states, slots, accessibility
9. Configuration
10. Security and resilience
11. Invariants `I-01…` — usable as assertions for tests
12. Testing checklist — "action → expected result"
13. Boundaries of responsibility
14. Discrepancies between code and documentation

## Cross-cutting findings

Problems that surfaced independently in several dossiers. Every conclusion here comes from
reading the source, not from a live stack. A finding that is repaired gets struck from here in
the same commit as the repair — this section is not an archive. Re-checked 2026-10-14; the
stale root documents, the ADR statuses, the outbox's missing cleanup and the dangling
ADR-0004/0005 references it used to list are all fixed and gone from it.

**Workspace deletion is swept, and what survives now survives on purpose.** Every plugin that
keeps a `workspace_id` without a cascade implements `WorkspacePurger` (media, the local
`ApiTokenGrantsPurger`, alarms, segments, content's revisions, webhooks and protection), and
`workspace-delete-residue.spec.ts` asserts that every workspace-scoped table — cascading or
purged — counts zero after a delete. A new table that nobody classified fails that spec. The
last defect closed 2026-09-05: webhooks kept its subscription rows, and fan-out re-read them on
every content write. Its own dossier had called the stale id "harmless — no event will ever
carry it again", which is true of correctness and false of everything else; that sentence is
why it outlived two rounds of the same finding.

One thing still survives a deletion, and it is **correct**: `segments.workspace_ids` keeps the
dead id, because an empty `workspace_ids` means "every workspace" and pruning the last id would
widen who may read. Webhooks looks identical and gets the opposite treatment for a reason that
is in the schema rather than in taste — `all_workspaces` is a separate boolean, so an empty set
there means "none" and a prune can only narrow. Both readings are pinned by a test that names
the other. Found by the `workspaces`, `alarms` and `webhooks` dossiers.

**The filter grammar is duplicated, and watched.** The operator dictionary exists in more than
one copy — a browser cannot drag in NestJS and Drizzle — but `operator-vocabulary-parity.spec.ts`
imports `FilterOperator`, reads `wireOp.ts` as text, and pins the third copy,
`OPERATORS_BY_TYPE`, where an operator in the vocabulary but on no type's list would pass the
unknown-operator check and then be refused on every field there is. The engine carries its own
string-length budget, `maxValueLength`, applied per element of an `in` list as well as to a
scalar, because four callers reach `parseFilterTree` without a DTO in front of them: an alarm
rule at write time and replayed out of `jsonb` by the subscriber and the sweep, the copilot's
`admin_content_search`, and GraphQL's entry loader. Found by the `query-builder` and `utils`
dossiers.

**A package's manifest is not the package a consumer installs.** A dossier that reads the
checked-in `package.json` sees what the workspace resolves, not what npm ships.
`tools/release/pack.mjs` writes `tslib` into every staged manifest — unconditionally, because
`importHelpers` is on workspace-wide and the emitted JS reaches for the helper runtime whether
or not the source ever mentions it. So `npm i @orthacms/media-provider-s3` fetches four
packages, and `npx create-orthacms-app` — whose empty `dependencies` field is a deliberate choice
about how long the very first command takes — fetches two. Pinned by "pack.mjs, resolving what
a package depends on" in `pack.spec.ts`; the invariants that state it (`content:I-37`,
`identity:I-27`, `media:I-34`, `segments:I-38`) say `declares`, not `has`. Found by the `media`
dossier, then swept.
