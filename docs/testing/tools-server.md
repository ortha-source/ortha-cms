# @ortha-cms/tools-server — Test Artifact

> **Unit:** `packages/tools/server` · **Package:** `@ortha-cms/tools-server` · **Kind:** library (shared registry + authorization point)
> **Source of truth:** `packages/tools/server/AGENTS.md`
> **Findings verified:** 2026-08-11 — 3 confirmed · 0 deleted · 6 corrected · 0 unverified
> **Generated:** 2026-08-11

## 1. Scope & Preconditions

**Owns** the transport-neutral agent tool contract and the single place a tool
call is authorized: `ToolDefinition` / `ToolContext` / `ToolActor` /
`ToolProvider` / `ToolEffect` / `ToolSurface` (`src/lib/tool.ts`), the
`ToolRegistry` itself (`src/lib/tool-registry.ts`), the context constructor
(`src/lib/tool-context.ts`), the throw→`ToolError` flattener
(`src/lib/tool-error.ts`), and the `@Global()` `ToolsModule` that provides
exactly one registry instance to both consumers (`src/lib/tools.module.ts`).

**Does NOT own:**

- **Any tool.** Every `ToolDefinition` in the repo is contributed by the plugin
  that owns the data — `content/server`, `media/server`, `i18n/server`,
  `activity/server`, `users/server`. This package has zero domain knowledge.
- **Any transport.** No HTTP, no JSON-RPC, no SSE. `mcp/server` and
  `copilot/server` are the two adapters.
- **Permission *definitions*.** `PermissionKey` is imported as a type from
  `@ortha-cms/identity-server` (`src/lib/tool.ts:1`); the catalogue lives there.
- **Permission *resolution*.** `createToolContext` explicitly never derives
  permissions — the caller hands `grantedPermissions` over already resolved
  (`src/lib/tool-context.ts:12-15`).
- **Argument validation.** See 🐞 BUG-tools-server-01 — nothing here validates
  `input` against `inputSchema`; each handler is on its own.
- **Resource authorization.** See 🐞 BUG-tools-server-02.

### Entry points (exported API — `src/index.ts:15-38`)

| Export | Kind | Notes |
| --- | --- | --- |
| `ToolRegistry` | class (`@Injectable()`) | `register` / `all` / `forSurface` / `visibleTo` / `call` / `resources` / `readResource` |
| `ToolsModule` | `@Global()` NestJS module | Provides + exports `ToolRegistry`. **Imported** by MCP and copilot, provided by neither. |
| `createToolContext(actor, workspaceId)` | function | Builds a `ToolContext` whose `can()` is a set lookup |
| `toToolError(error)` | function | `HttpException` → `{ status, code, message, issues? }`; anything else → opaque 500 |
| `ToolProvider` | type | `tools()` + optional `resources()` / `readResource()` |
| `ToolDefinition`, `ToolContext`, `ToolActor`, `ToolActorKind`, `ToolEffect`, `ToolSurface`, `ToolOutput`, `JsonSchema`, `ResourceDefinition`, `ResourceContents`, `ToolError` | types | — |

**No HTTP routes.** This unit contributes no controller and no route.

### Runtime prerequisites

- Nothing of its own: no env var, no table, no migration, no feature flag.
- To exercise it **end to end** you need one of its two consumers running:
    - the MCP surface: `MCP_ENABLED=true` + a bearer API token (see
      `docs/testing/mcp-server.md`);
    - the copilot surface: `COPILOT_ENABLED=true` + a signed-in user holding
      `copilot:use` (see `docs/testing/copilot-server.md`).
- Its unit tests need neither: `ToolRegistry` is `new`-able and the two spec
  files construct it directly (`src/lib/tool-registry.spec.ts:51`).

### How to exercise it manually

```bash
docker compose up -d                       # Postgres
npx nx test @ortha-cms/tools-server        # 🧪 the registry + error-mapping specs
npx nx typecheck @ortha-cms/tools-server
npx nx lint @ortha-cms/tools-server
```

For the wire-level behaviour (both surfaces, one registry):

```bash
MCP_ENABLED=true COPILOT_ENABLED=true npm run dev
npx nx e2e server-e2e --testPathPatterns=mcp        # needs Docker
npx nx e2e server-e2e --testPathPatterns=copilot
```

### Dependencies that must be healthy

- `@ortha-cms/identity-server` — only for the `PermissionKey` type and, at
  runtime for the consumers, `PERMISSIONS` constants and `scopePermissions`.
- `@nestjs/common` — `Injectable`, `Global`, `Module`, `HttpException`,
  `ForbiddenException`, `NotFoundException`, `Logger`.
- The **capability plugins** must have booted and run their `onModuleInit`
  registration, or `all()` returns an empty catalogue and every surface looks
  correctly empty rather than broken.

### The registered catalogue as it stands (verified by grep, 2026-08-11)

29 tools, from six plugins. `surfaces` omitted means **both**.

| Tool | `requires` | `effect` | `surfaces` | Declared at |
| --- | --- | --- | --- | --- |
| `content_types_list` | `content:read` | (read) | `['mcp']` | `packages/content/server/src/lib/mcp/content-tools.provider.ts:127` |
| `content_type_get` | `content:read` | (read) | `['mcp']` | …`:139` |
| `content_list` | `content:read` | (read) | `['mcp']` | …`:155` |
| `content_get` | `content:read` | (read) | `['mcp']` | …`:181` |
| `content_relations` | `content:read` | (read) | `['mcp']` | …`:208` |
| `content_media` | `content:read` + `media:read` | (read) | `['mcp']` | …`:239` |
| `content_translations` | `content:read` | (read) | `['mcp']` | …`:269` |
| `content_create` | `content:create` | (read†) | `['mcp']` | …`:299` |
| `content_update` | `content:update` | (read†) | `['mcp']` | …`:324` |
| `content_publish` | `content:publish` | (read†) | `['mcp']` | …`:358` |
| `content_unpublish` | `content:publish` | (read†) | `['mcp']` | …`:380` |
| `content_delete` | `content:delete` | (read†) | `['mcp']` | …`:402` |
| `admin_content_types` | `content:read` | `read` | `['copilot']` | `packages/content/server/src/lib/copilot/content-tool.provider.ts:90` |
| `admin_content_search` | `content:read` | `read` | `['copilot']` | …`:158` |
| `admin_content_get` | `content:read` | `read` | `['copilot']` | …`:303` |
| `admin_content_revisions` | `content:read` | `read` | `['copilot']` | `packages/content/server/src/lib/copilot/revision-tool.provider.ts:77` |
| `admin_content_diff` | `content:read` | `read` | `['copilot']` | …`:157` |
| `content_propose_create` | `content:create` | `propose` | `['copilot']` | `packages/content/server/src/lib/copilot/entry-proposal.provider.ts:152` |
| `content_propose_update` | `content:update` | `propose` | `['copilot']` | …`:252` |
| `i18n_locales_list` | `content:read` | `read` | **both** | `packages/i18n/server/src/lib/copilot/i18n-tool.provider.ts:67` |
| `i18n_translations_get` | `content:read` | `read` | `['copilot']` | …`:101` |
| `i18n_propose_translation` | `content:update` | `propose` | `['copilot']` | `packages/i18n/server/src/lib/copilot/translation-proposal.provider.ts:66` |
| `media_assets_search` | `media:read` | `read` | **both** | `packages/media/server/src/lib/copilot/media-tool.provider.ts:88` |
| `media_folders_list` | `media:read` | `read` | **both** | …`:203` |
| `media_asset_read` | `media:read` | `read` | **both** | …`:243` |
| `media_propose_alt_text` | `media:update` | `propose` | `['copilot']` | `packages/media/server/src/lib/copilot/alt-text-proposal.provider.ts:48` |
| `media_propose_file` | `media:create` | `propose` | `['copilot']` | `packages/media/server/src/lib/copilot/create-file-proposal.provider.ts:69` |
| `activity_recent` | `activity:read` | `read` | `['copilot']` | `packages/activity/server/src/lib/copilot/activity-tool.provider.ts:54` |
| `workspace_members_list` | `users:read` | `read` | `['copilot']` | `packages/users/server/src/lib/copilot/workspace-tool.provider.ts:54` |

† the twelve MCP content tools are stamped with a shared base object at
`content-tools.provider.ts:104-114` that sets `surfaces: ['mcp']` and **no**
`effect`, so `ToolDefinition.effect` defaults to `read` on all of them,
including `content_create` / `content_delete`. That is consistent with
`tool.ts:176-179` ("Defaults to `read` when omitted") and with ADR-0007 §3
(`effect` is the copilot engine's vocabulary, `readOnly`/`destructive` are the
MCP hints, which those tools do set correctly) — but it means `effect` is not a
safe field to reason about across the whole catalogue. See EC-31.

**Surface-exposure verdict:** every narrowing is deliberate and carries a
comment; the four shared tools are exactly the four AGENTS.md documents. No
`propose` tool leaks to MCP; no `admin_*` tool leaks to MCP; no `public-api/`
tool leaks to the copilot. **Checked and cleared** — see §6.

---

## 2. Feature Inventory

| # | Feature | Where it lives | Coverage |
| --- | --- | --- | --- |
| F1 | `register(provider)` — a capability plugin adds its tools at `onModuleInit` | `src/lib/tool-registry.ts:42-44` | 🧪 UNIT `src/lib/tool-registry.spec.ts:267` |
| F2 | `all()` — every tool, in registration order | `src/lib/tool-registry.ts:53-68` | 🧪 UNIT `tool-registry.spec.ts:267-275` |
| F3 | `all()` throws on a duplicate tool name across providers | `src/lib/tool-registry.ts:58-62` | 🧪 UNIT `tool-registry.spec.ts:280-285` |
| F4 | `forSurface(surface)` — narrows to one consumer; omitted `surfaces` means both | `src/lib/tool-registry.ts:76-80` | 🧪 UNIT `tool-registry.spec.ts:195-223` |
| F5 | `visibleTo(context, surface)` — the offered list, permission-filtered | `src/lib/tool-registry.ts:89-96` | 🧪 UNIT `tool-registry.spec.ts:153-167` |
| F6 | `call()` refuses an unknown tool name with `NotFoundException` | `src/lib/tool-registry.ts:118-123` | 🧪 UNIT `tool-registry.spec.ts:171-177` · ✅ E2E `apps/server-e2e/src/server/mcp/mcp.spec.ts:588` |
| F7 | `call()` refuses a tool narrowed to the *other* surface as **unknown**, not forbidden | `src/lib/tool-registry.ts:118-123` | 🧪 UNIT `tool-registry.spec.ts:225-238` · ✅ E2E `mcp.spec.ts:495`, `apps/server-e2e/src/server/copilot/copilot-read-catalogue.spec.ts:158` |
| F8 | `call()` re-checks `requires` **before dispatch** — the security boundary | `src/lib/tool-registry.ts:124-130`, `168-171` | 🧪 UNIT `tool-registry.spec.ts:57-92` · ✅ E2E `mcp.spec.ts:541`, `553` |
| F9 | `requires` is ALL-of, not any-of | `src/lib/tool-registry.ts:170` | 🧪 UNIT `tool-registry.spec.ts:94-124` |
| F10 | `call()` stamps `surface` on the handler's context (never caller-asserted) | `src/lib/tool-registry.ts:131-136` | 🧪 UNIT `tool-registry.spec.ts:245-263` · ✅ E2E `mcp.spec.ts:458`, `copilot-read-catalogue.spec.ts:485` |
| F11 | A tool requiring nothing runs for any actor | `src/lib/tool-registry.ts:170` (vacuous `every`) | 🧪 UNIT `tool-registry.spec.ts:143-149` |
| F12 | `resources(context)` — flattens every provider's resource list | `src/lib/tool-registry.ts:140-149` | 🧪 UNIT `tool-registry.spec.ts:318-339` · ✅ E2E `mcp.spec.ts:647` |
| F13 | `readResource(uri, context)` — first provider that claims the URI wins | `src/lib/tool-registry.ts:155-166` | 🧪 UNIT `tool-registry.spec.ts:297-316` · ✅ E2E `mcp.spec.ts:665` |
| F14 | `readResource` 404s a URI nobody claims | `src/lib/tool-registry.ts:165` | 🧪 UNIT `tool-registry.spec.ts:289-295` |
| F15 | `createToolContext` — `can()` is a plain set membership over `grantedPermissions` | `src/lib/tool-context.ts:17-27` | 🧪 UNIT (used throughout `tool-registry.spec.ts:9-20`) |
| F16 | `toToolError` maps 404 → `not_found`, 403 → `forbidden`, 422 → `validation_failed`, 400 → `bad_request`, 401 → `unauthorized`, 409 → `conflict` | `src/lib/tool-error.ts:16-23`, `42-64` | 🧪 UNIT `src/lib/tool-error.spec.ts:351-367` |
| F17 | `toToolError` carries a 422's per-field `issues` through verbatim | `src/lib/tool-error.ts:56-63` | 🧪 UNIT `tool-error.spec.ts:370-386` · ✅ E2E `mcp.spec.ts:858` |
| F18 | `toToolError` joins an array `message` into one string | `src/lib/tool-error.ts:51-54` | 🧪 UNIT `tool-error.spec.ts:388-396` |
| F19 | `toToolError` reduces a non-`HttpException` to an **opaque** 500 and logs the stack | `src/lib/tool-error.ts:67-77` | 🧪 UNIT `tool-error.spec.ts:59-70` |
| F20 | `ToolsModule` is `@Global()` and yields one instance to both importers | `src/lib/tools.module.ts:22-27` | ❌ NONE (no test asserts instance identity across both modules) |
| F21 | A capability plugin injects `ToolRegistry` `@Optional()` and boots without either consumer | `src/lib/tool-provider.ts:20-25` (contract); binders e.g. `activity-tool.provider.ts:30` | ❌ NONE |
| F22 | **Argument validation against `inputSchema`** | *nowhere in this package* | ❌ NONE → 🐞 BUG-tools-server-01 |
| F23 | **Resource authorization (`requires` on a resource)** | *does not exist* | ❌ NONE → 🐞 BUG-tools-server-02 |

---

## 3. Manual Test Plan

Everything here is exercised through one of the two consumers, because this
package contributes no route. Where a step says "call tool X", use the MCP
`curl` shape from `docs/testing/mcp-server.md` §1, or the copilot chat panel.

**Global preconditions for every block below:**
`docker compose up -d`, a `.env` with `DATABASE_URL` / `SESSION_SECRET` /
`TOKEN_SECRET`, `MCP_ENABLED=true`, `COPILOT_ENABLED=true`,
`npx nx run server:db:migrate`, `npm run dev`. One workspace granted the
`test_article` content type, one `read`-scope API token and one `full`-scope
token over it, and three signed-in users (admin / contributor / viewer).

Shorthand used below:

```bash
RPC() { curl -s -X POST http://localhost:3000/api/v1/mcp \
  -H "Authorization: Bearer $TOKEN" -H "X-Workspace-Id: $WS" \
  -H 'content-type: application/json' -H 'accept: application/json, text/event-stream' \
  -d "$1"; }
```

**Keyboard-only path / screen-reader expectation:** not applicable — this unit
renders no UI. See §4A.

### F1 — `register(provider)` picks up a plugin's tools

**Preconditions:** server booted with all plugins.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `RPC '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'` with the **full** token | `result.tools` contains `content_create` (content), `media_assets_search` (media) and `i18n_locales_list` (i18n) — three different plugins in one catalogue |
| 2 | Stop the server, comment out `MediaServerPlugin` in `apps/server/src/plugins.ts`, restart | Boot succeeds. `tools/list` no longer contains any `media_*` name, and nothing 500s |
| 3 | Restore `plugins.ts` and restart | The three `media_*` tools are back |

### F2 — `all()` returns registration order

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `RPC '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'` with the full token | The `content_*` tools appear before `media_*`, which appear before `i18n_locales_list` — matching the plugin order in `apps/server/src/plugins.ts:54-170` |

### F3 — a duplicate tool name is a loud failure

**Preconditions:** a scratch branch; you will edit source and revert.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | In `packages/activity/server/src/lib/copilot/activity-tool.provider.ts:54`, rename `activity_recent` to `media_assets_search` | — |
| 2 | Restart the server | **Boot succeeds** — nothing validates names at boot |
| 3 | `RPC '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'` | **500**, not a tool list. The log shows `Duplicate tool name "media_assets_search"` |
| 4 | Send any copilot message from the panel | The run fails with a generic error frame. Every tool call on **both** surfaces is now dead → 🐞 BUG-tools-server-03 |
| 5 | `git checkout -- packages/activity` and restart | Recovered |

### F4 — `forSurface` narrows, and omitted means both

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `tools/list` with the **full** token | `media_assets_search`, `media_folders_list`, `media_asset_read`, `i18n_locales_list` are present |
| 2 | Same call | **No** name starting `admin_`, and no name containing `propose`, appears |
| 3 | Ask the copilot panel "what tools do you have?" and expand any tool step | The copilot surface shows `admin_content_search` etc. and **not** `content_list` / `content_create` |

### F5 — `visibleTo` hides what the actor cannot call

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `tools/list` with the **read**-scope token | `content_create`, `content_update`, `content_publish`, `content_unpublish`, `content_delete` are **absent** |
| 2 | Same call | `content_list`, `content_get`, `media_assets_search` are present |
| 3 | Sign in as **viewer**, ask the copilot to "create an article" | The answer says it cannot; no `content_propose_create` step appears |

### F6 — an unknown tool name is a 404-shaped tool error

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `RPC '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"content_teleport","arguments":{}}}'` | `result.isError === true`, and the text block parses to `{"status":404,"code":"not_found","message":"Unknown tool \"content_teleport\"."}` |
| 2 | Confirm it is **not** a JSON-RPC error | `result.error` is absent; the failure rides as an `isError` result so a model can recover |

### F7 — a cross-surface name answers "unknown", never "forbidden"

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `RPC` `tools/call` with `"name":"content_propose_update"` and the **full** token | `isError: true`, `code: "not_found"` — **not** `forbidden`. A full token holds `content:update`, so a permission-shaped answer would confirm the tool exists on the other surface |
| 2 | `RPC` `tools/call` with `"name":"admin_content_search"` | Same: `not_found` |

### F8 — `call()` is the boundary, not the list

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `tools/list` with the **read** token; note `content_delete` is absent | — |
| 2 | `RPC '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"content_delete","arguments":{"typeName":"test_article","id":"<any uuid>"}}}'` | `isError: true`, `code: "forbidden"`, message `"content_delete" requires content:delete, which this token does not hold.` |
| 3 | Confirm nothing was deleted: `content_get` the entry with the full token | Still present |

### F9 — every declared permission is required

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Mint a token whose scope yields `content:read` but not `media:read` (see `scopePermissions` in identity) | — |
| 2 | `tools/call` `content_media` (requires both) | `forbidden`, naming **both** keys in the message |

### F10 — the surface is stamped by the registry

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `RPC` `tools/call` `media_assets_search` with `{"pageSize":1}` | Each item's `downloadPath` starts `/api/v1/media/assets/` — the bearer-fetchable route |
| 2 | Ask the copilot "find me an image", expand the `media_assets_search` step | The same field reads `/api/media/assets/…` — the session-gated route |
| 3 | Try to force it: add `"surface":"mcp"` to the copilot run body | **400** from the strict `ValidationPipe` — `surface` is not on `CreateRunDto`, and nothing in the request can reach `ToolContext.surface` |

### F11 — a tool requiring nothing

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | No tool in the shipped catalogue has `requires: []`. Add one temporarily in any provider with `requires: []` and restart | `tools/list` shows it to the **read** token, and `tools/call` runs it |
| 2 | Revert | — |

### F12 — `resources/list` flattens across providers

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `RPC '{"jsonrpc":"2.0","id":1,"method":"resources/list"}'` | One `ortha://content-type/<slug>` entry per granted type, and nothing for an ungranted one |

### F13 — `resources/read` first-claim-wins

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `RPC '{"jsonrpc":"2.0","id":1,"method":"resources/read","params":{"uri":"ortha://content-type/test_article"}}'` | `result.contents[0].mimeType === 'application/json'` and `.text` parses to the type's field schema |

### F14 — `resources/read` on an unclaimed URI

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `…"params":{"uri":"ortha://nope"}` | A JSON-RPC **error** (not an `isError` result — `readResource` throws out of the handler and the SDK converts it), whose message is `Unknown resource "ortha://nope".` |

### F15 — `can()` is set membership and nothing else

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `npx nx test @ortha-cms/tools-server` | The `contextWith(...)` helper (`tool-registry.spec.ts:9-20`) builds a context from a bare `Set` and every authorization assertion passes off it — proving no re-derivation from `actor.id` |

### F16–F19 — `toToolError`

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `tools/call` `content_get` with a `typeName` the workspace was not granted | `{"status":404,"code":"not_found",…}` — identical to an unknown type (`mcp.spec.ts:633`) |
| 2 | `tools/call` `content_create` with a `title` over the field's max length | `{"status":422,"code":"validation_failed","message":…,"issues":[{…}]}` — the `issues` array is present and per-field |
| 3 | `tools/call` `content_create` with two invalid DTO fields | `message` is the two messages joined with `; ` |
| 4 | Stop Postgres (`docker compose stop`) and `tools/call` `content_list` | `{"status":500,"code":"internal_error","message":"The tool failed unexpectedly. See the server logs."}`. The connection string appears **only** in the server log, never in the response |

### F20 — one registry, two importers

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Boot with `MCP_ENABLED=true` and `COPILOT_ENABLED=true` | `tools/list` over MCP and the copilot's offered set are both non-empty, and `media_assets_search` appears in both |
| 2 | Boot with `MCP_ENABLED=false`, `COPILOT_ENABLED=true` | The copilot still has tools. `POST /api/v1/mcp` 404s |
| 3 | Boot with `MCP_ENABLED=true`, `COPILOT_ENABLED=false` | `tools/list` still works. A copilot run returns an error frame saying the copilot is off |

### F21 — a capability plugin boots with neither consumer

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Remove **both** `CopilotPlugin(...)` and `McpPlugin(...)` from `apps/server/src/plugins.ts`, restart | Boot succeeds. `ToolsModule` is never imported, so `ToolRegistry` is unresolvable, and every provider's `@Optional()` injection yields `undefined` — their `onModuleInit` registers nothing |
| 2 | Hit an ordinary content route, e.g. `GET /api/content/test_article` | Works normally — the tools are inert, the plugin is not |

### F22 — argument validation (the gap)

| Step | Action | Expected result / **Observed** |
| --- | --- | --- |
| 1 | `RPC` `tools/call` `media_assets_search` with `{"pageSize":"lots","nope":1,"kind":"../etc/passwd"}` | **Expected** (from `inputSchema`: `additionalProperties: false`, `pageSize` integer 1..max, `kind` enum): a `validation_failed` tool error naming the three problems. **Observed:** the handler runs — `nope` is ignored, `pageSize` falls through `Math.min(Math.max("lots" ?? 10, 1), MAX)` and `kind` reaches the query. → 🐞 BUG-tools-server-01 |
| 2 | Ask the copilot the same thing (a hallucinated argument) | The copilot **does** refuse: `copilot-chat.spec.ts:445` asserts `Invalid arguments: …`, because `RunEngine` calls `validateToolInput` first (`run-engine.service.ts:700-703`) |

### F23 — resource authorization (the gap)

| Step | Action | Expected result / **Observed** |
| --- | --- | --- |
| 1 | Read `src/lib/tool.ts:198-207` | `ResourceDefinition` has **no** `requires` field |
| 2 | Read `src/lib/tool-registry.ts:140-166` | Neither `resources()` nor `readResource()` calls `permits()` |
| 3 | `RPC` `resources/list` and `resources/read` with the **read**-scope token | Works — correctly, because `content/server`'s provider scopes by workspace grants itself. Nothing in this package required it to. → 🐞 BUG-tools-server-02 |

---

## 4. Edge Cases & Negative Paths

### Empty / zero

- **EC-01 — No providers registered at all.** `❌ NONE`
  Trigger: boot with every capability plugin removed.
  Expected: `all()` → `[]`, `visibleTo()` → `[]`, `tools/list` returns
  `{"tools":[]}`, `call()` on any name → `NotFoundException`.
  `tool-registry.ts:53-56` starts from an empty array, so this is structurally
  safe; nothing asserts it.

- **EC-02 — A provider whose `tools()` returns `[]`.** `🧪 UNIT`
  `tool-registry.spec.ts:303-311` registers exactly this shape for the resource
  cases. It concatenates cleanly.

- **EC-03 — `requires: []`.** `🧪 UNIT` `tool-registry.spec.ts:143-149`.
  `Array.prototype.every` on an empty array is `true`, so the tool is offered to
  and callable by an actor holding nothing at all — including a token whose
  scope resolved to an empty permission set. Correct but worth knowing: a
  mistyped `requires: []` is a **wide-open** tool that no type checker catches.

- **EC-04 — `grantedPermissions` is an empty set.** `❌ NONE`
  Trigger: a token scope that `scopePermissions` maps to nothing.
  Expected: `visibleTo` returns only the `requires: []` tools; every other
  `call()` is `ForbiddenException`.

- **EC-05 — `call(name, undefined as any, …)`.** `❌ NONE`
  `call`'s `input` is typed `Record<string, unknown>` and passed straight to
  `tool.handler` (`tool-registry.ts:136`). The MCP adapter defends with
  `args ?? {}` (`build-mcp-server.ts:66`) and the engine with
  `(call.input ?? {})` (`run-engine.service.ts:736`), so **both** callers
  compensate for something the registry does not. A third consumer would have
  to remember.

- **EC-06 — A handler returning `undefined`.** `❌ NONE`
  `ToolOutput` is `unknown`, so this is legal. MCP boxes it as
  `{ value: undefined }` → `structuredContent: {"value":undefined}` which
  `JSON.stringify` drops, yielding `{}`. The copilot's `summarizeToolOutput`
  returns `'no result'` (`summarize-tool-output.ts:22-24`). Both survive;
  neither is asserted.

### Boundary

- **EC-07 — Two tools whose names differ only in case** (`content_list` vs
  `Content_List`). `❌ NONE`
  `all()`'s `seen` set is case-**sensitive** (`tool-registry.ts:57-63`), so both
  register. `call()` uses `===`, so the wrong one can never run — but the naming
  convention in AGENTS.md ("`snake_case`, unique") is not enforced.

- **EC-08 — A tool name with a leading/trailing space.** `❌ NONE`
  Registers and is callable only by sending the exact padded name. Nothing
  trims or validates the shape.

- **EC-09 — `surfaces: []` (empty array).** `❌ NONE`
  `!tool.surfaces` is `false` for `[]`, and `[].includes(x)` is `false`, so the
  tool is offered to **neither** surface and `call()` 404s it everywhere. A
  silently dead tool. Not covered.

- **EC-10 — `surfaces: ['mcp','copilot']` written out explicitly.** `❌ NONE`
  Behaves identically to omitting it. Worth a case so the two spellings are
  known to agree.

- **EC-11 — 200 registered tools.** `❌ NONE`
  `all()` is O(n) and rebuilt on *every* `forSurface`, `visibleTo` and `call`
  (`tool-registry.ts:77`, `93`, `118`). At the current 29 that is free; it is a
  per-call allocation of the whole catalogue and a per-call duplicate scan.
  Category: perf. Nothing measures it.

### Size & encoding

- **EC-12 — A handler returning a 10 MB payload.** `❌ NONE`
  MCP `JSON.stringify`s it twice (`build-mcp-server.ts:73-74`: once for the text
  block, once inside `structuredContent`). The copilot passes it to
  `fenceUntrusted`, which also has no bound. Neither surface truncates. See
  🐞 BUG-copilot-domain-02.

- **EC-13 — A tool name containing `<`, a newline, or an emoji.** `⚠️ PARTIAL`
  The registry accepts it. The copilot's fence sanitises the **source**
  attribute (`untrusted.ts:65-67`) so it cannot reach the prompt as markup —
  that half is unit-tested at `untrusted.spec.ts`. The MCP surface passes the
  name through to the client verbatim, which is correct for a protocol.

- **EC-14 — Unicode/RTL in a `ForbiddenException` message.** `❌ NONE`
  `tool-registry.ts:126-129` interpolates `tool.requires.join(', ')` and `name`.
  Both are ours, so this is theoretical.

- **EC-15 — A `PermissionKey` with a trailing space in `requires`.** `❌ NONE`
  `can()` is exact-match set membership (`tool-context.ts:24-25`), so the tool
  is unreachable by everyone. **Fails closed**, silently.

### Permission matrix

Because this unit has no route, the matrix is over **actors**, not roles.

| Actor | `visibleTo` | `call` a permitted tool | `call` an unpermitted tool | `call` an unknown name | `call` a cross-surface name |
| --- | --- | --- | --- | --- | --- |
| `read`-scope token (MCP) | 7 read `content_*` + 4 shared | 200 result | 403 `forbidden` | 404 `not_found` | 404 `not_found` |
| `full`-scope token (MCP) | 12 `content_*` + 4 shared | 200 result | n/a | 404 | 404 |
| **admin** user (copilot) | 13 copilot + 4 shared | runs | n/a | 404 | 404 |
| **contributor** user (copilot) | as admin minus `activity_recent` (`activity:read`) | runs | 403 on `activity_recent` | 404 | 404 |
| **viewer** user (copilot) | reads only — no `*_propose_*` | runs | 403 on every propose tool | 404 | 404 |
| Unauthenticated | never reaches here — the consumer's edge rejects first | — | — | — | — |
| Member of another workspace | reaches here with a valid context for **their** workspace; every handler scopes on `ctx.workspaceId` | — | — | — | — |

- **EC-16 — 403 vs 404, and why both exist.** `🧪 UNIT` + `✅ E2E`
  ADR-0007 §6 settles it: the *tool list* is derived from the caller's own role
  and reveals nothing, so a refusal names the missing permission
  (`tool-registry.ts:98-107`). *Data* still 404s uniformly —
  `mcp.spec.ts:633` asserts an ungranted content type answers exactly like an
  unknown one. The distinction holds in code.

- **EC-17 — The refusal message enumerates `requires`.** `❌ NONE`
  `"content_delete" requires content:delete, which this token does not hold.`
  is handed to a third-party model. Deliberate per ADR-0007 §6; recorded as
  🐞 BUG-tools-server-04 because "the tool set is not secret" is an argument
  about *names*, and this leaks the *permission model* too.

### Tenant isolation

- **EC-18 — Same tool, different workspace.** `✅ E2E`
  `ctx.workspaceId` is set once by the consumer's edge and never by the caller
  (`tool-context.ts:17-26`; MCP at `mcp-auth.service.ts:83-99`, copilot at
  `capability-profile.service.ts:72-75`). `mcp.spec.ts:700` and `:877` assert a
  read and a write cannot cross the bucket; `copilot-read-catalogue.spec.ts:446`,
  `:587`, `:693` assert the same for media.

- **EC-19 — A handler that ignores `ctx.workspaceId`.** `❌ NONE`
  The registry cannot detect this. It is the single largest thing a new tool can
  get wrong, and there is no structural guard — only the per-plugin e2e cases.

### Concurrency

- **EC-20 — Two `register()` calls racing at `onModuleInit`.** `❌ NONE`
  `providers` is a plain array push (`tool-registry.ts:43`). Node is
  single-threaded and `onModuleInit` is sequential, so this is safe; ordering is
  whatever Nest's module graph produces, which is why `all()` is documented as
  "registration order" rather than declaration order.

- **EC-21 — The same provider instance registered twice.** `❌ NONE`
  Nothing dedupes (`tool-registry.ts:42-44`). Every one of its tools then
  collides with itself and `all()` throws for the rest of the process. →
  🐞 BUG-tools-server-05.

- **EC-22 — Two concurrent `call()`s on one tool.** `❌ NONE`
  The registry holds no per-call state; `{ ...context, surface }` is a fresh
  object per dispatch (`tool-registry.ts:136`). Safe by construction.

### State after mutation

- **EC-23 — `tools()` returning a different list per call.** `⚠️ PARTIAL`
  `ToolProvider.tools()` is documented as "called once per `tools/list`, so it
  may vary with runtime state" (`tool-provider.ts:28-33`). Content's provider
  does vary with the registry of content types. Consequence: a tool can appear
  between a `tools/list` and a `tools/call`, or vanish between them — the
  `call()` gate is what makes that safe. No test drives a changing catalogue.

- **EC-24 — A tool removed while a copilot run holds it in its profile.**
  `✅ E2E` (analogue) `copilot-chat.spec.ts:634` covers the permission version
  ("refuses a withheld tool at execution, not only at offer time"). The
  *catalogue* version (tool disappears) is uncovered — `call()` would 404 it,
  which is the right answer.

### Failure & partiality

- **EC-25 — A handler that never resolves.** `❌ NONE`
  `call()` awaits without a timeout. On MCP the HTTP request hangs until the
  client gives up; on the copilot the wall-clock ceiling is checked only at the
  **top** of the loop, so a hung tool hangs the run past `wallClockMs`
  (`run-engine.service.ts:359-368`). `ToolContext.signal` exists but is
  explicitly "a courtesy, never a correctness boundary" (`tool.ts:60-66`).

- **EC-26 — A handler that throws a non-`Error` (a string, `null`).** `🧪 UNIT`
  `tool-error.ts:67-72` handles it: `String(error)` for the log, opaque 500 for
  the caller. `tool-error.spec.ts:400` covers the `Error` case only.

- **EC-27 — An `HttpException` whose `getResponse()` is a bare string.**
  `❌ NONE` `tool-error.ts:46-49` falls back to `{}`, so `body['message']` is
  `undefined` and `error.message` is used — which for `new NotFoundException('x')`
  is `'x'`. Correct, untested.

- **EC-28 — A handler that throws a bare `Error` from a *shared* tool.**
  `❌ NONE` The BUGBOT rule (`.cursor/BUGBOT.md:329-332`). Verified across the
  four shared tools: `media-tool.provider.ts:292` throws
  `BadRequestException` ✓; `i18n-tool.provider.ts:141,152` throw bare `Error`
  but sit inside `i18n_translations_get`, which is `surfaces: ['copilot']`
  (`:128`) — so the rule holds. **Checked and cleared.** No test pins it.

### Idempotency & replay

- **EC-29 — `call()` the same tool with the same args twice.** `⚠️ PARTIAL`
  The registry is stateless, so both run. The **copilot** adds a repeat guard
  (`run-engine.service.ts:715-726`, tested at `copilot-chat.spec.ts:468`); MCP
  deliberately does not, because an external agent retrying is normal. The
  asymmetry is undocumented in this package.

### Contract / typing

- **EC-30 — `effect` omitted on a writing tool.** `❌ NONE`
  All twelve MCP content tools omit it (see §1 †). Harmless today because only
  the copilot engine reads `effect` (`run-engine.service.ts:553`, `747`) and
  none of those tools reaches it. It becomes a **bug** the moment one is shared.

- **EC-31 — `readOnly: true` on a tool that writes.** `❌ NONE`
  Nothing cross-checks `readOnly` against `effect`. `readOnly` drives an MCP
  client's auto-approve decision, so a wrong value is a real client-side hazard
  with no server-side guard.

- **EC-32 — `surfaces` copy-pasted from the neighbouring tool.** `⚠️ PARTIAL`
  BUGBOT's "more common failure" (`.cursor/BUGBOT.md:320-325`). The e2e suites
  pin *lists* (`mcp.spec.ts:379`, `copilot-read-catalogue.spec.ts:138`) rather
  than individual tools, so a **newly added** narrowed tool is caught only if
  someone updates the assertion. Enumerated the whole catalogue in §1 and found
  no miscategorisation as of 2026-08-11.

---

### 4A. Accessibility & Section 508 Conformance

**This unit renders no UI.** It is a NestJS-side library with no DOM, no route
that serves a document, and no user-visible string except the two error
messages below. The block is therefore short by design; everything not listed is
**Not Applicable**.

**Standards tested against:** Revised Section 508 (36 CFR Part 1194, App. A–C),
which incorporates WCAG 2.0 A+AA by reference (E205.4 for electronic content,
504.2 for authoring tools). This repo's `accessibility` skill targets WCAG 2.1
AA, so verdicts below cite WCAG 2.1 SC numbers alongside the 508 provision.

**What genuinely applies:**

- **♿ A11Y-tools-server-01 — Tool failure messages are human-readable prose,
  not opaque codes.** WCAG **3.3.1 Error Identification (A)** · 508 **E205.4** ·
  Verdict: **Supports**
  `src/lib/tool-error.ts:16-23` maps a status to a short machine `code` *and*
  carries a `message` string; `:56-63` preserves a 422's per-field `issues`
  verbatim. A client rendering a failed tool step therefore has a sentence to
  show ("title must be at most 200 characters") rather than `422`. Both
  consumers do render it: `copilot/admin`'s `ToolStep` shows `step.error`
  (`packages/copilot/admin/src/lib/presentation/ToolStep/index.tsx:67-81`),
  and MCP returns it as a text block (`build-mcp-server.ts:86`).
  Keyboard-only / screen-reader experience: n/a here; the rendering unit owns it.

- **♿ A11Y-tools-server-02 — The opaque-500 path removes the only actionable
  text.** WCAG **3.3.1 Error Identification (A)** · 508 **E205.4** · Verdict:
  **Partially Supports**
  `src/lib/tool-error.ts:73-77` replaces every non-`HttpException` with "The
  tool failed unexpectedly. See the server logs." — correct for security
  (`tool-error.spec.ts:59-70` proves no connection string leaks), and it
  leaves a user with no recovery step they can take. A screen-reader user hears
  a failed step with a sentence that names no next action. Remediation: pair the
  opaque message with a correlation id the user can quote, so support can find
  the log line — do not widen the message.

- **♿ A11Y-tools-server-03 — Nothing here carries structure for progress
  announcement.** WCAG **4.1.3 Status Messages (AA)** · 508 **502.3** ·
  Verdict: **Not Applicable (this unit) / see `copilot-admin`**
  `ToolOutput` is `unknown` and `ToolDefinition` carries `title` (a human
  string) and `description` (written for a model). A client *can* build an
  announcement from `title` — and `copilot/admin` does, via its own
  `ToolStep/labels.ts` keyed by tool name rather than off `title`. That is a
  missed reuse rather than a defect: a tool added by a plugin gets no phrase and
  degrades to `humanizeToolName` (`labels.ts`). Recorded here so the dependency
  is visible; the ♿ finding itself belongs to `copilot-admin`.

- **♿ A11Y-tools-server-04 — 504 Authoring Tool: the registry is the seam
  through which an agent writes content.** WCAG n/a · 508 **504.2** ·
  Verdict: **Partially Supports**
  Section 508 Chapter 5 §504 applies to authoring tools, and this registry is
  what makes content-writing capabilities available to an agent. The contract
  has **no field** for "this tool produces content that must carry accessibility
  information" — `ToolDefinition` (`src/lib/tool.ts:146-195`) has `requires`,
  `readOnly`, `effect`, `destructive`, `surfaces`, and nothing about the
  conformance of what it writes. `media_propose_alt_text` exists
  (`packages/media/server/src/lib/copilot/alt-text-proposal.provider.ts:48`), so
  alt text is *reachable*; nothing *prompts* for it, and nothing prevents
  `content_propose_create` writing a body with images and no alt attributes.
  Remediation: this is a `copilot/server` + content-tool concern (see
  ♿ A11Y-copilot-server-02 and ♿ A11Y-copilot-admin-10); the registry's part
  would be an advisory flag, and ADR-0010's alternatives section already warns
  against adding fields to `ToolDefinition` casually.

**Not Applicable:** 1.1.1, 1.3.1, 1.3.2, 1.3.5, 1.4.1, 1.4.3, 1.4.4, 1.4.10,
1.4.11, 1.4.12, 1.4.13, 2.1.1, 2.1.2, 2.2.1, 2.4.1, 2.4.2, 2.4.3, 2.4.6, 2.4.7,
3.1.1, 3.1.2, 3.2.1, 3.2.2, 3.3.2, 3.3.3, 3.3.4, 4.1.2 — no user interface, no
document, no focusable element, no timing, no colour.

**Note on the axe suite:** `apps/admin-e2e/src/copilot/a11y.spec.ts` scans the
Agents view, which is downstream of this unit. It asserts nothing about this
package and its passing says nothing about the conformance of anything here.

---

## 5. E2E Coverage Map

This unit has **no e2e suite of its own** — by design, since it has no route.
Its behaviour is asserted twice over: directly by its two spec files, and
indirectly through both consumers' suites.

### Direct — unit tests inside the package

| Feature | Spec | Asserts | Verdict |
| --- | --- | --- | --- |
| F8 authorization | `src/lib/tool-registry.spec.ts:57-74` | `ForbiddenException` on a missing permission **and** that the handler never ran (`ran.value === false`) | ✅ E2E-equivalent — the "did not run" half is the part that matters |
| F8 list-vs-call | `tool-registry.spec.ts:76-92` | `visibleTo` hides it *and* `call` still refuses it by name | ✅ |
| F9 all-of | `tool-registry.spec.ts:94-124` | Both the refusal and the success once the second key is held | ✅ |
| F11 no-requires | `tool-registry.spec.ts:143-149` | Runs for an actor with nothing | ✅ |
| F5 visibleTo | `tool-registry.spec.ts:153-167` | A read actor sees exactly `['content_list']` of three | ⚠️ PARTIAL — one surface only, no `effect` interaction |
| F6 unknown name | `tool-registry.spec.ts:171-177` | `NotFoundException`, distinct from the refusal | ✅ |
| F4 surfaces | `tool-registry.spec.ts:195-223` | Omitted → both; narrowed → withheld from the other | ✅ |
| F7 cross-surface dispatch | `tool-registry.spec.ts:225-238` | `NotFoundException` **and** the handler never ran | ✅ |
| F10 surface stamping | `tool-registry.spec.ts:245-263` | `context.surface === 'mcp'`, and `workspaceId` / `actor.id` pass through untouched | ✅ |
| F2 order | `tool-registry.spec.ts:267-275` | `['a','b','c']` across two providers | ✅ |
| F3 duplicate | `tool-registry.spec.ts:280-285` | `all()` throws `/Duplicate tool name/` | ⚠️ PARTIAL — asserts the throw, **not** that it therefore breaks `call`/`visibleTo` too |
| F14 resource 404 | `tool-registry.spec.ts:289-295` | `NotFoundException` | ✅ |
| F13 first-claim | `tool-registry.spec.ts:297-316` | Second provider's contents returned; first returned `undefined` | ✅ |
| F12 flatten | `tool-registry.spec.ts:318-339` | `[one, two]` in registration order | ✅ |
| F16 404 mapping | `src/lib/tool-error.spec.ts:351-359` | `{status:404, code:'not_found', message}` exactly | ✅ |
| F16 403 mapping | `tool-error.spec.ts:361-367` | `toMatchObject({status:403, code:'forbidden'})` | ✅ |
| F17 issues | `tool-error.spec.ts:370-386` | `issues` array preserved by reference-equality | ✅ |
| F18 array message | `tool-error.spec.ts:388-396` | joined with `'; '` | ✅ |
| F19 opaque 500 | `tool-error.spec.ts:59-70` | Exact opaque shape **and** `JSON.stringify(error)` does not contain `ECONNREFUSED` | ✅ — the negative assertion is what makes this test worth having |

### Indirect — through the MCP surface

| Feature | Spec | Asserts | Verdict |
| --- | --- | --- | --- |
| F8 | `apps/server-e2e/src/server/mcp/mcp.spec.ts:541` | A read token invoking a write tool by name is refused | ✅ |
| F8 (exhaustive) | `mcp.spec.ts:553` | **Each** write tool refused to a read token, in a loop | ✅ — the strongest authorization assertion in the repo |
| F4/F7 | `mcp.spec.ts:379` | No copilot-only tool is listed, at any scope | ✅ |
| F7 | `mcp.spec.ts:495`, `:510` | A copilot-only tool, and `media_propose_file` specifically, refused by name to a **full** token | ✅ — the second is the exact ADR-0007 risk |
| F4 (shared) | `mcp.spec.ts:422`, `:440` | The four shared tools are listed to, and runnable by, a read-scope token | ✅ |
| F10 | `mcp.spec.ts:458` | MCP gets the `/api/v1/…` download path | ✅ |
| F6 | `mcp.spec.ts:588` | Unknown tool → `not_found` | ✅ |
| F12/F13 | `mcp.spec.ts:647`, `:665` | Granted types as resources; a type resource reads back | ⚠️ PARTIAL — nothing asserts an **ungranted** type is absent from `resources/list`, which is the F23 gap |
| F22 | `mcp.spec.ts:736` | "rejects an unknown argument rather than ignoring it" | ⚠️ PARTIAL — this is `content/server`'s own DTO validation, **not** the registry's. It gives false confidence that the surface validates |
| F17 | `mcp.spec.ts:858` | Publish-time validation reported with per-field issues | ✅ |
| — | `mcp.spec.ts:523` | Every tool has an object input schema | ✅ — shape only, never enforced |

### Indirect — through the copilot surface

| Feature | Spec | Asserts | Verdict |
| --- | --- | --- | --- |
| F5 | `apps/server-e2e/src/server/copilot/copilot-chat.spec.ts:579` | A viewer is offered no write tools | ✅ — ADR-0005's mandatory negative case |
| F8 | `copilot-chat.spec.ts:634` | A withheld tool is refused at **execution**, not only at offer | ✅ |
| F4/F7 | `copilot-read-catalogue.spec.ts:138`, `:158` | No MCP-only tool offered, and one named anyway is refused | ✅ |
| F5 | `copilot-read-catalogue.spec.ts:173`, `:197` | A contributor loses `activity_recent` (`activity:read`); a viewer keeps the rest | ✅ — the per-permission slice |
| F10 | `copilot-read-catalogue.spec.ts:485` | The copilot gets the session-gated download path | ✅ |
| F22 | `copilot-chat.spec.ts:445` | Arguments not matching the schema are rejected | ✅ **on this surface only** — see BUG-tools-server-01 |
| F16/F19 | `copilot-chat.spec.ts:411` | A throwing tool becomes a tool error and the run continues | ✅ |

**Coverage tally: 23 features · 15 ✅ · 4 ⚠️ · 4 ❌**

(❌: F20 one-instance-across-modules, F21 optional-registration boot, F22
central input validation, F23 resource authorization.)

---

## 6. 🐞 Potential Bugs

### 🐞 BUG-tools-server-01 — `ToolRegistry.call` never validates arguments against `inputSchema`, so the four shared tools are unvalidated on the MCP surface · Severity: Medium · 🔒 SECURITY

**Location:** `packages/tools/server/src/lib/tool-registry.ts:108-137`
**Category:** correctness / input-validation (defence-in-depth gap)

**What the code does:**

```typescript
const tool = this.forSurface(surface).find((c) => c.name === name);
if (!tool) throw new NotFoundException(`Unknown tool "${name}".`);
if (!this.permits(tool, context)) throw new ForbiddenException(…);
return tool.handler(input, { ...context, surface });
```

`input` goes from the caller straight to the handler. `tool.inputSchema` is
never read — the only place it is read in this package is
`build-mcp-server.ts:50`, where it is **advertised** to the client.

**Why it is wrong:** `ToolDefinition.inputSchema` is documented as "JSON Schema
for the arguments object" (`src/lib/tool.ts:162-163`), and every shared tool
writes real constraints into it — `media_assets_search` declares
`additionalProperties: false`, `kind` as an `enum`, and `pageSize` as an integer
`1..MAX_TOOL_PAGE_SIZE`
(`packages/media/server/src/lib/copilot/media-tool.provider.ts:98-141`). Those
constraints are enforced on the **copilot** surface, because `RunEngine` calls
`validateToolInput(call.input, tool.inputSchema)` before dispatch
(`packages/copilot/server/src/lib/chat/application/run-engine.service.ts:700-703`),
and on the **MCP** surface only for `content/server`'s tools, which run their
own DTO validation (`packages/content/server/src/lib/mcp/content-tools.provider.ts:168`).
The four shared tools have neither. AGENTS.md's own instruction — "Validate
through the HTTP DTO" (`packages/mcp/server/AGENTS.md`) — is advice a tool can
silently skip, and three of the four do. The handler comment at
`media-tool.provider.ts:155-157` even says "Clamped in `run` as well as declared
in the schema: the validator is defence in depth, not the boundary" — on MCP
there is no validator at all, so the clamp *is* the boundary.

**Repro:**
1. `MCP_ENABLED=true npm run dev`, mint a `read`-scope token over a workspace.
2. `curl -s -X POST localhost:3000/api/v1/mcp -H "Authorization: Bearer $T" -H "X-Workspace-Id: $W" -H 'content-type: application/json' -H 'accept: application/json, text/event-stream' -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"media_assets_search","arguments":{"pageSize":"lots","sort":"; DROP","nope":true}}}'`
→ **Observed:** a 200 result. `nope` is silently ignored despite
`additionalProperties: false`; `sort` reaches `this.assets.execute` un-enumerated;
`pageSize` goes through `Math.min(Math.max("lots" ?? 10, 1), MAX)`, which is
`NaN`-propagating arithmetic on a string.
/ **Expected:** a `validation_failed` tool error naming all three, exactly as
the copilot surface produces (`copilot-chat.spec.ts:445`).

**Blast radius:** any MCP client (a third-party agent, a hallucinating model)
reaching the four shared tools. Not a privilege escalation — `requires` and
`ctx.workspaceId` still hold — but every declared bound on those tools is
decorative over MCP, and the asymmetry means a tool author who tests on one
surface has tested nothing about the other. The real risk is the next shared
tool, whose author will reasonably assume the schema is enforced.

**Suggested fix:** call `validateToolInput` inside `ToolRegistry.call` before
dispatch and return the errors as a `BadRequestException`, so both surfaces
inherit it and per-handler DTO validation becomes an additional, not the only,
layer. Do NOT implement it here.

---

### 🐞 BUG-tools-server-02 — Resources bypass the authorization point entirely: no `requires`, no surface narrowing, no permission check · Severity: Medium · 🔒 SECURITY

**Location:** `packages/tools/server/src/lib/tool-registry.ts:139-166` and
`src/lib/tool.ts:197-207`
**Category:** permission-bypass (structural)

**What the code does:**

```typescript
async resources(context: ToolContext): Promise<readonly ResourceDefinition[]> {
    const perProvider = await Promise.all(
        this.providers.map((provider) => provider.resources?.(context) ?? []));
    return perProvider.flat();
}
async readResource(uri: string, context: ToolContext): Promise<ResourceContents> {
    for (const provider of this.providers) {
        const contents = await provider.readResource?.(uri, context);
        if (contents) return contents;
    }
    throw new NotFoundException(`Unknown resource "${uri}".`);
}
```

Neither method calls `this.permits(...)`. `ResourceDefinition`
(`tool.ts:198-207`) has `uri`, `name`, `description`, `mimeType` — and **no**
`requires` field to check even if it wanted to. Neither method filters by
`surface` either.

**Why it is wrong:** this package's entire stated invariant is that
"`ToolRegistry.call` remains the single place a tool call is authorized"
(ADR-0007 §1, restated at `packages/tools/server/AGENTS.md` "The authorization
invariant" and at `tool-registry.ts:27-31`). Resources are a second data-egress
path over the same registry that is *outside* that invariant. Today it is safe
only because `content/server`'s provider scopes to workspace grants itself —
exactly the "a handler must not check its own gate, so a new tool cannot forget
to" property (`tool.ts:139-145`) that resources do not get. The
`ToolContext.surface` protection is also absent: a resource is served to
whichever consumer asks, with no way for a provider to say "MCP only".

**Repro:**
1. Read `tool.ts:197-207` — there is no `requires`.
2. Read `tool-registry.ts:140-166` — there is no `permits` call.
3. Add a provider with `resources: async () => [{ uri: 'ortha://secret', name: 'x', description: 'x', mimeType: 'application/json' }]` and a matching `readResource`.
4. `resources/list` with a **read**-scope token.
→ **Observed:** it is listed and readable, whatever the actor holds.
/ **Expected:** the same `requires`-before-dispatch gate tools get.

**Blast radius:** one provider today (`content/server`), correctly scoped — verified:
`content-tools.provider.ts:430-441` prunes `resources()` to `grantedSummaries`, and
`readResource` (`:445-462`) runs the same `resolveGrantedType` gate as the tools, so
an ungranted type is a 404 there too. **No live exposure.** The defect is that the
guard rail lives in the provider rather than in the registry, so the *next* provider
must remember it.

**Correction to an earlier claim in this artifact:** it previously said the MCP
suite's resource cases assert only the happy path. That is **wrong** —
`apps/server-e2e/src/server/mcp/mcp.spec.ts:660-662` explicitly asserts
`resources.map(e => e.uri)` does **not** contain `ortha://content-type/test_page`,
i.e. the ungranted type is absent from `resources/list`. A regression in the
provider's own scoping *would* be caught. What is genuinely untested is a resource
whose exposure depends on a **permission** rather than a grant, because no such
resource exists to test.

**Suggested fix:** add `requires?: readonly PermissionKey[]` to
`ResourceDefinition` and apply `permits()` in both `resources()` and
`readResource()`, plus a `surfaces?` field narrowed the same way `forSurface`
narrows tools.

---

### 🐞 BUG-tools-server-03 — A duplicate tool name is a runtime landmine on both surfaces, not a boot failure · Severity: Medium

**Location:** `packages/tools/server/src/lib/tool-registry.ts:53-68`, reached
from `:77`, `:93` and `:118`
**Category:** correctness / availability

**What the code does:**

```typescript
all(): readonly ToolDefinition[] {
    const tools: ToolDefinition[] = []; const seen = new Set<string>();
    for (const provider of this.providers)
        for (const tool of provider.tools()) {
            if (seen.has(tool.name)) throw new Error(`Duplicate tool name "${tool.name}" …`);
            seen.add(tool.name); tools.push(tool);
        }
    return tools;
}
```

`forSurface` → `all()`, `visibleTo` → `forSurface` → `all()`, and `call` →
`forSurface` → `all()`. So the duplicate check runs on **every list and every
dispatch**, and throws a plain `Error`.

**Why it is wrong:** failing loudly is right; failing at the wrong *time* is
not. Two plugins claiming one name is a deploy-time wiring bug, and the
codebase's own convention is eager validation at construction —
`CopilotPlugin`'s `assertOptions`
(`packages/copilot/server/src/lib/utils/copilot-plugin.ts:53-90`),
`McpPlugin`'s `assertOptions` (`packages/mcp/server/src/lib/utils/mcp-plugin.ts:22-31`),
`buildModelRegistry`'s duplicate rejection
(`packages/copilot/server/src/lib/infrastructure/model-registry.ts:46-50`),
`buildSkillRegistry`'s (`packages/copilot/domain/src/lib/skills/skill-registry.ts:30-38`).
All four fail before boot. This one boots green and then breaks **every** tool
call on **both** surfaces on the first request, as a bare `Error` — which
`toToolError` will turn into an opaque 500 with the message withheld
(`tool-error.ts:67-77`), so the operator sees "The tool failed unexpectedly" and
has to read the log to find the actual cause. Since `all()` is on the read path
too, `tools/list` 500s as well, so there is no way to discover the catalogue and
diagnose it from outside.

**Repro:** the F3 block in §3. Rename `activity_recent` to
`media_assets_search`, restart → boot succeeds → `tools/list` 500s → every
copilot run fails with a generic frame.

**Blast radius:** total loss of agent capability across both surfaces, at first
use rather than at deploy, with a misleading error at the edge. Also latent:
`resolveCapabilityProfile` has its own duplicate handling that **drops** the
later tool with `reason: 'duplicate-name'`
(`packages/copilot/domain/src/lib/tools/capability-profile.ts:125-129`) — but
it is fed `this.tools.forSurface('copilot')`
(`capability-profile.service.ts:86`), which throws first, so that branch is
unreachable in production.

**Suggested fix:** move the uniqueness check into `register()` so it throws at
`onModuleInit` (deploy time), and keep `all()` a plain concatenation.

---

### 🐞 BUG-tools-server-04 — The refusal message enumerates the tool's required permission keys back to an untrusted model · Severity: Low · 🔒 SECURITY

**Location:** `packages/tools/server/src/lib/tool-registry.ts:124-130`
**Category:** information-disclosure (minor)

**What the code does:**

```typescript
throw new ForbiddenException(
    `"${name}" requires ${tool.requires.join(', ')}, which this ${
        context.actor.kind === 'token' ? 'token' : 'user'
    } does not hold.`);
```

**Why it is wrong:** ADR-0007 §6 argues that naming a *withheld tool* reveals
nothing, "because the list is derived from the caller's own role, which they can
read off their own profile". That argument covers the **name**. It does not
cover the **permission keys**, which this message also emits: a `read`-scope
token learns `content:delete` and `content:publish` exist as distinct keys, and
that `content_media` needs `content:read` *and* `media:read` together. On MCP
this string is handed to a third-party model, and it is also the actor kind
disclosure (`token` vs `user`) telling a caller which authentication path it
took. `tool-error.ts` passes an `HttpException`'s message through verbatim
(`:50-55`), so it reaches the wire unmodified.

**Repro:**
1. Mint a `read`-scope token.
2. `tools/call` `content_media` (requires `content:read` + `media:read`).
→ **Observed:** `"content_media" requires content:read, media:read, which this token does not hold.`
/ **Expected (arguably):** `"content_media" is not available to this token.`

**Blast radius:** an attacker with a low-scope token maps the permission model
without guessing. Low: the permission catalogue is not a secret, `PERMISSIONS`
is in a published npm package, and `GET /api/auth/me` already returns a user's
own grants. Recorded because the field is security-critical and the current text
is more generous than the ADR's reasoning actually licenses.

**Suggested fix:** keep the tool name, drop the key list and the actor kind:
`"content_media" is not available to this caller.` The missing keys stay
available to the operator through `CapabilityProfile.withheld`, which already
carries them (`capability-profile.ts:55-60`).

---

### 🐞 BUG-tools-server-05 — `register()` does not deduplicate providers, and a double registration bricks the whole catalogue · Severity: Low

**Location:** `packages/tools/server/src/lib/tool-registry.ts:42-44`
**Category:** correctness

**What the code does:**

```typescript
register(provider: ToolProvider): void { this.providers.push(provider); }
```

**Why it is wrong:** registration happens from each contributor's
`onModuleInit` (`tool-provider.ts:20-25`). Nest calls `onModuleInit` once per
provider **instance**, but a plugin whose module is instantiated twice — a
dynamic module registered in two places, a test that builds two testing modules
against one global registry, or the `ProposalApplierRegistry` pattern where the
same class is both `@Optional()`-injected *and* listed in `providers` — hands
the same instance in twice. Every one of its tools then collides with itself and
BUG-tools-server-03 fires. The sibling registry in the same codebase gets this
right: `ProposalApplierRegistry.register` refuses a duplicate `kind` with a
loud log and keeps the first
(`packages/copilot/server/src/lib/chat/application/proposal-applier.registry.ts:43-55`).

**Repro:**
1. In any capability plugin, call `this.toolRegistry?.register(this)` twice in `onModuleInit`.
2. Restart, then `tools/list`.
→ **Observed:** 500 `Duplicate tool name`. / **Expected:** the second
registration is a no-op, or throws *at registration* naming the provider.

**Blast radius:** a self-inflicted deploy failure, discovered at first request.
Low because no shipped plugin does it.

**Suggested fix:** `if (this.providers.includes(provider)) return;` in
`register`, or fold the name-uniqueness check into `register` per
BUG-tools-server-03 so both are caught in one place.

---

**Defect tally:** `5 🐞 · 0 Critical · 0 High · 3 Medium · 2 Low · 3 🔒`
**Accessibility tally:** `4 ♿ · 1 Supports · 2 Partially Supports · 0 Does Not Support · 1 Not Applicable`

### Checked and cleared

Things I specifically went looking for and did **not** find a defect in:

- **`surfaces` omitted by accident.** Enumerated all 29 registered tools (§1).
  Every narrowing carries a comment stating the tension; the four shared tools
  are exactly the four AGENTS.md documents; no `propose`/`apply` tool and no
  `admin_*` tool reaches MCP; no `public-api/` tool reaches the copilot.
- **`surfaces` copy-pasted from the neighbour.** The BUGBOT worked example
  (`i18n_locales_list` shared / `i18n_translations_get` copilot-only, in one
  file) is implemented correctly at
  `packages/i18n/server/src/lib/copilot/i18n-tool.provider.ts:87` and `:128`.
- **A permission no token scope mints.** `activity_recent` (`activity:read`) and
  `workspace_members_list` (`users:read`) both declare `['copilot']` explicitly
  rather than relying on `scopePermissions` never minting those keys.
- **Bare `Error` in a shared tool.** All four shared handlers checked:
  `media-tool.provider.ts:292` throws `BadRequestException`; the two bare
  `Error`s at `i18n-tool.provider.ts:141,152` are inside a `['copilot']` tool.
- **Branching on `ToolContext.surface` for authority.** The only reader is
  `downloadPathFor` (`media-tool.provider.ts:356-359`), which changes a URL
  prefix and nothing else. `summarizeAsset` (`:317-329`) returns the same fields
  either way.
- **`ToolContext.surface` assertable by a caller.** It is stamped inside `call`
  (`tool-registry.ts:131-136`) and is not a field on `CreateRunDto` or on the
  MCP request; a caller cannot set it.
- **Permission re-derivation inside a handler.** `ToolActor.userId` is
  documented "attribution only, never authorization" (`tool.ts:41-44`); grepped
  every handler and none reads `actor.id`/`actor.userId` for a decision.
- **`toToolError` leaking internals.** The negative assertion at
  `tool-error.spec.ts:59-70` is genuine and the code path matches.

---

## 7. Recommended E2E Tests

Prose only. Harness key: **unit** = `npx nx test @ortha-cms/tools-server`;
**server-e2e** = `apps/server-e2e` testcontainer + supertest.

| Priority | Harness | Proposed spec | Asserts | Closes |
| --- | --- | --- | --- | --- |
| 1 | unit | `tool-registry.spec.ts` — new `describe('input validation')` | A tool declaring `additionalProperties: false` + an `enum` + numeric bounds is called with an extra key, a bad enum value and an out-of-range number; `call` rejects with a 400-shaped error and the handler never runs (`ran.value === false`) | 🐞 BUG-tools-server-01, F22 ❌ |
| 2 | server-e2e | `mcp.spec.ts` — extend `describe('authorization')` | `tools/call media_assets_search` with `{"nope":1,"pageSize":"lots","kind":"nonsense"}` over a read token returns `isError` with `code: 'validation_failed'`, and the asset list is not returned | 🐞 BUG-tools-server-01 |
| 3 | unit | `tool-registry.spec.ts` — new `describe('resources')` case | A resource declaring `requires: ['content:update']` is absent from `resources(context)` for a `content:read` actor and `readResource` refuses it | 🐞 BUG-tools-server-02, F23 ❌ |
| 4 | server-e2e | `mcp.spec.ts` — extend `describe('discovery')` | `resources/list` for a workspace granted only `test_article` contains no URI for an ungranted type, and `resources/read` on that URI 404s exactly like an unknown one | 🐞 BUG-tools-server-02 (the provider-side half), F12 ⚠️ |
| 5 | unit | `tool-registry.spec.ts` — extend `describe('all')` | After a duplicate is registered, `visibleTo` and `call` **also** throw — pinning the blast radius the current test does not describe. Then, once fixed, that `register()` throws instead | 🐞 BUG-tools-server-03, F3 ⚠️ |
| 6 | unit | `tool-registry.spec.ts` — new case | Registering the same provider instance twice leaves `all()` working and returns each tool once | 🐞 BUG-tools-server-05, EC-21 |
| 7 | server-e2e | new `apps/server-e2e/src/server/tools/one-registry.spec.ts` | With both `McpPlugin` and `CopilotPlugin` registered, `app.get(ToolRegistry)` resolves the same instance the MCP controller and the `RunEngine` hold, and `all()` returns one copy of `media_assets_search` | F20 ❌ |
| 8 | server-e2e | same file | With **neither** consumer registered, boot succeeds and a content route still serves — proving the `@Optional()` contract | F21 ❌ |
| 9 | unit | `tool-registry.spec.ts` — new case | `surfaces: []` is offered to neither surface and `call` 404s it on both, so the dead-tool spelling is a known quantity rather than a surprise | EC-09 |
| 10 | unit | `tool-error.spec.ts` — new cases | An `HttpException` whose `getResponse()` is a bare string; a thrown string; a thrown `null`. Each maps without crashing and none leaks | EC-26, EC-27 |
| 11 | server-e2e | `mcp.spec.ts` + `copilot-read-catalogue.spec.ts` — a shared **table-driven** case | Both suites assert the *same* list constant of shared tool names, so adding a tool that omits `surfaces` fails one suite until it is added to the list deliberately | EC-32, the BUGBOT "cross-surface e2e not updated" pattern |
| 12 | unit | `tool-registry.spec.ts` — perf-shaped case | `all()` over 200 tools is called once per `call`, not once per tool; a regression that made it quadratic would be visible | EC-11 |
