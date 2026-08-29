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

| Package | File | Published |
| --- | --- | --- |
| identity | [identity.html](identity.html) | https://claude.ai/code/artifact/79be4062-536f-4c33-bd49-3cd9d475aa10 |
| users | [users.html](users.html) | https://claude.ai/code/artifact/81665627-b6d7-445b-ad7f-a9699a0917f6 |
| workspaces | [workspaces.html](workspaces.html) | https://claude.ai/code/artifact/ff977394-5f42-40d0-b41a-fce58dbf0f3d |
| api-tokens | [api-tokens.html](api-tokens.html) | https://claude.ai/code/artifact/49dc2d4d-3a95-4153-bd05-833c8d0e972d |
| segments | [segments.html](segments.html) | https://claude.ai/code/artifact/19c60450-4e7b-479a-bf98-17e954501c75 |
| activity | [activity.html](activity.html) | https://claude.ai/code/artifact/eaaa29f4-efe1-4526-a710-adc0f652387c |
| content | [content.html](content.html) | https://claude.ai/code/artifact/0eb1f888-8867-459b-bdf0-04a2519cdcd5 |
| media | [media.html](media.html) | https://claude.ai/code/artifact/8bd342b7-0246-491c-8110-2ee4a48378e7 |
| i18n | [i18n.html](i18n.html) | https://claude.ai/code/artifact/443da988-fbef-4514-9f0a-469422822688 |
| wysiwyg | [wysiwyg.html](wysiwyg.html) | https://claude.ai/code/artifact/eeec8589-a8c7-4b00-b4eb-c626ad4411d9 |
| alarms | [alarms.html](alarms.html) | https://claude.ai/code/artifact/b583aa19-d7c9-4125-89c1-bb673067d1c0 |
| transfer | [transfer.html](transfer.html) | https://claude.ai/code/artifact/7104b80d-780b-428e-8fa8-2dc6f58ca7c7 |
| copilot | [copilot.html](copilot.html) | https://claude.ai/code/artifact/e040daef-6ee5-4d01-9955-df276a426856 |
| tools | [tools.html](tools.html) | https://claude.ai/code/artifact/f70d21fc-436b-4768-aea0-06704400f71f |
| mcp | [mcp.html](mcp.html) | https://claude.ai/code/artifact/fb53de0a-9a7d-4fe2-82d9-0cd0b6a40f1f |
| shell | [shell.html](shell.html) | https://claude.ai/code/artifact/c5f4cf7e-ce93-461a-a030-98f9e5e3a375 |
| design-system | [design-system.html](design-system.html) | https://claude.ai/code/artifact/bcc102c8-30f2-4e47-95ae-30fafd45ecdf |
| insights | [insights.html](insights.html) | https://claude.ai/code/artifact/bed1f0c0-d7bc-412c-bbc7-52aad1985508 |
| query-builder | [query-builder.html](query-builder.html) | https://claude.ai/code/artifact/0e6368ea-6d2c-41b9-8441-f8f448f2c471 |
| bootstrap | [bootstrap.html](bootstrap.html) | https://claude.ai/code/artifact/050ff5cd-78f6-4e21-b753-3cda5f56a9ef |
| database | [database.html](database.html) | https://claude.ai/code/artifact/fbdbcab1-23e6-4ff6-ad4e-92f0ae88c6f2 |
| utils | [utils.html](utils.html) | https://claude.ai/code/artifact/f2904b42-c33e-4e10-acdc-d088c9924231 |
| nx | [nx.html](nx.html) | https://claude.ai/code/artifact/366fe839-9945-4461-9717-53bdfa0afb1a |
| cli | [cli.html](cli.html) | https://claude.ai/code/artifact/40c5084d-6a32-4c4a-9b8a-49c3b02bf82f |
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

Problems that surfaced independently in several dossiers. They need to be checked against a
live stack — every conclusion here comes from reading the source, the stack was never brought
up.

**The root documentation has fallen behind the code.** `ARCHITECTURE.md`, `CONTEXT-MAP.md`
and ADR-0002 claim that `database` owns no schema (it does — `outbox_events` and two
migrations); the `ServerPlugin` contract is shown without its `docs` field; "the Content
Library defines five slots" — there are 14; the session is called a "signed token" (it is
opaque and unsigned); §8 denies that a content model and an LLM integration exist. Found by
the `bootstrap`, `database` and `workspaces` dossiers.

**Only `media` and `api-tokens` implement `WorkspacePurger`.** Rows in `alarm_rules`,
`alarm_findings`, `entry_access` and `segments.workspace_ids` survive the deletion of a
workspace. Found by the `workspaces` and `alarms` dossiers.

**The filter grammar is duplicated and the copies have diverged.** The operator dictionary
exists in two copies that nothing keeps in sync (`utils-server` and
`query-builder-admin/wireOp.ts`); the `like` operator is missing from the client-side reverse
mapping table and is silently lost when a tree is lifted out of the URL. `FILTER_MAX_LENGTH`
is duplicated across four packages (4096/4096/4096/8192), while the engine itself imposes no
string-length limit at all. Found by the `query-builder` and `utils` dossiers.

**Five ADRs are implemented but still sit in status `Proposed`** — 0003, 0006, 0007, 0011;
plus `identity-provider-oidc` and `identity-provider-saml` reference a file that does not
exist, `0012-sso-provider-port.md` (the SSO port is described in ADR-0013).

**The first-run experience breaks in three places.** `ortha --help` and `ortha -h` return
`Unknown command` with exit code 1 (argv[0] is always treated as a command name); the "how to
add a content type" instructions in the generated app's README do not work literally (paths
resolve from the cwd, and `out: ../../migrations` walks above the project root); `npm test` in
a freshly created app is red — `EXPECTED_PLUGINS` does not include `content-views`, and the
scaffolder's own tests miss it because they grep the template text instead of executing its
specs.

**Operating the outbox.** There is no cleanup of `outbox_events` and no dead-letter tooling —
after 15 attempts (≈33 minutes) an event is parked forever and can only be found with a SQL
query.

## Updating

The file here and the published page are independent copies. After editing the HTML, republish
the page at its own link (for Claude Code: pass the URL from the table), otherwise you get a
second artifact instead of an updated one.
