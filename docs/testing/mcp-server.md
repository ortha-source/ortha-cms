# @orthacms/mcp-server — Test Artifact

> **Unit:** `packages/mcp/server` · **Package:** `@orthacms/mcp-server` · **Kind:** server plugin (protocol adapter)
> **Source of truth:** `packages/mcp/server/AGENTS.md`
> **Findings verified:** 2026-08-11 — 9 confirmed · 0 deleted · 1 corrected · 0 unverified
> **Generated:** 2026-08-11

## 1. Scope & Preconditions

**Owns** the Model Context Protocol front door and *nothing else*
([ADR-0006](../adr/0006-cms-as-an-mcp-server.md)): the single route
`POST /api/v1/mcp` (`src/lib/http/mcp.controller.ts:54`), bearer authentication
and workspace resolution (`src/lib/http/mcp-auth.service.ts`), the per-request
JSON-RPC server built over the SDK (`src/lib/protocol/build-mcp-server.ts`), the
kill switch and the server identity clients see
(`src/lib/types/mcp-config.ts`), and the plugin factory's eager config
validation (`src/lib/utils/mcp-plugin.ts`).

**Does NOT own:**

- **The tool registry.** `ToolDefinition` / `ToolContext` / `ToolProvider` /
  `ToolRegistry` / `createToolContext` / `toToolError` all moved to
  `@orthacms/tools-server` ([ADR-0007](../adr/0007-one-tool-registry-two-surfaces.md)).
  This module **imports** `ToolsModule` (`src/lib/mcp.module.ts:30`), never
  provides it. See `docs/testing/tools-server.md`.
- **Any tool.** All 12 MCP content tools come from `content/server`
  (`packages/content/server/src/lib/mcp/content-tools.provider.ts`); the four
  shared ones come from `media/server` and `i18n/server`. **A change to a tool
  you did not write can change what this endpoint exposes.**
- **Any table or migration.** `McpPlugin` declares no `migrations` descriptor
  (`src/lib/utils/mcp-plugin.ts:55-59`).
- **The credential.** Bearer API tokens are minted and verified by
  `identity/server` (`ApiTokenService.verify`, `scopePermissions`).
- **Argument validation** — see 🐞 BUG-mcp-server-01.
- **Resource authorization** — see 🐞 BUG-mcp-server-02.

### Entry points

| Verb + path | Handler | Guards / auth | Notes |
| --- | --- | --- | --- |
| `POST /api/v1/mcp` | `McpController.handle` (`src/lib/http/mcp.controller.ts:65-135`) | `@Public()` (opts out of the global session `AuthGuard`); `McpAuthService.authenticate` is the whole story | Stateless Streamable HTTP, `enableJsonResponse: true` |
| `GET /api/v1/mcp` | same `@All()` handler | same | Authenticated first, then the transport answers **405** (no session exists in stateless mode) |
| `DELETE /api/v1/mcp` | same | same | same |

**Route registration is conditional:** `controllers: config.enabled ? [McpController] : []`
(`src/lib/mcp.module.ts:31`). When `MCP_ENABLED` is not `true` the controller is
never registered and the path **404s from Nest**, before any auth. The
in-handler `ServiceUnavailableException` at `mcp.controller.ts:70-76` is
belt-and-braces for a future wiring change and is unreachable today.

**JSON-RPC methods served** (`src/lib/protocol/build-mcp-server.ts:45-101`):
`initialize` (from the SDK's `Server`), `tools/list`, `tools/call`,
`resources/list`, `resources/read`. Declared capabilities:
`{ tools: {}, resources: {} }` (`:41-43`) — **no** `prompts`, no `logging`, no
`completions`.

**Exported API** (`src/index.ts:3-11`): `McpPlugin`, `McpPluginOptions`,
`McpServerPluginDefinition`, `McpModule`, `MCP_CONFIG`, `InjectMcpConfig`,
`McpPluginConfig`. Deliberately **not** re-exported: the tool seam, with a
comment saying why (`src/index.ts:13-17`).

**DI:** binds `MCP_CONFIG` and `McpAuthService`; imports and re-exports
`ToolsModule` (`src/lib/mcp.module.ts:30`, `:36`). The module is `global: true`.

### Runtime prerequisites

| Requirement | Where |
| --- | --- |
| `MCP_ENABLED=true` | `apps/server/ortha.config.ts:254` — **off by default** |
| Postgres reachable | `docker compose up -d`; `DATABASE_URL` in `.env` |
| Migrations applied | `npx nx run server:db:migrate` (identity's `api_tokens` + `api_token_workspaces`, content's tables) |
| A **workspace** with at least one **granted content type** | the admin's Workspaces page → Content |
| An **API token** | admin → **API Tokens** → mint over one or more workspaces, `read` or `full` scope. The secret is revealed **once** |
| `TOKEN_SECRET` set | `apps/server/ortha.config.ts:107` — token verification depends on it |
| A non-empty `config.name` / `config.version` | else `McpPlugin` throws at construction (`src/lib/utils/mcp-plugin.ts:22-31`) |

**Not required:** a session cookie (deliberately rejected — ADR-0006 §6), the
copilot (`COPILOT_ENABLED` is independent), a `workspaceId` when the token
covers exactly one workspace.

### How to exercise it manually

```bash
docker compose up -d
npx nx run server:db:migrate
MCP_ENABLED=true npm run dev        # or: MCP_ENABLED=true npx nx serve server
```

Then, with `T` = the token secret and `W` = a workspace uuid in its bucket:

```bash
RPC() {
  curl -si -X POST "http://localhost:3000/api/v1/mcp" \
    -H "Authorization: Bearer $T" \
    -H "X-Workspace-Id: $W" \
    -H 'content-type: application/json' \
    -H 'accept: application/json, text/event-stream' \
    -d "$1"
}

RPC '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"curl","version":"0"}}}'
RPC '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'
RPC '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"content_list","arguments":{"typeName":"test_article"}}}'
RPC '{"jsonrpc":"2.0","id":4,"method":"resources/list"}'
```

The `accept` header matters: the Streamable HTTP transport requires both media
types even though `enableJsonResponse: true` means it answers with JSON.

The URL spelling of the workspace, for a client that cannot send headers:

```bash
curl -s -X POST "http://localhost:3000/api/v1/mcp?workspaceId=$W" -H "Authorization: Bearer $T" …
```

Through a real client:

```json
{ "mcpServers": { "ortha-cms": { "command": "npx", "args": ["-y","mcp-remote",
  "http://localhost:3000/api/v1/mcp?workspaceId=<uuid>","--header","Authorization: Bearer <token>"] } } }
```

Automated:

```bash
npx nx test @orthacms/mcp-server                    # 🧪 unit: auth rules + plugin validation
npx nx e2e server-e2e --testPathPatterns=mcp         # wire-level, needs Docker
```

### Dependencies that must be healthy

- `@orthacms/identity-server` — `ApiTokenService.verify`, `scopePermissions`,
  `@Public()`. A revoked token must fail **immediately** (`mcp.spec.ts:198`).
- `@orthacms/workspaces-server` — `WORKSPACE_HEADER` (`'x-workspace-id'`,
  `workspace.guard.ts:7`) and `WORKSPACE_ID_PATTERN` (`workspace-access.ts:10`).
- `@orthacms/tools-server` — the registry. If it holds a duplicate tool name,
  **every** method here 500s (see `docs/testing/tools-server.md`
  🐞 BUG-tools-server-03).
- `@modelcontextprotocol/sdk` — the only runtime dependency ADR-0006 accepted,
  confined to this package (`build-mcp-server.ts:1-7`, `mcp.controller.ts:11`).
- The **capability plugins** — this endpoint owns no tools; if `ContentPlugin`
  is absent, `tools/list` correctly returns `{"tools":[]}`.

---

## 2. Feature Inventory

| # | Feature | Where it lives | Coverage |
| --- | --- | --- | --- |
| F1 | `MCP_ENABLED` gates the route — the controller is not registered when off | `src/lib/mcp.module.ts:31` | ✅ E2E `apps/server-e2e/src/server/mcp/mcp.spec.ts:899` |
| F2 | Missing `Authorization` header → 401 | `src/lib/http/mcp-auth.service.ts:69-74` | ✅ E2E `mcp.spec.ts:175` |
| F3 | Unknown / revoked / expired token → one flat 401 | `mcp-auth.service.ts:76-81` | ✅ E2E `mcp.spec.ts:183`, `:198` |
| F4 | A **session cookie** is not accepted | `mcp.controller.ts:52` `@Public()` + `mcp-auth.service.ts:69` | ✅ E2E `mcp.spec.ts:189` |
| F5 | Non-`Bearer` scheme, or `Bearer` with no value → treated as absent | `mcp-auth.service.ts:148-158` | ⚠️ PARTIAL — `mcp.spec.ts:175` covers absent only |
| F6 | Single-workspace token needs no workspace header | `mcp-auth.service.ts:118-121` | ✅ E2E `mcp.spec.ts:210` |
| F7 | Multi-workspace token naming none → 400 with the count and the fix | `mcp-auth.service.ts:122-124` | ✅ E2E `mcp.spec.ts:221` |
| F8 | `X-Workspace-Id` selects one from the bucket | `mcp-auth.service.ts:83-86` | ✅ E2E `mcp.spec.ts:229` |
| F9 | `?workspaceId=` on the URL is the second spelling | `mcp.controller.ts:139-142`, `mcp-auth.service.ts:85` | ✅ E2E `mcp.spec.ts:254` |
| F10 | The header **wins** when both are present | `mcp-auth.service.ts:85` (`?? `) | ❌ NONE |
| F11 | A malformed workspace id → 400 | `mcp-auth.service.ts:126-128` | ❌ NONE |
| F12 | A workspace outside the bucket → 403, indistinguishable from non-existent | `mcp-auth.service.ts:129-135` | ✅ E2E `mcp.spec.ts:276` |
| F13 | The actor is the **token**, not the minting user | `mcp-auth.service.ts:88-99` | ⚠️ PARTIAL — implied by `:198`; no test asserts `actor.id` is the token id |
| F14 | Permissions come from `scopePermissions(token.scope)` | `mcp-auth.service.ts:93` | ✅ E2E `mcp.spec.ts:309`, `:325` |
| F15 | `initialize` reports name, version and capabilities | `build-mcp-server.ts:41-43` | ✅ E2E `mcp.spec.ts:286` |
| F16 | `tools/list` reflects the caller's scope | `build-mcp-server.ts:45-57` | ✅ E2E `mcp.spec.ts:309`, `:325` |
| F17 | `tools/list` annotates `readOnlyHint` / `destructiveHint` | `build-mcp-server.ts:51-55` | ✅ E2E `mcp.spec.ts:351` |
| F18 | No copilot-only tool is **listed** | `build-mcp-server.ts:46` via `visibleTo(ctx,'mcp')` | ✅ E2E `mcp.spec.ts:379` |
| F19 | No copilot-only tool is **callable** | `build-mcp-server.ts:62-67` via `registry.call(…,'mcp')` | ✅ E2E `mcp.spec.ts:495`, `:510` |
| F20 | The four shared tools are listed and runnable to a `read` token | registry, not here | ✅ E2E `mcp.spec.ts:422`, `:440` |
| F21 | `ToolContext.surface === 'mcp'` gives the bearer-fetchable download path | stamped in `ToolRegistry.call` | ✅ E2E `mcp.spec.ts:458` |
| F22 | `tools/call` returns **both** `content` (text) and `structuredContent` | `build-mcp-server.ts:68-75` | ⚠️ PARTIAL — every test reads one or the other, none asserts they agree |
| F23 | A non-object result is boxed under `value` | `build-mcp-server.ts:111-117` | ❌ NONE |
| F24 | A tool failure is an `isError` **result**, not a JSON-RPC error | `build-mcp-server.ts:76-88` | ✅ E2E `mcp.spec.ts:541`, `:588`, `:858` |
| F25 | `resources/list` — every provider's resources, flattened | `build-mcp-server.ts:91-93` | ⚠️ PARTIAL `mcp.spec.ts:647` (positive only) |
| F26 | `resources/read` — one resource by URI | `build-mcp-server.ts:95-101` | ✅ E2E `mcp.spec.ts:665` |
| F27 | The whole exchange is torn down on response close | `mcp.controller.ts:104-107` | ❌ NONE |
| F28 | An unexpected throw → JSON-RPC `-32603` with `id: null`, logged with the token id | `mcp.controller.ts:114-134` | ❌ NONE |
| F29 | `GET` / `DELETE` are answered by the transport with 405 | `mcp.controller.ts:65` `@All()` | ❌ NONE |
| F30 | Excluded from the OpenAPI document | `mcp.controller.ts:53` `@ApiExcludeController()` | ❌ NONE |
| F31 | `McpPlugin` rejects a blank `name` at construction | `src/lib/utils/mcp-plugin.ts:23-27` | 🧪 UNIT `src/lib/utils/mcp-plugin.spec.ts` |
| F32 | `McpPlugin` rejects a blank `version` at construction | `mcp-plugin.ts:28-30` | 🧪 UNIT `mcp-plugin.spec.ts` |
| F33 | The registry stays bound when the endpoint is disabled | `src/lib/mcp.module.ts:30`, `:36` | ⚠️ PARTIAL — implied by the copilot suite passing with `MCP_ENABLED` unset |
| F34 | **Argument validation against `inputSchema`** | *not implemented at this layer* | ❌ NONE → 🐞 BUG-mcp-server-01 |
| F35 | **JSON-RPC batch / notification / unknown-method handling** | delegated to the SDK | ❌ NONE |

---

## 3. Manual Test Plan

**Global preconditions:** `docker compose up -d`; `.env` with `DATABASE_URL`,
`SESSION_SECRET`, `TOKEN_SECRET`; `npx nx run server:db:migrate`;
`MCP_ENABLED=true npm run dev`. Two workspaces `W1`, `W2`, both granting
`test_article`, with at least one **published** and one **draft** entry in `W1`.
Three tokens minted from the admin's **API Tokens** page: `TR` (`read`, W1
only), `TF` (`full`, W1 only), `TM` (`full`, W1 **and** W2). Use the `RPC()`
shell function from §1.

**Keyboard-only path / screen-reader expectation for every block below:** the
manual steps are `curl` invocations at a terminal, fully operable from the
keyboard with no pointer; a screen-reader user reads the JSON response in their
terminal emulator. This unit renders no UI — see §4A.

### F1 — the kill switch actually gates the route

**Preconditions:** none beyond the server.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Restart with `MCP_ENABLED` unset (`npm run dev`) | Boot succeeds, no warning |
| 2 | `curl -si -X POST localhost:3000/api/v1/mcp -H "Authorization: Bearer $TF" -d '{}'` | **404** with Nest's `{"message":"Cannot POST /api/v1/mcp","statusCode":404}` — not 503, not 401. The controller was never registered |
| 3 | `curl -si localhost:3000/api/v1/mcp` (no token) | **404**. The flag is not a UI-only gate |
| 4 | Start a copilot run from the admin panel | Works — the registry is still bound (`mcp.module.ts:30`) |
| 5 | Restart with `MCP_ENABLED=true` | `RPC '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'` → 200 with a tool array |

### F2–F5 — bearer authentication

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `curl -si -X POST localhost:3000/api/v1/mcp -H 'content-type: application/json' -H 'accept: application/json, text/event-stream' -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}'` | **401** `Missing \`Authorization: Bearer <token>\` header.` The JSON-RPC state machine is never entered |
| 2 | Same with `-H "Authorization: Bearer not-a-real-token"` | **401** `Invalid API token.` |
| 3 | Revoke `TR` in the admin, then `RPC` `tools/list` with it | **401**, same message. Revocation is instant |
| 4 | Same with `-H "Authorization: Basic $TF"` | **401** — a non-`Bearer` scheme reads as absent (`mcp-auth.service.ts:152-155`) |
| 5 | Same with `-H "Authorization: Bearer"` (no value) | **401** (`:156-157`) |
| 6 | Same with `-H "Authorization:   bearer    $TF"` (lower case, extra spaces) | **200** — the scheme compare is case-insensitive and the split is on `\s+` |
| 7 | Sign in to the admin, copy the session cookie, and send it with **no** `Authorization` header | **401**. A cookie is never accepted (ADR-0006 §6) |
| 8 | Send **both** a valid session cookie and a valid bearer token | **200**, authorized as the **token** — the cookie is ignored entirely |

### F6–F12 — workspace resolution

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `RPC tools/list` with `TR` and **no** `X-Workspace-Id`, no `?workspaceId=` | **200** — a single-workspace token resolves to its one workspace (`mcp-auth.service.ts:118-121`) |
| 2 | Same with `TM` (two workspaces) | **400** `This token covers 2 workspaces — name the one you want with the x-workspace-id header or a ?workspaceId= query parameter on the MCP endpoint URL.` |
| 3 | `TM` + `-H "X-Workspace-Id: $W2"`, then `tools/call content_list` | Returns `W2`'s entries only |
| 4 | `TM` + `?workspaceId=$W2` on the URL, no header | Same result — the two spellings agree |
| 5 | `TM` + `-H "X-Workspace-Id: $W1"` **and** `?workspaceId=$W2` | Resolves to **`W1`** — the header wins (`mcp-auth.service.ts:85`) |
| 6 | `TR` + `-H "X-Workspace-Id: not-a-uuid"` | **400** `Malformed x-workspace-id.` |
| 7 | `TR` + `-H "X-Workspace-Id: $W2"` (outside its bucket) | **403** `This token does not cover that workspace.` |
| 8 | `TR` + `-H "X-Workspace-Id: 00000000-0000-0000-0000-000000000000"` (no such workspace) | **403**, the *same* message — a token cannot probe which workspace ids exist |
| 9 | `TR` + two `X-Workspace-Id` headers, `$W1` then `$W2` | **200**, scoped to `$W1` — `headerValue` takes the first (`mcp-auth.service.ts:140-142`) |

### F13–F14 — the actor is the token

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `RPC tools/call content_create` with `TF`, creating an entry | Succeeds. In the admin's entry Versions tab the revision's author is **empty / "—"**, not the user who minted the token (ADR-0006 consequences: "Writes are attributed to a token, not a person") |
| 2 | Disable the minting **user** in the admin, then repeat | Still succeeds — the user's own grants are never consulted (`mcp-auth.service.ts:94-96`). Revoke the **token** to stop it |
| 3 | `RPC tools/list` with `TR` | 7 read `content_*` tools + the 4 shared ones. No `content_create`/`update`/`publish`/`unpublish`/`delete` |
| 4 | `RPC tools/list` with `TF` | All 12 `content_*` + the 4 shared |

### F15 — `initialize`

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `RPC '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"curl","version":"0"}}}'` | `result.serverInfo` = `{"name":"ortha-cms","version":"1.0.0"}` (from `ortha.config.ts:257-258`), and `result.capabilities` has `tools` and `resources` and **not** `prompts` or `logging` |
| 2 | Set `config.name` to `''` in `ortha.config.ts` and restart | **Boot fails** with `McpPlugin requires a non-empty \`config.name\`…` — before any request |

### F16–F21 — `tools/list` and `tools/call`

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `RPC tools/list` with `TF`; inspect `content_delete` | `annotations.readOnlyHint === false`, `annotations.destructiveHint === true` |
| 2 | Same; inspect `content_list` | `readOnlyHint === true`, `destructiveHint === false` |
| 3 | Same; grep the names for `admin_` or `propose` | **No match**, at either scope |
| 4 | `RPC tools/call` with `"name":"content_propose_update"` and `TF` | `result.isError === true`; the text parses to `{"status":404,"code":"not_found","message":"Unknown tool \"content_propose_update\"."}` — **not** `forbidden` |
| 5 | `RPC tools/call` with `"name":"media_propose_file"` and `TF` (which holds `media:create`) | Same `not_found`. This is the exact case ADR-0007 names as the cost of getting `surfaces` wrong |
| 6 | `RPC tools/call media_assets_search {"pageSize":1}` with `TR` | `items[0].downloadPath` starts `/api/v1/media/assets/` |
| 7 | `curl` that path with `-H "Authorization: Bearer $TR"` | **200** with the bytes — the path the model was given is one the caller can actually fetch |

### F22–F24 — result shapes

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `RPC tools/call content_list {"typeName":"test_article"}` | `result.content[0].type === 'text'`; `JSON.parse(result.content[0].text)` deep-equals `result.structuredContent` |
| 2 | `RPC tools/call content_delete` on an entry, with `TR` | `result.isError === true`; text parses to `{"status":403,"code":"forbidden",…}`; **no** `result.error` key — the failure rides as a result so a model can recover |
| 3 | Confirm nothing was deleted with `TF` + `content_get` | The entry is still there |
| 4 | `RPC tools/call content_create` with a `title` over the field's max | `isError: true`, `code: "validation_failed"`, and an `issues` array naming the field |

### F25–F26 — resources

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `RPC resources/list` with `TR` | One entry per granted content type, `uri` shaped `ortha://content-type/test_article`, `mimeType: 'application/json'` |
| 2 | Revoke `test_article` from `W1` in the admin, repeat | The entry is gone from the list |
| 3 | `RPC '{"jsonrpc":"2.0","id":1,"method":"resources/read","params":{"uri":"ortha://content-type/test_article"}}'` | `result.contents[0].text` parses to the type's field schema |
| 4 | Same with `"uri":"ortha://content-type/never_granted"` | An error naming the URI — and it must be the **same** answer as a type that does not exist at all |

### F27–F28 — teardown and the failure path

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Run 200 `tools/list` calls in a loop; watch RSS (`node --inspect`, or `ps`) | Memory returns to baseline — `response.on('close')` closes the transport and the protocol server (`mcp.controller.ts:104-107`) |
| 2 | `docker compose stop` (kill Postgres), then `RPC tools/call content_list` | `isError: true` with the **opaque** `{"status":500,"code":"internal_error","message":"The tool failed unexpectedly. See the server logs."}`. The connection string appears only in the server log |
| 3 | Send a body that is not JSON at all: `-d 'not json'` | Express's body parser rejects it before the controller — a 400 from Nest, not a JSON-RPC frame |

### F29 — the other verbs

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `curl -si -X GET localhost:3000/api/v1/mcp -H "Authorization: Bearer $TF"` | **405** from the transport (a stateless server has no SSE stream to open), not Nest's 404 |
| 2 | `curl -si -X DELETE …` with the same header | **405** |
| 3 | `curl -si -X GET localhost:3000/api/v1/mcp` with **no** token | **401** — authentication runs before the protocol layer (`mcp.controller.ts:78-87`), so the verb answer is not reachable unauthenticated |

### F30 — OpenAPI exclusion

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `curl -s localhost:3000/reference/json \| grep -c 'v1/mcp'` | `0` — `@ApiExcludeController()` keeps a JSON-RPC route out of a REST document |

### F31–F33 — plugin construction and the disabled state

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `npx nx test @orthacms/mcp-server` | The `mcp-plugin.spec.ts` cases pass: blank name and blank version each throw at construction |
| 2 | Set `MCP_ENABLED=false`, `COPILOT_ENABLED=true`, restart | `POST /api/v1/mcp` 404s; a copilot run still calls `media_assets_search` successfully. The registry is bound either way |

### F34 — argument validation (the gap)

| Step | Action | Expected result / **Observed** |
| --- | --- | --- |
| 1 | `RPC tools/call content_list {"typeName":"test_article","nope":1}` | **400-shaped `isError`** naming `nope` — content's own DTO validation catches it (`mcp.spec.ts:736`) |
| 2 | `RPC tools/call media_assets_search {"nope":1,"pageSize":"lots","kind":"anything"}` | **Expected** the same, since `media_assets_search`'s schema declares `additionalProperties: false`, `pageSize` as an integer 1..max and `kind` as an enum. **Observed:** a 200 result — nothing between the wire and the handler reads the schema. → 🐞 BUG-mcp-server-01 |

### F35 — JSON-RPC protocol edges

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `RPC '{"jsonrpc":"2.0","id":1,"method":"prompts/list"}'` | JSON-RPC error `-32601` (method not found), because `prompts` is not in the declared capabilities |
| 2 | `RPC '{"jsonrpc":"2.0","method":"notifications/initialized"}'` (a **notification** — no `id`) | **202 Accepted** with an empty body. A notification gets no response |
| 3 | `RPC '[{"jsonrpc":"2.0","id":1,"method":"tools/list"},{"jsonrpc":"2.0","id":2,"method":"resources/list"}]'` (a batch) | An array of two results, ids echoed. Each is authorized against the **same** context — one bearer check, many operations |
| 4 | `RPC '{"jsonrpc":"2.0","id":null,"method":"tools/list"}'` | The SDK's answer for a null id. Record whatever it is; nothing pins it |
| 5 | `RPC '{"jsonrpc":"1.0","id":1,"method":"tools/list"}'` | A JSON-RPC error, not a 500 |
| 6 | `RPC '{"jsonrpc":"2.0","id":1}'` (no `method`) | A JSON-RPC error `-32600`, not a 500 |

---

## 4. Edge Cases & Negative Paths

### Empty / zero

- **EC-01 — Empty request body (`-d ''`).** `❌ NONE`
  Express's json parser yields `undefined`; `transport.handleRequest(req, res, request.body)` gets `undefined` and the SDK must produce a parse error. Confirm it is a JSON-RPC error and not a 500 with a stack.
- **EC-02 — `tools/call` with `arguments` absent.** `⚠️ PARTIAL`
  `build-mcp-server.ts:66` defends with `args ?? {}`. The handler then gets `{}` and the tool's own required-field check fires. `mcp.spec.ts:748` ("requires a locator on a single-entry read") is the closest case.
- **EC-03 — A workspace with no granted types.** `❌ NONE`
  `tools/list` still returns all 12 `content_*` names (they are generic with `typeName` as an argument — ADR-0006 §4); `resources/list` returns `[]`; every `content_*` call 404s. A model sees capability it cannot use anywhere — worth a case.
- **EC-04 — No capability plugin registered.** `❌ NONE` `tools/list` → `{"tools":[]}`, `initialize` still succeeds.
- **EC-05 — A token whose scope maps to an empty permission set.** `❌ NONE` `visibleTo` returns nothing and every call 403s.

### Boundary

- **EC-06 — `?workspaceId=` repeated.** `❌ NONE`
  Express parses `?workspaceId=a&workspaceId=b` into an **array**; `workspaceQuery` (`mcp.controller.ts:139-142`) requires `typeof raw === 'string'` and returns `undefined`. For a single-workspace token the request then **succeeds** against that one workspace while naming two. For a multi-workspace token it 400s. Fails safe, silently ignores the caller's intent. Same for `?workspaceId[]=a`.
- **EC-07 — `X-Workspace-Id` with surrounding whitespace.** `❌ NONE` `WORKSPACE_ID_PATTERN.test(' <uuid> ')` — no trim happens, so this is a 400. Confirm the pattern is anchored.
- **EC-08 — A token bucket of exactly one, naming that same workspace explicitly.** `❌ NONE` Should behave identically to naming none.
- **EC-09 — `pageSize` at the documented maximum, and one above.** `⚠️ PARTIAL` `content_list` enforces it through its DTO; `media_assets_search` clamps in the handler and, on this surface, has no schema enforcement (F34).
- **EC-10 — Offset/page past the end.** `❌ NONE` Expect an empty `items` with a truthful `total`, not an error.
- **EC-11 — A tool name of 10 000 characters.** `❌ NONE` `forSurface().find()` misses → `not_found`, and the name is echoed in the message: `Unknown tool "<10 000 chars>"`. An unbounded echo of caller input into a response. Low, but a case.

### Size & encoding

- **EC-12 — A 10 MB request body.** `❌ NONE` Governed by the host's body-parser limit, not by anything here. Determine and document the limit; a client uploading a large `content_create` body is a realistic use.
- **EC-13 — A tool result of 10 MB.** `❌ NONE` `build-mcp-server.ts:73-74` serialises it **twice** — once pretty-printed for the text block, once as `structuredContent`. Peak memory is ~3× the payload per request, and nothing truncates. Category: perf.
- **EC-14 — Unicode / emoji / RTL in an entry title read back through `content_get`.** `❌ NONE` `JSON.stringify` handles it; assert it survives the double encoding intact.
- **EC-15 — HTML/script in a text field.** `❌ NONE` MCP returns it verbatim, correctly — it is data, and the *client* is responsible. Worth a case that it is neither escaped nor stripped, so behaviour is known.
- **EC-16 — Path traversal in `typeName` (`../../etc/passwd`).** `⚠️ PARTIAL` The content registry is a name lookup, so this 404s exactly like an unknown type (`mcp.spec.ts:633` covers the ungranted variant).
- **EC-17 — SQL-ish input in `search`.** `❌ NONE` Drizzle parameterises; assert it returns zero results rather than erroring.

### Permission matrix

MCP has no roles — the axis is **token scope**. The role axis applies only in
so far as the *minting* user's role decided what scope they could mint.

| Actor | `tools/list` | read call | write call | cross-tenant call | Denial code |
| --- | --- | --- | --- | --- | --- |
| No `Authorization` header | — | — | — | — | **401** |
| Malformed / unknown / revoked / expired token | — | — | — | — | **401**, one flat message |
| Session cookie only | — | — | — | — | **401** |
| `read` scope | 7 reads + 4 shared | 200 | `isError` **403** | n/a | 403 (tool-level) |
| `full` scope | 12 + 4 shared | 200 | 200 | — | — |
| Any scope, workspace outside bucket | — | — | — | — | **403** at auth |
| Any scope, non-existent workspace | — | — | — | — | **403** — same as above, deliberately |
| Any scope, ungranted content type | listed | `not_found` | `not_found` | — | **404**, same as an unknown type (`mcp.spec.ts:633`) |
| Any scope, entry in another workspace | — | `not_found` | `not_found` | ✅ `mcp.spec.ts:700`, `:877` | 404 |

- **EC-18 — Enumeration signal at the token layer.** `✅ E2E` Unknown, revoked and expired all answer `401 Invalid API token.` (`mcp-auth.service.ts:78-81`; `mcp.spec.ts:183`, `:198`).
- **EC-19 — Enumeration signal at the workspace layer.** `✅ E2E` Not-in-bucket and no-such-workspace are one 403 (`mcp-auth.service.ts:130-134`; `mcp.spec.ts:276`). Note this is **403, not 404** — which for a cross-tenant answer the spec's own guidance calls out as an enumeration signal. It is defensible here because the *token bucket* is the caller's own property and 403 says "your token, not this workspace" — but it does confirm to a caller that some workspaces exist outside their bucket. Recorded as EC, not a bug.
- **EC-20 — Enumeration signal at the tool layer.** `✅ E2E` Deliberately **different**: unknown → 404, unpermitted → 403 (ADR-0007 §6). See `docs/testing/tools-server.md` 🐞 BUG-tools-server-04.
- **EC-21 — Enumeration signal at the data layer.** `✅ E2E` Uniform 404 (`mcp.spec.ts:633`).

### Tenant isolation

- **EC-22 — Same entry id, other workspace, read.** `✅ E2E` `mcp.spec.ts:700`.
- **EC-23 — Same entry id, other workspace, write.** `✅ E2E` `mcp.spec.ts:877`.
- **EC-24 — Same entry id, other workspace, *counted*.** `❌ NONE` `content_list`'s `total` must not include rows from another workspace even when the page does not.
- **EC-25 — A shared media tool across the bucket.** `⚠️ PARTIAL` `copilot-read-catalogue.spec.ts:446` asserts it for the copilot surface; the MCP surface reaches the same handler and no MCP test covers it.
- **EC-26 — A token whose bucket shrinks between two calls.** `❌ NONE` `authenticate` runs per request, so the second call must 403. Nothing asserts it.

### Concurrency

- **EC-27 — Two `tools/call` on one entry at once.** `❌ NONE` Serialised by content's per-entry advisory lock, not by anything here.
- **EC-28 — 50 concurrent requests on one token.** `❌ NONE` Each builds its own transport + `Server` (`mcp.controller.ts:89-100`). Confirm no cross-talk and no leak.
- **EC-29 — A token revoked mid-request.** `❌ NONE` Auth already happened; the call completes. Correct and worth pinning.

### State after mutation

- **EC-30 — `content_create` then `tools/list`.** `❌ NONE` The tool list is generic, so it must not change. A regression to per-type tools would show here.
- **EC-31 — Granting a content type mid-session.** `❌ NONE` Stateless, so the next `resources/list` reflects it immediately. That is the point of per-request server construction (`build-mcp-server.ts:22-28`).

### Failure & partiality

- **EC-32 — A tool handler that never resolves.** `❌ NONE` `registry.call` has no timeout and `ToolContext.signal` is undefined on this surface (only the copilot supplies one — `tool.ts:60-66`). The HTTP request hangs until the client or a proxy gives up; `response.on('close')` then fires and tears the server down, but the handler keeps running.
- **EC-33 — A throw *after* the transport sent headers.** `❌ NONE` `mcp.controller.ts:119` guards with `if (!response.headersSent)`, so nothing is written — and nothing calls `response.end()` either. The client waits for a body that never arrives until the socket times out. → 🐞 BUG-mcp-server-03.
- **EC-34 — Client disconnects mid-call.** `❌ NONE` `close` fires, transport and server close, the in-flight handler is not cancelled (no signal). Work continues to completion with nobody reading it.
- **EC-35 — `server.connect(transport)` failing.** `❌ NONE` Falls into the same catch as EC-33.
- **EC-36 — Postgres down.** `⚠️ PARTIAL` Auth itself needs the DB (`ApiTokenService.verify`), so this surfaces as a 500 from the controller's catch **before** the JSON-RPC layer, with `error.stack` logged. Assert no stack reaches the wire.

### Idempotency & replay

- **EC-37 — The same `tools/call` twice.** `❌ NONE` MCP deliberately has no repeat guard (unlike the copilot's — `run-engine.service.ts:715-726`). `content_create` twice makes **two** entries. Correct for an external agent; worth a case so the asymmetry is documented.
- **EC-38 — Replaying a captured request.** `❌ NONE` Stateless bearer auth means a captured request replays until the token is revoked. No nonce, no timestamp. That is the same posture as `/api/v1/*` and is inherited, not introduced.
- **EC-39 — The same JSON-RPC `id` reused across requests.** `❌ NONE` Each request is its own server; ids need not be unique across them.

### Protocol specifics

- **EC-40 — `accept` header missing.** `❌ NONE` Streamable HTTP requires `application/json, text/event-stream`; the transport should 406. Confirm the message names the fix, because it is the single most common first-run failure.
- **EC-41 — `Content-Type` not `application/json`.** `❌ NONE` Express's parser skips it, `request.body` is `undefined`, and it falls to EC-01.
- **EC-42 — `Mcp-Session-Id` sent by a client that thinks it has a session.** `❌ NONE` `sessionIdGenerator: undefined` means stateless; the header should be ignored, not rejected.
- **EC-43 — A batch mixing a request and a notification.** `❌ NONE` The response array should contain only the request's result.
- **EC-44 — `params` 1 MB deep-nested.** `❌ NONE` Guard against a parser stack overflow becoming a 500 with a stack in the log but, per `mcp.controller.ts:114-134`, an opaque JSON-RPC `-32603` on the wire.

---

### 4A. Accessibility & Section 508 Conformance

**This unit renders no UI.** It serves one JSON-RPC route consumed by machines.
It has no DOM, no focusable element, no colour, no timing that a person
experiences directly. The block is short by design; everything not listed is
**Not Applicable**.

**Standards tested against:** Revised Section 508 (36 CFR Part 1194,
Appendices A–C), which incorporates WCAG 2.0 A+AA by reference (E205.4 for
electronic content, 504.2 for authoring tools). Verdicts below cite WCAG **2.1**
AA SC numbers alongside the 508 provision, per this repo's `accessibility`
skill.

**What genuinely applies:**

- **♿ A11Y-mcp-server-01 — Tool failures reach the client as readable prose and
  a machine code, not a bare status.** WCAG **3.3.1 Error Identification (A)** ·
  508 **E205.4** · Verdict: **Supports**
  `src/lib/protocol/build-mcp-server.ts:76-88` returns a failure as an `isError`
  **result** carrying `toToolError`'s `{status, code, message, issues?}` rather
  than a JSON-RPC protocol error. The comment at `:78-83` states the reason
  precisely: a protocol error aborts the client's call, an `isError` result is
  handed back to the model, which can read the sentence and fix its next call.
  For a human driving an MCP client, this is the difference between an assistant
  saying "title must be at most 200 characters" and one saying "something went
  wrong". Screen-reader experience: whatever the MCP client renders — this unit
  supplies text, which is the prerequisite.

- **♿ A11Y-mcp-server-02 — Authentication and workspace errors name the
  remedy.** WCAG **3.3.3 Error Suggestion (AA)** · 508 **E205.4** · Verdict:
  **Supports**
  `src/lib/http/mcp-auth.service.ts:71-73` says exactly which header is missing;
  `:122-124` names the count of workspaces *and* both ways to select one. A
  person configuring `mcp-remote` from a JSON file gets an actionable sentence
  rather than `400`. The 401 for an invalid token is deliberately uniform
  (`:78-81`) — that is a security decision that trades error suggestion for
  non-enumeration, and it is the correct trade; recorded so the tension is
  visible rather than accidental.

- **♿ A11Y-mcp-server-03 — Tool `description` text is the only documentation an
  assistive path gets, and it is written for a model.** WCAG **3.1.5 Reading
  Level (AAA, advisory)** · 508 **E205.4** · Verdict: **Partially Supports**
  `ToolDefinition.description` is served verbatim to the client
  (`build-mcp-server.ts:49`) and MCP clients display it in tool pickers to
  humans. The shipped descriptions are written for a model — e.g.
  `packages/media/server/src/lib/copilot/media-tool.provider.ts:91-97` runs to
  seven lines of workflow rules in one paragraph. `title` exists and is short
  (`build-mcp-server.ts:48`, `:52`), so a client has a concise accessible name
  available; the long description is supplementary. Remediation: none needed at
  this layer — the two fields already separate the short name from the long
  prose, and a client is responsible for which it announces.

- **♿ A11Y-mcp-server-04 — 504 Authoring Tool: this endpoint hands an external
  agent content-authoring capability.** WCAG n/a · 508 **504.2 / 504.3** ·
  Verdict: **Does Not Support**
  Section 508 §504 applies to authoring tools, and `content_create` /
  `content_update` (`packages/content/server/src/lib/mcp/content-tools.provider.ts:299`,
  `:324`) let an external agent write CMS content over this route. §504.2
  requires an authoring tool to enable production of conformant content, and
  §504.3 requires it to *prompt* authors for accessibility information. This
  endpoint does neither: the tool descriptions carry workflow rules ("a create
  yields a draft, publish is separate") and **no** accessibility guidance, and
  there is no field, no validation and no warning about alt text, heading
  structure or table headers in the values an agent writes. An agent can create
  a `richtext` body full of images with no alt attributes and it will publish
  without objection.
  Repro: `tools/call content_create` with a body containing
  `<img src="…">` and no `alt`; then `content_publish`. → Observed: published,
  no warning. Expected under §504.3: at minimum, a prompt or a validation
  message.
  Keyboard/screen-reader experience: downstream — the *readers* of that content
  meet a missing alt text.
  Remediation: put the accessibility contract in the tool `description` (it is
  the only documentation a model gets — ADR-0006 consequences say so
  explicitly), and consider a publish-time check. Cross-references
  ♿ A11Y-copilot-server-02 and ♿ A11Y-copilot-admin-10, which are the same
  defect on the other surface. Do NOT implement.

- **♿ A11Y-mcp-server-05 — Progress and status structure for a client to
  announce.** WCAG **4.1.3 Status Messages (AA)** · 508 **502.3** · Verdict:
  **Not Applicable**
  `enableJsonResponse: true` (`mcp.controller.ts:95`) means one request, one
  response — nothing streams, so there is no progress to announce and no live
  region to get wrong. The `GET` SSE stream is deliberately 405'd. This is the
  opposite of the copilot's streaming problem and is worth stating plainly: the
  MCP surface has no 4.1.3 exposure at all.

**Not Applicable:** 1.1.1, 1.3.1, 1.3.2, 1.3.5, 1.4.1, 1.4.3, 1.4.4, 1.4.10,
1.4.11, 1.4.12, 1.4.13, 2.1.1, 2.1.2, 2.2.1, 2.4.1, 2.4.2, 2.4.3, 2.4.6, 2.4.7,
3.1.1, 3.1.2, 3.2.1, 3.2.2, 3.3.2, 3.3.4, 4.1.2 — no user interface, no
document, no focusable element, no timing a person experiences, no colour.

**Note on the axe suite:** `apps/admin-e2e/src/copilot/a11y.spec.ts` scans the
admin's Agents view only. It never touches this endpoint, and its passing says
nothing about anything here.

---

## 5. E2E Coverage Map

`apps/server-e2e/src/server/mcp/mcp.spec.ts` (927 lines) drives **raw JSON-RPC**
over supertest against a testcontainer — the right shape, because that is the
contract clients depend on. Plus `packages/mcp/server/src/lib/http/mcp-auth.service.spec.ts`
and `src/lib/utils/mcp-plugin.spec.ts` as unit tests.

| Feature | Spec | Asserts | Verdict |
| --- | --- | --- | --- |
| F1 kill switch | `mcp.spec.ts:899` "unmounts the endpoint when disabled" | The route is gone when `enabled: false` | ✅ E2E — the important half (route-level, not UI-level) |
| F2 no header | `mcp.spec.ts:175` | 401 | ✅ |
| F3 unknown token | `mcp.spec.ts:183` | 401 | ✅ |
| F3 revoked | `mcp.spec.ts:198` | 401 **once revoked**, i.e. instant | ✅ — the ADR-0006 §5 claim, tested |
| F4 cookie | `mcp.spec.ts:189` "does not accept a session cookie in place of a token" | 401 | ✅ — the CSRF posture, tested |
| F5 scheme edge | — | — | ❌ NONE — no `Basic`, no bare `Bearer`, no case/whitespace variation |
| F6 single-workspace | `mcp.spec.ts:210` | No header needed | ✅ |
| F7 multi, unnamed | `mcp.spec.ts:221` | 400 | ✅ |
| F8 header | `mcp.spec.ts:229` | Selects from the bucket | ✅ |
| F9 query | `mcp.spec.ts:254` | The URL spelling works | ✅ |
| F10 header wins | — | — | ❌ NONE — the `??` at `mcp-auth.service.ts:85` is unasserted, and it is the precedence rule AGENTS.md states |
| F11 malformed id | — | — | ❌ NONE |
| F12 outside bucket | `mcp.spec.ts:276` | 403 | ⚠️ PARTIAL — no case pairing it with a **non-existent** workspace to prove the answers are identical |
| F13 token as actor | — | — | ❌ NONE — nothing asserts a write's revision author is `null`, which is ADR-0006's stated (and accepted) cost |
| F14 scope→permissions | `mcp.spec.ts:309`, `:325` | Read sees 7, full sees 12 | ✅ |
| F15 initialize | `mcp.spec.ts:286` | Identity + capabilities | ✅ |
| F16 list by scope | `mcp.spec.ts:309`, `:325` | as above | ✅ |
| F17 annotations | `mcp.spec.ts:351` | `readOnlyHint` / `destructiveHint` | ✅ |
| F18 no copilot tool listed | `mcp.spec.ts:379` "whatever the scope" | Both scopes | ✅ — the ADR-0007 cross-surface guard |
| F19 no copilot tool callable | `mcp.spec.ts:495`, `:510` | Named anyway → refused; `media_propose_file` specifically | ✅ — `:510`'s comment ("which a full token could otherwise afford") is the exact risk |
| F20 shared tools | `mcp.spec.ts:422`, `:440` | Listed to, and runnable by, a read token | ✅ |
| F21 surface-varied path | `mcp.spec.ts:458` | The `/api/v1` download path | ✅ |
| F22 dual shape | — | — | ❌ NONE — no case asserts `content[0].text` parses to `structuredContent` |
| F23 non-object boxing | — | — | ❌ NONE |
| F24 isError | `mcp.spec.ts:541`, `:553`, `:588`, `:858` | Refusal, per-tool refusal, unknown tool, 422 with issues | ✅ — `:553`'s loop over every write tool is the strongest case in the file |
| F25 resources list | `mcp.spec.ts:647` | Granted types are exposed | ⚠️ PARTIAL — **no negative**: nothing asserts an ungranted type is absent |
| F26 resources read | `mcp.spec.ts:665` | A type resource reads back | ⚠️ PARTIAL — no case for an ungranted URI answering like an unknown one |
| F27 teardown | — | — | ❌ NONE |
| F28 unexpected throw | — | — | ❌ NONE — the `-32603` path is never driven |
| F29 GET/DELETE 405 | — | — | ❌ NONE — AGENTS.md documents it as "correct"; nothing checks it |
| F30 OpenAPI exclusion | — | — | ❌ NONE |
| F31/F32 plugin validation | `src/lib/utils/mcp-plugin.spec.ts` | Blank name / version throw at construction | 🧪 UNIT |
| F33 registry when disabled | — | — | ⚠️ PARTIAL — implied by the whole copilot suite running with MCP off, never asserted directly |
| F34 argument validation | `mcp.spec.ts:736` | "rejects an unknown argument rather than ignoring it" | ⚠️ PARTIAL — **this is `content/server`'s DTO, not this layer's.** It reads as general coverage and is not |
| F35 JSON-RPC edges | — | — | ❌ NONE — no unknown method, no notification, no batch, no malformed id, no oversized params |
| — discovery | `mcp.spec.ts:602`, `:614`, `:633` | Only granted types listed; a type's fields + values schema; an ungranted type 404s like an unknown one | ✅ — `:633` is the data-layer non-enumeration guarantee |
| — reads | `mcp.spec.ts:682`, `:700`, `:711`, `:723`, `:748` | Published-only; no cross-workspace leak; by id; sparse fieldset; locator required | ✅ |
| — writes | `mcp.spec.ts:761`, `:838`, `:858`, `:877` | Full round trip; explicit null clears / omitted keeps; per-field issues; cannot write outside the bucket | ✅ — the round-trip case is the single most valuable test here |
| — schema shape | `mcp.spec.ts:523` | Every tool has an object input schema | ⚠️ PARTIAL — shape only; never enforced at call time (F34) |

**Coverage tally: 35 features · 16 ✅ · 6 ⚠️ · 13 ❌**

**A11y coverage, marked separately:** `❌ NONE`. There is no a11y suite for this
unit and none is warranted for the protocol itself. The one a11y-relevant
finding here (♿ A11Y-mcp-server-04, §504 authoring) is uncovered by any suite in
the repo. `apps/admin-e2e/src/copilot/a11y.spec.ts` does not touch this
endpoint.

---

## 6. 🐞 Potential Bugs

### 🐞 BUG-mcp-server-01 — Tool arguments are never validated against `inputSchema` on this surface, so the four shared tools' declared bounds are decorative · Severity: Medium · 🔒 SECURITY

**Location:** `packages/mcp/server/src/lib/protocol/build-mcp-server.ts:59-67`
(and the missing check in `packages/tools/server/src/lib/tool-registry.ts:108-137`)
**Category:** correctness / input-validation

**What the code does:**

```typescript
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
        const result = await registry.call(name, args ?? {}, context, 'mcp');
```

`tool.inputSchema` is advertised to the client at `:50` and never used again.
The low-level SDK `Server` is used deliberately (`:29-34`) *because* the schemas
are generated JSON Schema rather than Zod — so the SDK's Zod-based validation is
not in play either.

**Why it is wrong:** `packages/mcp/server/AGENTS.md` § "Rules for a new tool"
instructs "**Validate through the HTTP DTO.** `content/server`'s
`validateToolInput` runs the real `class-validator` DTO…". That is advice, not a
mechanism — a tool that skips it is unvalidated, and three of the four **shared**
tools do skip it. `media_assets_search` declares
`additionalProperties: false`, `kind` as an `enum`, `pageSize` as
`integer, minimum 1, maximum MAX_TOOL_PAGE_SIZE`
(`packages/media/server/src/lib/copilot/media-tool.provider.ts:98-141`) and then
comments at `:155-157` "Clamped in `run` as well as declared in the schema: the
validator is defence in depth, not the boundary" — on this surface there is no
validator, so the handler's own clamp *is* the boundary. Meanwhile the copilot
surface **does** validate (`packages/copilot/server/src/lib/chat/application/run-engine.service.ts:700-703`,
asserted at `copilot-chat.spec.ts:445`). One registry, two behaviours — exactly
what ADR-0007 §1 exists to prevent.

**Repro:**
1. `MCP_ENABLED=true npm run dev`; mint a `read`-scope token `T` over workspace `W`.
2. ```
   curl -s -X POST localhost:3000/api/v1/mcp -H "Authorization: Bearer $T" \
     -H "X-Workspace-Id: $W" -H 'content-type: application/json' \
     -H 'accept: application/json, text/event-stream' \
     -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"media_assets_search","arguments":{"nope":true,"pageSize":"lots","kind":"not-a-kind"}}}'
   ```
→ **Observed:** a 200 `result` with assets. `nope` ignored despite
`additionalProperties: false`; `kind` reaches the query un-enumerated;
`pageSize` goes through `Math.min(Math.max("lots" ?? 10, 1), MAX)`.
/ **Expected:** `isError: true`, `code: 'validation_failed'`, naming all three —
which is precisely what the same tool produces on the copilot surface.
3. Contrast with `content_list` + `{"nope":1}`, which **is** rejected
(`mcp.spec.ts:736`) — because content validates itself.

**Blast radius:** any external MCP client. Not a privilege escalation —
`requires` and `ctx.workspaceId` still hold — but it means the schema an MCP
client is shown is not the schema enforced, and a model that trusts the
advertised contract gets silently different behaviour. The real risk is the next
shared tool, whose author will reasonably read the schema as enforced.

**Suggested fix:** validate in `ToolRegistry.call` so both surfaces inherit it
(see `docs/testing/tools-server.md` 🐞 BUG-tools-server-01), or, if that is
rejected, call `validateToolInput` here in `build-mcp-server.ts` before
`registry.call` and map the failure through `toToolError`.

---

### 🐞 BUG-mcp-server-02 — `resources/list` and `resources/read` are served with no permission check and no surface narrowing · Severity: Medium · 🔒 SECURITY

**Location:** `packages/mcp/server/src/lib/protocol/build-mcp-server.ts:91-101`
**Category:** permission-bypass (structural)

**What the code does:**

```typescript
server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: [...(await registry.resources(context))]
}));
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const contents = await registry.readResource(request.params.uri, context);
    return { contents: [contents] };
});
```

`registry.resources` and `registry.readResource`
(`packages/tools/server/src/lib/tool-registry.ts:140-166`) call `permits()`
never, and `ResourceDefinition` (`tool.ts:198-207`) has no `requires` field to
check. Note the asymmetry within this very file: `tools/list` at `:46` calls
`visibleTo(context, 'mcp')`, and `tools/call` at `:62-67` passes `'mcp'` — the
resource handlers pass neither a permission gate nor a surface.

**Why it is wrong:** ADR-0006 §5 is explicit that "the per-route
`@RequirePermissions(...)` becomes a declared `requires` on each tool, enforced
centrally by `ToolRegistry.call` **before dispatch** … the check in `call` is
the security boundary and must stay that way". Resources are a second read path
over the same endpoint that is outside that boundary. It is safe **today** only
because `content/server`'s provider scopes to workspace grants itself — the
exact "a handler must not check its own gate, so a new tool cannot forget to"
property (`tool.ts:139-145`) that resources do not get. A provider adding, say,
`ortha://workspace-settings` would be exposed to every scope with nothing in
this package objecting, and no `surfaces` equivalent to hold it back from MCP.

**Repro:**
1. Read `packages/tools/server/src/lib/tool.ts:198-207` — no `requires`.
2. Read `packages/tools/server/src/lib/tool-registry.ts:140-166` — no `permits`.
3. Read `build-mcp-server.ts:91-101` — no scope, no surface.
4. `resources/list` with a `read`-scope token → the granted content types are
   listed. Correct, but by the provider's grace.
→ **Observed:** no gate exists at this layer. / **Expected:** the same
`requires`-before-dispatch discipline tools get.

**Blast radius:** none live (one provider, correctly scoped). The guard rail is
missing, and `mcp.spec.ts:647`/`:665` assert only the happy path — there is no
"an ungranted type is absent from `resources/list`" case, so a regression in the
provider's own scoping would also go uncaught. That negative case is the single
highest-value test this file is missing.

**Suggested fix:** add `requires?` and `surfaces?` to `ResourceDefinition` and
apply them in `ToolRegistry.resources`/`readResource`; add the negative e2e case
regardless of whether the contract changes.

---

### 🐞 BUG-mcp-server-03 — A throw after the transport has sent headers leaves the response open and the client hanging · Severity: Low

**Location:** `packages/mcp/server/src/lib/http/mcp.controller.ts:109-134`
**Category:** correctness / availability

**What the code does:**

```typescript
} catch (error) {
    this.logger.error(`MCP request failed for token ${context.actor.id}`, …);
    if (!response.headersSent) {
        response.writeHead(500, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32603, … }, id: null }));
    }
}
```

When `headersSent` is true the branch is skipped entirely — nothing is written
and, crucially, `response.end()` is never called on any path.

**Why it is wrong:** `transport.handleRequest` can throw after it has begun
writing (a serialisation failure on a large `structuredContent`, a socket error
mid-write, an SDK bug). The `response.on('close')` listener at `:104-107` closes
the transport and the protocol server but does not end the response — `close`
fires *because* the socket ended, not to end it. So the client sits on a
half-written body until its own timeout or a proxy's. The sibling code in this
repo that gets this right is the copilot's SSE controller, whose `finally` calls
`stream.close()` unconditionally
(`packages/copilot/server/src/lib/chat/http/controllers/create-run.controller.ts:171-173`).

**Repro (fault injection):**
1. Wrap `transport.handleRequest` so it writes a partial body and then throws:
   `await new Promise(r => { response.write('{'); r(); }); throw new Error('boom');`
2. `RPC tools/list`.
→ **Observed:** `curl` hangs; the log carries the stack. / **Expected:** the
connection is closed promptly, ideally after `response.end()`.

**Blast radius:** a hung client connection per occurrence, and a socket held for
the duration. Low because the throw is itself rare and the transport normally
owns the whole response; recorded because the guard reads as complete and is
not.

**Suggested fix:** add an `else { response.end(); }` to the catch, or a
`finally` that ends an unfinished response.

---

### 🐞 BUG-mcp-server-04 — `?workspaceId=` repeated is silently discarded instead of rejected · Severity: Low

**Location:** `packages/mcp/server/src/lib/http/mcp.controller.ts:139-142`
**Category:** correctness

**What the code does:**

```typescript
function workspaceQuery(request: McpHttpRequest): string | undefined {
    const raw = request.query?.['workspaceId'];
    return typeof raw === 'string' ? raw : undefined;
}
```

**Why it is wrong:** Express parses `?workspaceId=a&workspaceId=b` (and
`?workspaceId[]=a`) into an **array**, so `typeof raw === 'string'` is false and
the parameter is dropped entirely. For a **single-workspace** token the request
then succeeds against that one workspace, having ignored the caller's explicit —
and contradictory — selection. `mcp-auth.service.ts:140-142` shows the intended
handling for the *header* version of exactly this ambiguity: `headerValue` takes
the first value rather than discarding. The two spellings of one rule
(AGENTS.md: "both go through the identical bucket check … the query string is a
spelling of the same rule") behave differently for a repeated value.

**Repro:**
1. `curl -s -X POST "localhost:3000/api/v1/mcp?workspaceId=$W1&workspaceId=$W2" -H "Authorization: Bearer $TR" …` with `TR` scoped to `W1` only.
→ **Observed:** 200, answering for `W1`. / **Expected:** either 400 (ambiguous)
or first-wins, matching the header path.
2. With a multi-workspace token: 400 "This token covers 2 workspaces…", which
   reads as if no id was supplied — misleading, since one was.

**Blast radius:** confusing rather than dangerous; the bucket check still runs
on whatever is resolved, so no cross-tenant access is possible. A client
generating URLs programmatically could silently target the wrong workspace when
the token happens to cover exactly one.

**Suggested fix:** mirror `headerValue` — take `raw[0]` when it is an array —
or 400 on a repeated parameter.

---

### 🐞 BUG-mcp-server-05 — `Bearer` parsing silently normalises internal whitespace instead of rejecting it · Severity: Low

**Location:** `packages/mcp/server/src/lib/http/mcp-auth.service.ts:148-158`

**Previously filed as `Unverified`; now confirmed and rewritten.** The open
question was what character set `ApiTokenService` mints. It mints
`randomBytes(TOKEN_ENTROPY_BYTES).toString('base64url')`
(`packages/identity/server/src/lib/api-tokens/application/api-token.service.ts:90`),
which by definition contains no whitespace — so the rejoin is **unreachable for
any token this system issues**, and the finding is a latent-robustness note, not
a live defect. Severity stays Low; the "blast radius: none today" line below is
now a verified statement rather than a guess.

**What the code does:**

```typescript
const [scheme, ...rest] = header.trim().split(/\s+/);
if (scheme.toLowerCase() !== BEARER) return undefined;
const value = rest.join(' ');
```

Splitting on `\s+` and rejoining with a single space means
`Authorization: Bearer abc   def` yields the secret `"abc def"` — three spaces
collapsed to one. If minted secrets are opaque base64/hex this is unreachable;
if any future format allows whitespace, a token would verify under a *different*
string than the one sent.

**Why it is wrong:** RFC 6750 defines the credential as a single
`b64token` with no internal whitespace, so the rejoin serves nothing and
introduces a normalisation the verifier does not know about. `rest.join(' ')`
also means a *truncated* header (`Bearer abc def`) silently produces a lookup
key rather than a 400.

**Repro:** send `Authorization: Bearer <first-half> <second-half>` splitting a
valid base64url token across a space.
→ Observed: `bearerFrom` returns the token with the space preserved, so the
lookup key differs from the stored secret and the request 401s — the right
outcome, reached by accident rather than by a length check.
→ Expected: a 401 because the header is malformed, decided before the lookup.

**Blast radius:** none today — verified against the minting code, not assumed.
Recorded because it is the kind of input normalisation that becomes a bug when the
token format changes.

**Suggested fix:** `const value = rest[0]; if (rest.length !== 1) return undefined;`

---

**Defect tally:** `5 🐞 · 0 Critical · 0 High · 2 Medium · 3 Low · 2 🔒`
**Accessibility tally:** `5 ♿ · 2 Supports · 1 Partially Supports · 1 Does Not Support · 1 Not Applicable`

### Checked and cleared

- **Does `MCP_ENABLED` genuinely gate the route, or only the UI?** It gates the
  **controller registration** (`mcp.module.ts:31`), so the path 404s from Nest
  before auth. Tested at `mcp.spec.ts:899`. There is no admin UI for MCP at all,
  so there is no UI-only gate to be fooled by.
- **Can a token reach a workspace outside its bucket via MCP where REST blocks
  it?** No. `resolveWorkspace` (`mcp-auth.service.ts:114-137`) applies the same
  three rules as `ApiTokenWorkspaceGuard`, and both header and query go through
  it identically. `mcp.spec.ts:276` and `:877` cover read and write.
- **Is a session cookie accepted anywhere on this route?** No. `@Public()`
  (`mcp.controller.ts:52`) turns off the session guard and `McpAuthService`
  reads only `authorization`. Tested at `mcp.spec.ts:189`.
- **Is authentication before or after the protocol state machine?**
  Before — `mcp.controller.ts:84-87` runs `authenticate` and lets the exception
  filter answer with a plain 401 rather than a JSON-RPC error, with a comment
  saying exactly why.
- **Do errors follow the JSON-RPC error shape, or leak stack traces?** Tool
  failures become `isError` results carrying `toToolError`'s opaque 500 for a
  non-`HttpException` (`build-mcp-server.ts:76-88`, `tool-error.ts:67-77`);
  controller-level failures become `-32603` with a fixed message
  (`mcp.controller.ts:120-132`). The stack goes only to the logger. No path
  writes a stack to the wire.
- **Does the tool list leak copilot-only tools?** No — `visibleTo(context,'mcp')`
  and `registry.call(…, 'mcp')` both narrow, and `mcp.spec.ts:379`, `:495`,
  `:510` assert list **and** call.
- **Does the endpoint keep a session or need sticky routing?**
  `sessionIdGenerator: undefined` (`mcp.controller.ts:91`) — genuinely
  stateless, unlike the copilot's in-memory permission broker.
- **Does the per-request server leak?** `response.on('close')` closes both
  (`:104-107`). Untested, but present and correct.

---

## 7. Recommended E2E Tests

Harness: **server-e2e** = `apps/server-e2e` testcontainer + supertest, driving
raw JSON-RPC as `mcp.spec.ts` already does. **unit** = `npx nx test @orthacms/mcp-server`.

| Priority | Harness | Proposed spec | Asserts | Closes |
| --- | --- | --- | --- | --- |
| 1 | server-e2e | `mcp.spec.ts` — new `describe('argument validation')` | `tools/call media_assets_search` with an extra key, a non-enum `kind` and a string `pageSize` returns `isError` / `validation_failed` and no asset list; the same for `media_folders_list` and `i18n_locales_list` | 🐞 BUG-mcp-server-01, F34 ⚠️ |
| 2 | server-e2e | `mcp.spec.ts` — extend `describe('discovery')` | `resources/list` for a workspace granted only `test_article` contains **no** URI for an ungranted type, and `resources/read` on that URI answers exactly as an unknown URI does | 🐞 BUG-mcp-server-02, F25/F26 ⚠️ |
| 3 | server-e2e | `mcp.spec.ts` — new `describe('JSON-RPC protocol')` | Unknown method → `-32601`; a notification (no `id`) → 202 with no body; a two-element batch → two results with ids echoed; `{"jsonrpc":"1.0"}` → an error not a 500; missing `method` → `-32600`; a 1 MB deep-nested `params` → an error, not a crash | F35 ❌, EC-40..EC-44 |
| 4 | server-e2e | `mcp.spec.ts` — extend `describe('workspace resolution')` | Header **and** query both present with different values → the header wins; a malformed `X-Workspace-Id` → 400; a repeated `?workspaceId=` → a defined answer | F10 ❌, F11 ❌, 🐞 BUG-mcp-server-04 |
| 5 | server-e2e | `mcp.spec.ts` — extend `describe('authentication')` | `Basic` scheme → 401; bare `Bearer` → 401; lower-case `bearer` + extra whitespace → 200; a valid cookie **plus** a valid bearer → authorized as the token | F5 ⚠️, EC in §4 |
| 6 | server-e2e | `mcp.spec.ts` — new `describe('verbs')` | `GET` and `DELETE` with a valid token → 405 from the transport; without a token → 401, proving auth precedes the verb answer | F29 ❌ |
| 7 | server-e2e | `mcp.spec.ts` — extend `describe('write round-trip')` | After an MCP `content_create`, the entry's revision records a **null** author — pinning ADR-0006's accepted attribution gap so a future change to it is deliberate | F13 ❌ |
| 8 | server-e2e | `mcp.spec.ts` — new case in `describe('tools/list')` | `result.content[0].text` JSON-parses to something deep-equal to `result.structuredContent`, on both a list result and a single-entry result | F22 ❌ |
| 9 | server-e2e | `mcp.spec.ts` — extend `describe('workspace resolution')` | A workspace that does not exist at all and one outside the bucket produce byte-identical 403 bodies | F12 ⚠️, EC-19 |
| 10 | server-e2e | new `apps/server-e2e/src/server/mcp/mcp-disabled.spec.ts` | With `enabled: false`, `POST` 404s **and** a copilot run in the same app still calls `media_assets_search` — the registry-stays-bound invariant, asserted rather than implied | F33 ⚠️ |
| 11 | server-e2e | `mcp.spec.ts` — new `describe('shared tools, tenant isolation')` | `media_assets_search` and `media_asset_read` over MCP cannot see another workspace's assets, mirroring `copilot-read-catalogue.spec.ts:446` / `:693` on this surface | EC-25 ⚠️ |
| 12 | unit | `mcp-auth.service.spec.ts` — new cases | `Bearer` with internal whitespace; an array-valued `x-workspace-id`; a `?workspaceId=` array | 🐞 BUG-mcp-server-04, 🐞 BUG-mcp-server-05 |
| 13 | server-e2e | `mcp.spec.ts` — new case | A tool whose handler throws a **non-HttpException** returns the opaque 500 body and the response contains no stack, no table name and no connection string | F28 ❌, EC-36 |
| 14 | server-e2e | `mcp.spec.ts` — new case | `content_create` called twice with identical arguments produces **two** entries — documenting that MCP has no repeat guard, unlike the copilot | EC-37 |
| 15 | server-e2e | `mcp.spec.ts` — a §504 authoring case | `content_create` with a rich-text body containing an image and no alt text publishes without objection — pinning ♿ A11Y-mcp-server-04 so a future prompt/validation is a deliberate change | ♿ A11Y-mcp-server-04 |
