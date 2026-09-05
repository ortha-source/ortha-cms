# Package dossiers

A combined technical and business description of every package in the monorepo: what it is
for and why it exists, the data model, the HTTP API, the admin screens, the invariants and a
testing checklist.

Written to serve as the basis for QA runs and for admin- and product-facing documentation.
The source of every claim is the **source code** as it stood when the dossier was written;
the `AGENTS.md` files were used as a skeleton, but each claim was checked against the
implementation. Discrepancies found along the way are collected in the last section of each
dossier.

Every file is a self-contained HTML page (styles and fonts inline, dark and light themes).
Double-click to open it locally; the published copy lives at the link in the table.

## Contents

| Package          | File                                           | Published                                                            |
| ---------------- | ---------------------------------------------- | -------------------------------------------------------------------- |
| identity         | [identity.html](identity.html)                 | https://claude.ai/code/artifact/79be4062-536f-4c33-bd49-3cd9d475aa10 |
| users            | [users.html](users.html)                       | https://claude.ai/code/artifact/81665627-b6d7-445b-ad7f-a9699a0917f6 |
| workspaces       | [workspaces.html](workspaces.html)             | https://claude.ai/code/artifact/ff977394-5f42-40d0-b41a-fce58dbf0f3d |
| api-tokens       | [api-tokens.html](api-tokens.html)             | https://claude.ai/code/artifact/49dc2d4d-3a95-4153-bd05-833c8d0e972d |
| segments         | [segments.html](segments.html)                 | https://claude.ai/code/artifact/19c60450-4e7b-479a-bf98-17e954501c75 |
| activity         | [activity.html](activity.html)                 | https://claude.ai/code/artifact/eaaa29f4-efe1-4526-a710-adc0f652387c |
| content          | [content.html](content.html)                   | https://claude.ai/code/artifact/0eb1f888-8867-459b-bdf0-04a2519cdcd5 |
| media            | [media.html](media.html)                       | https://claude.ai/code/artifact/8bd342b7-0246-491c-8110-2ee4a48378e7 |
| i18n             | [i18n.html](i18n.html)                         | https://claude.ai/code/artifact/443da988-fbef-4514-9f0a-469422822688 |
| wysiwyg          | [wysiwyg.html](wysiwyg.html)                   | https://claude.ai/code/artifact/eeec8589-a8c7-4b00-b4eb-c626ad4411d9 |
| alarms           | [alarms.html](alarms.html)                     | https://claude.ai/code/artifact/b583aa19-d7c9-4125-89c1-bb673067d1c0 |
| transfer         | [transfer.html](transfer.html)                 | https://claude.ai/code/artifact/7104b80d-780b-428e-8fa8-2dc6f58ca7c7 |
| copilot          | [copilot.html](copilot.html)                   | https://claude.ai/code/artifact/e040daef-6ee5-4d01-9955-df276a426856 |
| tools            | [tools.html](tools.html)                       | https://claude.ai/code/artifact/f70d21fc-436b-4768-aea0-06704400f71f |
| mcp              | [mcp.html](mcp.html)                           | https://claude.ai/code/artifact/fb53de0a-9a7d-4fe2-82d9-0cd0b6a40f1f |
| webhooks         | [webhooks.html](webhooks.html)                 | https://claude.ai/code/artifact/adde62cf-fb40-43c2-b98e-1749446afdd9 |
| shell            | [shell.html](shell.html)                       | https://claude.ai/code/artifact/c5f4cf7e-ce93-461a-a030-98f9e5e3a375 |
| design-system    | [design-system.html](design-system.html)       | https://claude.ai/code/artifact/bcc102c8-30f2-4e47-95ae-30fafd45ecdf |
| insights         | [insights.html](insights.html)                 | https://claude.ai/code/artifact/bed1f0c0-d7bc-412c-bbc7-52aad1985508 |
| query-builder    | [query-builder.html](query-builder.html)       | https://claude.ai/code/artifact/0e6368ea-6d2c-41b9-8441-f8f448f2c471 |
| bootstrap        | [bootstrap.html](bootstrap.html)               | https://claude.ai/code/artifact/050ff5cd-78f6-4e21-b753-3cda5f56a9ef |
| database         | [database.html](database.html)                 | https://claude.ai/code/artifact/fbdbcab1-23e6-4ff6-ad4e-92f0ae88c6f2 |
| utils            | [utils.html](utils.html)                       | https://claude.ai/code/artifact/f2904b42-c33e-4e10-acdc-d088c9924231 |
| nx               | [nx.html](nx.html)                             | https://claude.ai/code/artifact/366fe839-9945-4461-9717-53bdfa0afb1a |
| cli              | [cli.html](cli.html)                           | https://claude.ai/code/artifact/40c5084d-6a32-4c4a-9b8a-49c3b02bf82f |
| create-ortha-app | [create-ortha-app.html](create-ortha-app.html) | https://claude.ai/code/artifact/3d9ece77-a7d1-4ee8-b253-7aab9cfac89a |

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
reading the source, not from a live stack.

**Re-checked 2026-09-05, against the code rather than against the previous pass.** This
section had itself gone stale: it was quoted as a summary of what is wrong with the system
while three of its findings had already been fixed, and one of those was fed to a triage agent
as context and would have produced a false verdict. A finding that is repaired gets struck
from here in the same commit as the repair — this section is not an archive.

**The root documentation has fallen behind the code.** Still true, in every particular.
`ARCHITECTURE.md`, `CONTEXT-MAP.md` and ADR-0002 claim that `database` owns no schema (it owns
`outbox_events` and **three** migrations); the `ServerPlugin` contract is shown with four
fields, without its fifth, `docs`; "the Content Library defines five slots" — there are 14;
the session is called a "signed token" (it is opaque and unsigned, and the same file describes
the cookie correctly forty lines earlier); §8 denies that a content model and an LLM
integration exist, and also denies the queue/worker and the media library. Found by the
`bootstrap`, `database` and `workspaces` dossiers.

**Workspace deletion is now swept, with one real remainder.** Five packages implement
`WorkspacePurger`: `media`, the local `ApiTokenGrantsPurger`, `alarms`
(`alarm_rules` + `alarm_findings`), `segments` (`entry_access`) and `content`
(`content_entry_revisions`). `workspace-delete-residue.spec.ts` asserts all thirteen tables —
six cascading, seven purged — count zero after a delete. Two things survive a deletion, and
only one is a defect: `webhook_endpoint_workspaces` has no foreign key, registers no purger,
and is not in the sweep; `segments.workspace_ids` keeps the dead id **deliberately**, because
an empty `workspace_ids` means "every workspace" and pruning the last id would widen who may
read. Found by the `workspaces`, `alarms` and `webhooks` dossiers.

**The filter grammar is duplicated, though the copies no longer disagree.** The operator
dictionary still exists in two copies that nothing keeps in sync (`utils-server`'s
`FilterOperator` and `query-builder-admin/wireOp.ts`'s `WIRE_OP`) — thirteen operators each,
currently identical, with no executable parity test to keep them that way. The `like` gap in
the client-side reverse mapping is **fixed**: `WIRE_TO_UI` now maps all thirteen, and carries a
comment describing the silent filter-widening it used to cause. `FILTER_MAX_LENGTH` is still
duplicated across four packages (4096/4096/4096/8192), while the engine itself still imposes no
string-length limit at all — it budgets nodes, depth, group depth and IN-list length, and
nothing else. Found by the `query-builder` and `utils` dossiers.

**Nine ADRs are implemented but still sit in status `Proposed`** — 0003, 0004, 0005, 0006,
0007, 0009, 0010, 0011 and 0013; the copilot ones despite two shipped providers. Separately,
`packages/identity/provider-oidc/AGENTS.md` and `provider-saml/AGENTS.md` reference
`0012-sso-provider-port.md`, which does not exist: 0012 is the storage-provider ADR, and the
SSO port is described in ADR-0013. (Those two are package `AGENTS.md` files, not ADRs — an
earlier version of this section counted them as such and arrived at "five".)

**The first-run experience breaks in one place, not three.** The generated app's README still
does not work literally: drizzle-kit resolves `schema` and `out` from the cwd rather than from
the config file, and the CLI runs it from the project root, so `out: ../../migrations` walks
two levels above the root (the correct target is `<root>/migrations`, which the template's own
plugin comment already uses). The same file also still points at the pre-`apps/` layout
(`src/server/plugins.ts` for `apps/server/src/plugins.ts`), and nothing tests its contents —
only that it exists. The other two are **fixed**: `ortha --help`, `-h`, bare `help` and empty
argv all print usage and exit 0 before the project root is even looked up, with regression
tests in `args.spec.ts` and `cli.spec.ts`; and `npm test` in a freshly created app is green —
`EXPECTED_PLUGINS` carries `content-views` and `webhooks` on both halves, and
`composition.spec.ts` now derives the expected names from the packages that define each factory
instead of grepping the template against itself, so a plugin added to `plugins.ts` and not to
the spec fails there.

**Operating the outbox.** There is still no cleanup of `outbox_events` — dispatched rows are
stamped, never deleted, and the schema comment says so outright ("a table nothing prunes").
After 15 attempts (≈33 minutes of doubling backoff, capped at five minutes) an event is parked
until an operator clears its `attempts`. It is no longer only findable with SQL:
`OutboxDispatcher.deadLetters()` backs `GET /api/activity/dead-letters` (gated on
`activity:read`), surfaced in the admin as the activity log's `DeadLetterNotice`.

**A package's manifest is not the package a consumer installs.** Six dossiers describe a
package as dependency-free, and every one of them is reading the checked-in `package.json`.
`tools/release/pack.mjs` writes `tslib` into every staged manifest — unconditionally, because
`importHelpers` is on workspace-wide and the emitted JS reaches for the helper runtime whether
or not the source ever mentions it. So `npm i @orthacms/media-provider-s3` fetches four
packages, and `npx create-ortha-app` — whose empty `dependencies` field is a deliberate choice
about how long the very first command takes — fetches two. The gap is a few kilobytes and a
whole sentence, and nothing pinned it: `tslib` appeared in `pack.spec.ts` only as a fixture
value. Now pinned by "pack.mjs, resolving what a package depends on" (three cases,
mutation-proved), and four invariants — `content:I-37`, `identity:I-27`, `media:I-34`,
`segments:I-38` — say `declares` where they said `has`. `copilot`'s wording ("no
`dependencies` block at all") was already exact. Found by the `media` dossier, then swept.

## Updating

The file here and the published page are independent copies. After editing the HTML, republish
the page at its own link (for Claude Code: pass the URL from the table), otherwise you get a
second artifact instead of an updated one.
