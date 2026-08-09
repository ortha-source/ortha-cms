# @ortha-cms/mcp-server

The **Model Context Protocol** front door onto the CMS, and the home of the
shared **agent tool registry**. An external agent — Claude Desktop, Cursor, an
SDK-built client — connects to `POST /api/v1/mcp` with an API token and gets the
content CRUD the public HTTP API serves.

Owns **no tables**, **no migrations**, and **no tools**. It owns the protocol,
the authentication, and the registry; capability plugins contribute the tools.
See [ADR-0006](../../../docs/adr/0006-cms-as-an-mcp-server.md) for why.

> Not to be confused with the copilot's planned MCP **client**
> ([`docs/design/copilot.md`](../../../docs/design/copilot.md) §4), which points
> the other way: that lets the copilot call an _operator's_ MCP servers. This
> package makes the CMS _be_ one.

## The shape

```
src/lib/
  types/
    tool.ts              # ToolDefinition / ToolContext / ToolActor — transport-neutral
    tool-provider.ts     # the ToolProvider port a capability plugin implements
    mcp-config.ts        # kill switch + the identity clients see
  application/
    tool-registry.ts     # the catalogue AND the authorization point
    tool-error.ts        # thrown HttpException → a model-readable failure
  http/
    mcp-auth.service.ts  # bearer → verified token → ToolContext (+ workspace)
    tool-context.ts      # createToolContext, shared with the copilot
    mcp.controller.ts    # POST /api/v1/mcp, stateless Streamable HTTP
  protocol/
    build-mcp-server.ts  # per-request SDK server: tools/list, tools/call, resources/*
```

## Two consumers, one registry

`ToolDefinition` and `ToolContext` mention no HTTP, no JSON-RPC, and no MCP.
That is deliberate and is the main structural idea here:

- **The MCP endpoint** builds a `ToolContext` from a bearer token and exposes
  the registry over JSON-RPC.
- **The copilot's tool loop** (once its run engine lands) injects the _same_
  `ToolRegistry`, builds a context for the **signed-in user** with
  `createToolContext`, and calls the same tools in-process.

A tool added for one is automatically available to the other. Nothing in this
package needs to change when the copilot arrives — it injects `ToolRegistry`
(exported, global) and supplies an actor with `kind: 'user'` whose
`grantedPermissions` come from identity's RBAC rather than a token scope.

## Contributing tools (the `ToolProvider` port)

Nest has no multi-provider token, so registration is a **call**, not a binding:

```typescript
@Injectable()
export class MediaToolProvider implements ToolProvider, OnModuleInit {
    constructor(@Optional() private readonly toolRegistry?: ToolRegistry) {}

    onModuleInit(): void {
        this.toolRegistry?.register(this);
    }

    tools(): readonly ToolDefinition[] {
        return [
            {
                name: 'media_upload',
                title: 'Upload an asset',
                description: 'Written for a MODEL — see below.',
                inputSchema: { type: 'object', properties: {} },
                requires: [PERMISSIONS.MEDIA_CREATE],
                readOnly: false,
                handler: async (input, context) => {
                    /* call this plugin's own services */
                }
            }
        ];
    }
}
```

`@Optional()` because MCP is a plugin: a deployment that omits it must still
boot, with contributors simply going unregistered.

Register the provider in your plugin's module `providers` array. Tool names must
be unique across every plugin — a duplicate throws from `ToolRegistry.all()`
rather than silently resolving by registration order.

### Rules for a new tool

- **`requires` is security-critical.** It is the analogue of
  `@RequirePermissions(...)`, enforced centrally by `ToolRegistry.call` **before**
  dispatch. A handler must not check its own gate, and getting this field wrong
  is a privilege bug no type checker catches — **add a registry test with it.**
- **Delegate; never restate a rule.** Call the services your plugin's HTTP
  controllers call. That is what keeps the two surfaces from drifting.
- **Write the description for a model.** It is the only documentation the caller
  gets, so workflow rules belong in it: that a create yields a draft, that
  publish is separate, that an update merges.
- **Validate through the HTTP DTO.** `content/server`'s `validateToolInput` runs
  the real `class-validator` DTO with the host's `ValidationPipe` options, so a
  bound (like the `pageSize` cap) is written once.
- **Mind the response size.** Every field is context the model pays for. Offer a
  sparse-fieldset argument and keep page sizes small.
- **Throw, don't return errors.** An `HttpException` becomes a model-readable
  `isError` result via `toToolError`, with a 422's per-field `issues` carried
  through verbatim — which is what lets a model fix its own next call.

## The endpoint

`POST /api/v1/mcp` — **stateless** Streamable HTTP with `enableJsonResponse`.
Every request authenticates from scratch, so there is no session store and no
sticky routing; the per-request protocol server is also what lets `tools/list`
reflect _this_ caller's scope. `GET` and `DELETE` get the transport's 405, which
is correct — both serve a persistent session, and there isn't one.

**Authentication** is the existing bearer API tokens, verified through identity's
`ApiTokenService.verify`, with permissions from `scopePermissions` — the same
three rules `/api/v1/*` applies, restated for a non-Nest call site because a
guard gates a route and this is one route carrying many operations:

| `/api/v1/*` guard          | Here                                            |
| -------------------------- | ----------------------------------------------- |
| `ApiTokenGuard`            | `McpAuthService.authenticate` (bearer half)     |
| `ApiTokenWorkspaceGuard`   | `McpAuthService.authenticate` (workspace half)  |
| `@RequirePermissions(...)` | `ToolDefinition.requires` + `ToolRegistry.call` |

A **session cookie is not accepted**, exactly as on `/api/v1`: a cookie rides
along ambiently and would make this CSRF-able, and this endpoint writes content.

**Workspace resolution** takes `X-Workspace-Id`, or `?workspaceId=` on the
endpoint URL — the second spelling exists because MCP client configs are URL-
shaped and several clients make custom headers awkward. The header wins when
both are present, and both go through the identical bucket check. A
single-workspace token needs neither.

**Excluded from the OpenAPI document** (`@ApiExcludeController`): JSON-RPC over
one route is not describable as REST operations, and a lone `POST /v1/mcp` entry
would tell a reader nothing.

## Configuration

```typescript
McpPlugin({ config: { enabled: true, name: 'ortha-cms', version: '1.0.0' } });
```

**Off by default** (`MCP_ENABLED=true` to turn it on). Enabling it lets any
holder of a `full`-scope token drive content CRUD from an external agent — a
decision an operator makes deliberately, not one they inherit from an upgrade.
The same reasoning as the copilot's kill switch.

The **registry still binds when disabled**, and only the controller is removed:
the copilot consumes the registry in-process and has nothing to do with whether
an external endpoint is exposed.

## Connecting a client

The endpoint speaks Streamable HTTP directly. For a client that only speaks
stdio, `mcp-remote` bridges it — one line of client config and nothing for us to
maintain:

```json
{
    "mcpServers": {
        "ortha-cms": {
            "command": "npx",
            "args": [
                "-y",
                "mcp-remote",
                "https://cms.example.com/api/v1/mcp?workspaceId=<uuid>",
                "--header",
                "Authorization: Bearer <token>"
            ]
        }
    }
}
```

Mint the token in the admin's **API Tokens** page: `read` scope for a
retrieval-only agent, `full` for one that authors. The scope is what decides
which tools the agent can even see.

## Commands

- `npx nx typecheck @ortha-cms/mcp-server` / `npx nx lint @ortha-cms/mcp-server`
- `npx nx test @ortha-cms/mcp-server` — unit tests (registry authorization,
  bearer + workspace rules, error mapping, plugin validation)
- `npx nx e2e server-e2e --testPathPatterns=mcp` — the wire-level suite (needs
  Docker), which drives raw JSON-RPC because that is the contract clients depend on
