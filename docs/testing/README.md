# Test Artifacts

One QA artifact per app and package: what it does, how to test it by hand, what the
automated suites really cover, and what looks broken. 42 units, written by reading the
source rather than the documentation, then verified a second time against the cited lines.

## How to read these

Every artifact has the same seven sections: scope and preconditions, feature inventory,
manual test plan, edge cases (including a §4A accessibility and Section 508 subsection),
e2e coverage map, suspected defects, and recommended tests.

| Marker | Meaning |
| --- | --- |
| `✅ E2E` | Asserted by an existing spec, cited by `file:line` |
| `⚠️ PARTIAL` | A spec touches it but does not assert the interesting part |
| `❌ NONE` | No automated coverage |
| `🐞 BUG-<unit>-NN` | Suspected defect, with severity, repro and blast radius |
| `♿ A11Y-<unit>-NN` | Accessibility finding, with WCAG SC, 508 provision and a VPAT verdict |
| `🔒` | Authorization, tenant-isolation or disclosure concern |
| `🧪 UNIT` | Covered by a package-level unit test |

Each artifact's header carries a **Findings verified** line recording how many of its
findings were confirmed, deleted, corrected or left unverified. A finding that opens
`Unverified —` names exactly what could not be confirmed from this repository.

## Totals

| | Count |
| --- | --- |
| Artifacts | 42 |
| Suspected defects | **273** — 3 critical · 17 high · 129 medium · 124 low |
| Marked 🔒 | 47 |
| Accessibility findings | **217** |

## Start here

Everything critical or high, most severe first.

| Severity | Finding | Unit |
| --- | --- | --- |
| **Critical** 🔒 | [`BUG-content-graphql-01`](content-graphql.md) — An ~800-byte fragment bomb wedges the server, because the cost checker itself is exponential | `content-graphql` |
| **Critical** 🔒 | [`BUG-media-server-01`](media-server.md) — Uploaded files are served inline with a client-declared MIME type and no `nosniff`, making the Media Library a stored-XSS vector on the admin origin | `media-server` |
| **Critical** | [`BUG-server-e2e-01`](app-server-e2e.md) — No CI workflow runs this suite, and the package contradicts itself about it | `app-server-e2e` |
| **High** 🔒 | [`BUG-content-graphql-02`](content-graphql.md) — Read arguments bypass the DTO validation the REST route enforces, so a token reaches further over GraphQL than over REST | `content-graphql` |
| **High** 🔒 | [`BUG-content-graphql-03`](content-graphql.md) — A variable's *default value* defeats the complexity budget | `content-graphql` |
| **High** 🔒 | [`BUG-copilot-server-01`](copilot-server.md) — the permission route never checks the parked run belongs to the caller | `copilot-server` |
| **High** 🔒 | [`BUG-identity-server-02`](identity-server.md) — Login throttling collapses to one global bucket behind a proxy (`trust proxy` is never set) | `identity-server` |
| **High** | [`BUG-admin-e2e-01`](app-admin-e2e.md) — No CI workflow runs this suite, or the drift gate the docs claim it runs | `app-admin-e2e` |
| **High** | [`BUG-api-tokens-admin-01`](api-tokens-admin.md) — A failed clipboard write is unhandled, so the one-time secret is silently and permanently lost | `api-tokens-admin` |
| **High** | [`BUG-api-tokens-admin-02`](api-tokens-admin.md) — The secret cannot be selected or read manually, so there is no fallback when Copy fails | `api-tokens-admin` |
| **High** | [`BUG-content-admin-01`](content-admin.md) — A required field the editor doesn't render is an unfillable, permanent block on save | `content-admin` |
| **High** | [`BUG-copilot-admin-01`](copilot-admin.md) — the panel's history dropdown can put two windows on one conversation, and they immediately disagree | `copilot-admin` |
| **High** | [`BUG-copilot-admin-02`](copilot-admin.md) — minimizing a window (including with Escape) drops keyboard focus on `<body>` | `copilot-admin` |
| **High** | [`BUG-database-01`](database.md) — A permanently-failing event is retried forever and blocks every newer event behind it; `attempts` is written but never read | `database` |
| **High** | [`BUG-nx-01`](nx.md) — `db:generate`'s cache inputs name a directory five of the eight schema-owning projects do not use, so a schema edit does not invalidate the cache | `nx` |
| **High** | [`BUG-query-builder-admin-01`](query-builder-admin.md) — A large `within the last` count throws `RangeError` and crashes the filter surface while the user is still typing | `query-builder-admin` |
| **High** | [`BUG-server-e2e-04`](app-server-e2e.md) — `E2E_DATABASE_URL` has no guard, and the suite TRUNCATEs whatever it names | `app-server-e2e` |
| **High** | [`BUG-users-admin-01`](users-admin.md) — Disabling a member and deleting a pending invite both fire with no confirmation and no undo | `users-admin` |
| **High** | [`BUG-workspaces-server-01`](workspaces-server.md) — Removing the last member orphans the workspace permanently | `workspaces-server` |
| **High** | [`BUG-workspaces-server-04`](workspaces-server.md) — Deleting a workspace orphans every workspace-scoped row outside content entries | `workspaces-server` |

## The artifacts

### Apps & hosts

| Artifact | Unit | 🐞 | ♿ | Verified |
| --- | --- | --- | --- | --- |
| [`app-server`](app-server.md) | `apps/server` | 4 | 2 | 1 confirmed · 0 deleted · 3 corrected · 1 unverified |
| [`app-admin`](app-admin.md) | `apps/admin` | 3 | 7 | 6 confirmed · 0 deleted · 4 corrected · 1 unverified |
| [`bootstrap-server`](bootstrap-server.md) | `packages/bootstrap/server` | 5 | 1 | 2 confirmed · 0 deleted · 3 corrected · 1 unverified |
| [`bootstrap-admin`](bootstrap-admin.md) | `packages/bootstrap/admin` | 5 | 7 | 11 confirmed · 0 deleted · 1 corrected · 0 unverified |

### Test harnesses

| Artifact | Unit | 🐞 | ♿ | Verified |
| --- | --- | --- | --- | --- |
| [`app-server-e2e`](app-server-e2e.md) | `apps/server-e2e` | 15 (1C/1H) | 5 | 15 confirmed · 0 deleted · 8 corrected · 2 unverified |
| [`app-admin-e2e`](app-admin-e2e.md) | `apps/admin-e2e` | 16 (1H) | 14 | 27 confirmed · 1 deleted · 14 corrected · 3 unverified |

### Foundations

| Artifact | Unit | 🐞 | ♿ | Verified |
| --- | --- | --- | --- | --- |
| [`database`](database.md) | `packages/database` | 5 (1H) | 0 | 3 confirmed · 0 deleted · 1 corrected · 1 unverified |
| [`utils-server`](utils-server.md) | `packages/utils/server` | 3 | 0 | 3 confirmed · 1 deleted · 0 corrected · 0 unverified |
| [`utils-admin`](utils-admin.md) | `packages/utils/admin` | 8 | 4 | 10 confirmed · 0 deleted · 1 corrected · 1 unverified |
| [`nx`](nx.md) | `packages/nx` | 7 (1H) | 4 | 7 confirmed · 0 deleted · 6 corrected · 4 unverified |
| [`design-system`](design-system.md) | `packages/design-system` | 9 | 8 | 12 confirmed · 0 deleted · 4 corrected · 1 unverified |

### Identity & access

| Artifact | Unit | 🐞 | ♿ | Verified |
| --- | --- | --- | --- | --- |
| [`identity-server`](identity-server.md) | `packages/identity/server` | 6 (1H) | 3 | 9 confirmed · 0 deleted · 3 corrected · 0 unverified |
| [`identity-admin`](identity-admin.md) | `packages/identity/admin` | 5 | 7 | 12 confirmed · 0 deleted · 3 corrected · 1 unverified |
| [`users-server`](users-server.md) | `packages/users/server` | 4 | 2 | 6 confirmed · 0 deleted · 2 corrected · 0 unverified |
| [`users-admin`](users-admin.md) | `packages/users/admin` | 5 (1H) | 9 | 14 confirmed · 0 deleted · 4 corrected · 0 unverified |
| [`api-tokens-admin`](api-tokens-admin.md) | `packages/api-tokens/admin` | 5 (2H) | 7 | 12 confirmed · 0 deleted · 6 corrected · 1 unverified |
| [`activity-server`](activity-server.md) | `packages/activity/server` | 5 | 2 | 7 confirmed · 0 deleted · 1 corrected · 0 unverified |
| [`activity-admin`](activity-admin.md) | `packages/activity/admin` | 6 | 9 | 15 confirmed · 0 deleted · 1 corrected · 1 unverified |

### Workspaces & shell

| Artifact | Unit | 🐞 | ♿ | Verified |
| --- | --- | --- | --- | --- |
| [`workspaces-server`](workspaces-server.md) | `packages/workspaces/server` | 8 (2H) | 1 | 9 confirmed · 0 deleted · 3 corrected · 0 unverified |
| [`workspaces-admin`](workspaces-admin.md) | `packages/workspaces/admin` | 6 | 12 | 17 confirmed · 1 deleted · 3 corrected · 1 unverified |
| [`shell-admin`](shell-admin.md) | `packages/shell/admin` | 8 | 7 | 14 confirmed · 1 deleted · 1 corrected · 2 unverified |
| [`query-builder-admin`](query-builder-admin.md) | `packages/query-builder/admin` | 8 (1H) | 7 | 14 confirmed · 0 deleted · 1 corrected · 0 unverified |
| [`insights-admin`](insights-admin.md) | `packages/insights/admin` | 9 | 7 | 16 confirmed · 0 deleted · 0 corrected · 0 unverified |

### Content

| Artifact | Unit | 🐞 | ♿ | Verified |
| --- | --- | --- | --- | --- |
| [`content-domain`](content-domain.md) | `packages/content/domain` | 7 | 3 | 9 confirmed · 0 deleted · 1 corrected · 0 unverified |
| [`content-server`](content-server.md) | `packages/content/server` | 3 | 3 | 6 confirmed · 0 deleted · 0 corrected · 0 unverified |
| [`content-admin`](content-admin.md) | `packages/content/admin` | 8 (1H) | 11 | 15 confirmed · 0 deleted · 4 corrected · 0 unverified |
| [`content-graphql`](content-graphql.md) | `packages/content/graphql` | 7 (1C/2H) | 0 | 5 confirmed · 0 deleted · 2 corrected · 1 unverified |

### Localization & rich text

| Artifact | Unit | 🐞 | ♿ | Verified |
| --- | --- | --- | --- | --- |
| [`i18n-server`](i18n-server.md) | `packages/i18n/server` | 4 | 3 | 2 confirmed · 0 deleted · 5 corrected · 0 unverified |
| [`i18n-admin`](i18n-admin.md) | `packages/i18n/admin` | 8 | 9 | 16 confirmed · 0 deleted · 2 corrected · 2 unverified |
| [`wysiwyg-admin`](wysiwyg-admin.md) | `packages/wysiwyg/admin` | 4 | 9 | 4 confirmed · 0 deleted · 9 corrected · 1 unverified |

### Media

| Artifact | Unit | 🐞 | ♿ | Verified |
| --- | --- | --- | --- | --- |
| [`media-server`](media-server.md) | `packages/media/server` | 10 (1C) | 4 | 11 confirmed · 0 deleted · 3 corrected · 0 unverified |
| [`media-admin`](media-admin.md) | `packages/media/admin` | 6 | 8 | 10 confirmed · 0 deleted · 4 corrected · 0 unverified |
| [`media-provider-local`](media-provider-local.md) | `packages/media/provider-local` | 5 | 2 | 5 confirmed · 0 deleted · 2 corrected · 0 unverified |
| [`media-provider-s3`](media-provider-s3.md) | `packages/media/provider-s3` | 5 | 2 | 5 confirmed · 0 deleted · 2 corrected · 0 unverified |

### Agents, tools & MCP

| Artifact | Unit | 🐞 | ♿ | Verified |
| --- | --- | --- | --- | --- |
| [`copilot-domain`](copilot-domain.md) | `packages/copilot/domain` | 6 | 3 | 6 confirmed · 0 deleted · 3 corrected · 0 unverified |
| [`copilot-server`](copilot-server.md) | `packages/copilot/server` | 10 (1H) | 3 | 12 confirmed · 0 deleted · 0 corrected · 1 unverified |
| [`copilot-admin`](copilot-admin.md) | `packages/copilot/admin` | 8 (2H) | 15 | 22 confirmed · 0 deleted · 1 corrected · 0 unverified |
| [`copilot-provider-anthropic`](copilot-provider-anthropic.md) | `packages/copilot/provider-anthropic` | 5 | 4 | 2 confirmed · 0 deleted · 7 corrected · 1 unverified |
| [`copilot-provider-openai`](copilot-provider-openai.md) | `packages/copilot/provider-openai` | 8 | 4 | 2 confirmed · 0 deleted · 10 corrected · 2 unverified |
| [`copilot-provider-fake`](copilot-provider-fake.md) | `packages/copilot/provider-fake` | 4 | 0 | 4 confirmed · 0 deleted · 2 corrected · 0 unverified |
| [`tools-server`](tools-server.md) | `packages/tools/server` | 5 | 4 | 3 confirmed · 0 deleted · 6 corrected · 0 unverified |
| [`mcp-server`](mcp-server.md) | `packages/mcp/server` | 5 | 5 | 9 confirmed · 0 deleted · 1 corrected · 0 unverified |

## Method and caveats

- Findings come from reading source, not from a package's own documentation — several
  findings are precisely that the documentation and the code disagree.
- Every finding was checked a second time against the line it cites. That pass deleted
  findings the code did not support, downgraded ones whose exploit path did not hold, and
  corrected several hundred citations. Each artifact's header records its own result.
- Severity means reachability: **Critical** and **High** require a concrete, reachable
  exploit or data-loss path in the shipped configuration. A defect that is real but is
  registered in no host, or is blocked by a shipped config, is downgraded and says so.
- `🔒` means authorization, tenant isolation or disclosure. Data loss and resource leaks
  are serious but are not marked `🔒`.
- The manual test plans have **not been executed**. They are written to be runnable by
  someone with the repository and no prior context; treat them as a script to run, not as
  a record of a run.
- Accessibility is assessed to WCAG 2.1 AA with the Section 508 provision cited alongside,
  including §504 authoring-tool provisions, which is where a CMS is most exposed. Verdicts
  use VPAT language: Supports, Partially Supports, Does Not Support, Not Applicable.
- Counts here are generated from the artifacts themselves, counting each finding where it
  is defined, so cross-references between artifacts are not double-counted.
