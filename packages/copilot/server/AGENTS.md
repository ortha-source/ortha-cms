# @ortha-cms/copilot-server

The copilot **plugin**. Phase 0 bound the model seam; **phase 1 added the chat
vertical slice** — the SSE run route, the bounded run engine, the capability
profile, and the transcript this plugin now owns and migrates
([`docs/design/copilot.md`](../../../docs/design/copilot.md) §9).

## What exists today

- `CopilotPlugin({ providers, resolve?, config })` — the standard `ServerPlugin`
  shape with `copilotConfig` attached and a `migrations` descriptor.
  `providers` is a **list** of `{ name, provider }`, in preference order.
- `CopilotModule.forRoot(...)` — a **global** dynamic module binding
  `COPILOT_CONFIG`, `MODEL_REGISTRY`, `MODEL_RESOLVER` and the chat services,
  and mounting four routes.
- `buildModelRegistry(registrations)` — the immutable name→provider lookup,
  plus `catalogue()`: every provider × model pair on offer, in registration
  order. That is exactly what `GET /api/copilot/models` serves.

### Routes

| Route                                | Guards                                                | Notes |
| ------------------------------------ | ----------------------------------------------------- | ----- |
| `POST /api/copilot/runs`             | `OriginGuard`, `PermissionsGuard`, `WorkspaceGuard`   | SSE. One turn. |
| `GET /api/copilot/models`            | `PermissionsGuard`                                    | The catalogue. Deployment-wide, so **no** `WorkspaceGuard`. |
| `GET /api/copilot/conversations`     | `PermissionsGuard`, `WorkspaceGuard`                  | This user's threads. |
| `GET /api/copilot/conversations/:id` | `PermissionsGuard`, `WorkspaceGuard`                  | Thread + transcript. |

All four require `copilot:use`.

## Three things that will bite you

These are spike findings from phase 1, each now covered by a test.

- **Client-disconnect detection hangs off `res`, never `req`.** Express has
  consumed the request body before a handler runs, and a fully-consumed
  `IncomingMessage` emits `'close'` immediately — while the client is still
  connected and waiting. Wiring an abort to `req.on('close')` cancels every run
  the instant it starts, and because `writeHead` hasn't flushed, it presents as
  a request that **hangs with no response** rather than as an error. See
  `SseStream.onClientDisconnect`.
- **The strict global `ValidationPipe` traverses nested DTOs only with
  `@ValidateNested()` + `@Type()`.** Without them, `context` is not treated as a
  DTO at all: the whitelist strips its properties and the handler silently gets
  `{}`. `forbidNonWhitelisted` 400s an unknown *top-level* key by name, which is
  loud; this failure is silent.
- **Nest ignores a TypeScript default on a constructor parameter.** It resolves
  every argument positionally, so `limits: RunLimits = DEFAULT_RUN_LIMITS` fails
  boot with an unresolvable dependency. Use an `@Optional() @Inject(TOKEN)`
  parameter and apply the default in the body — see `COPILOT_RUN_LIMITS`.
  Relatedly, a parameter typed `Foo | null` emits `Object` for
  `design:paramtypes`, so an `@Optional()` one silently injects `undefined`
  unless you name the token explicitly.

## The tool seam

`copilot/server` must not import `content-server` — that would put the copilot
at the bottom of the package graph. Instead:

- `ToolSpec`, `ToolContext` and `COPILOT_TOOL_PROVIDER` live in
  **`copilot-domain`**, so a binder depends only on the framework-free core.
- Binders **register at runtime**: inject `CopilotToolRegistry` from their own
  `OnApplicationBootstrap` and call `register(...)`. This is the precedent
  `OutboxDispatcher.register` set, and it exists because **Nest cannot merge a
  multi-provider token across independent dynamic modules** — every plugin here
  is one, so a second binder would silently replace the first rather than join
  it. A static single binding to `COPILOT_TOOL_PROVIDER` is also honoured.
- A provider that throws while describing its tools is **skipped, not fatal**:
  one plugin failing degrades that run's catalogue instead of failing the chat.

The content tools ship in `content/server` (`lib/copilot/`), as thin wrappers
over the same `EntriesService` / `EntryWriterService` the HTTP controllers call.

## The run engine

An **async generator**, not a service that writes to a response — the transport
stays in the controller, and the loop is testable by draining the generator.

- **Bounded three ways** (`RunLimits`): max steps, wall clock, total tokens.
  Exceeding any one ends the run with a reason the UI shows.
- **The user's message is persisted before the model is called**, so a dropped
  connection never loses what someone typed.
- **The capability profile is recomputed per run and re-checked per tool call**
  against freshly resolved grants (ADR-0005 §2, §3). Nothing is cached; a role
  revoked mid-turn takes effect on the next tool call.
- **`executeTool` never throws.** Unknown tool, revoked permission, malformed
  arguments, a tool that blew up — all come back as tool *errors* the model can
  recover from, and the run continues. An unknown tool and a withheld one get
  the **same** message, because "that exists but you may not use it" is itself
  information.
- **A repeated identical call is refused, not re-run.** A model — especially a
  smaller local one — will sometimes re-request a call it already made instead
  of using the result. Without a guard the engine obliges every time until it
  hits `maxSteps`: eight model calls, eight identical queries, no answer, and a
  stop reason that explains nothing. The guard compares `name` + arguments
  (key-sorted, so argument order doesn't defeat it) and feeds back a tool error
  *saying* the call was already made — telling the model is what breaks the
  loop; silently re-running or refusing without a reason both just repeat.
  Checked after authorization, so a repeat can never reveal more than a first
  call would.
- **`maxSteps` is configurable** via `config.limits.maxSteps` (`COPILOT_MAX_STEPS`).
  The default of 8 suits a frontier model; a smaller local one often needs more
  round trips for the same question. Raising it costs tokens rather than safety
  — every step is still authorized, audited, and bounded by the wall-clock and
  token ceilings.
- **Every attempted call is audited**, successful or not — a refused call is
  exactly what a reviewer is looking for. Output is stored as a **summary**, not
  whole: copying entry bodies into an append-only table would duplicate content
  with a different deletion story, and the transcript already holds what the
  model saw.
- **The model is resolved in the engine**, not left to the adapter, so
  `copilot_messages.model` names the model that actually answered.
- **`streamTurn` is a generator, and the `yield*` is load-bearing.** It once
  collected text deltas into an array and returned them for `loop` to flush
  after the provider's stream ended — which silently turns streaming off: the
  answer arrives in one burst when the model finishes, indistinguishable from a
  slow non-streaming API. A fast provider hides this completely, which is how it
  survived the first round of verification. To check it, point the server at a
  deliberately slow OpenAI-compatible endpoint and time the frames; anything
  else measures nothing.

## Schema

Three tables, migrated under `__drizzle_migrations_copilot`:

| Table                   | Holds                                                    |
| ----------------------- | -------------------------------------------------------- |
| `copilot_conversations` | Thread per user × workspace. FKs cascade from both.       |
| `copilot_messages`      | Append-only transcript, as the **port's** content blocks — so it survives a provider switch. `position` is explicit because two turns can land in the same millisecond. |
| `copilot_tool_calls`    | The security-review surface (ADR-0005). Redacted output.  |

`external-refs.ts` carries id-only stubs of `users` and `workspaces` so
drizzle-kit can emit the cross-context FKs without pulling another plugin's Nest
providers into its esbuild pass. Same pattern as `workspaces/server`.

**Every repository method takes the owning `userId` and `workspaceId` and filters
on both.** `WorkspaceGuard` proves the caller belongs to the workspace they
named; nothing upstream proves a *conversation id* belongs to them.

## The model seam

Structurally identical to media storage, by decision
([ADR-0004](../../../docs/adr/0004-model-agnostic-copilot-provider.md)):

| media                    | copilot                  |
| ------------------------ | ------------------------ |
| `StorageProvider`        | `ModelProvider`          |
| `buildRegistry`          | `buildModelRegistry`     |
| `STORAGE_REGISTRY`       | `MODEL_REGISTRY`         |
| `STORAGE_RESOLVER`       | `MODEL_RESOLVER`         |
| `config.defaultProvider` | `config.defaultProvider` |

**This package knows no adapter exists.** It does not import a vendor SDK, a
factory, _or_ an adapter config type — so a Bedrock adapter is a package plus
one entry in `plugins.ts`. Provider *connection* settings live with the host, in
`apps/server/ortha.config.ts`.

A run may name a `provider` and `model`; an explicitly requested provider wins
over the host's `resolve` handler, because the resolver expresses a default
routing policy rather than a veto over what the user picked from the catalogue
they were shown. Naming one is not an escalation: the registry is fixed at boot,
so the worst a caller can do is choose a backend the operator already configured.

### Why a list, not a map

`providers` is `readonly ProviderRegistration[]`, so registration order is
meaningful (the first entry reads as the house default, and `catalogue()`
renders in that order) and two providers of the same kind are just two entries:

```typescript
{ name: 'ollama-fast', provider: createOpenAiProvider({ models: ['llama3.1:8b'], … }) },
{ name: 'ollama-big',  provider: createOpenAiProvider({ models: ['llama3.1:70b'], … }) },
```

A list can express what a map cannot — a blank name, or the same name twice —
so `buildModelRegistry` rejects both explicitly.

`buildModelRegistry` snapshots the provider map into a **null-prototype**
object: a later mutation of the host's map can't reroute a run mid-flight, and a
lookup of `constructor`/`toString` misses instead of resolving something off
`Object.prototype` that is not a provider. (Media's `buildRegistry` still has
the second issue — worth fixing there too.)

## Eager config validation

`CopilotPlugin` validates at **construction**, like `I18nServerPlugin`'s locales
and `ContentPlugin`'s registry: at least one provider registered, every provider
declaring at least one model, a `defaultProvider` that names one of them, and a
positive `maxOutputTokens`. A host that mistypes a provider name fails before
boot rather than on the first chat message.

Being **disabled is not a wiring error**: `config.enabled: false` is the default
and constructs fine. That switch is the operator's kill switch (ADR-0005 §10),
read by the engine — so a disabled deployment answers with a readable error
frame rather than an opaque 403.

## Permissions

`copilot:use` and `copilot:configure` live in `identity/server`'s `PERMISSIONS`,
not here — the catalogue has exactly one source of truth. **No migration:**
`seedSystemRoles` is idempotent and runs each boot. Viewers hold `copilot:use`
(ADR-0005 §10, resolved); `copilot:configure` is admin-only and unused until
phase 4.

## Package

- Name: `@ortha-cms/copilot-server`
- Register **after** `WorkspacesPlugin` (runs are workspace-scoped) and
  `IdentityPlugin` (runs execute as the calling user)

## Commands

- `npx nx typecheck @ortha-cms/copilot-server`
- `npx nx lint @ortha-cms/copilot-server`
- `npx nx test @ortha-cms/copilot-server`
- `npx nx run @ortha-cms/copilot-server:db:generate --name=<name>`
