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

| Route                                  | Guards                                              | Notes                                                       |
| -------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------- |
| `POST /api/copilot/runs`               | `OriginGuard`, `PermissionsGuard`, `WorkspaceGuard` | SSE. One turn.                                              |
| `GET /api/copilot/models`              | `PermissionsGuard`                                  | The catalogue. Deployment-wide, so **no** `WorkspaceGuard`. |
| `GET /api/copilot/conversations`       | `PermissionsGuard`, `WorkspaceGuard`                | This user's threads. `?archived=true` for the filed ones.   |
| `GET /api/copilot/conversations/:id`   | `PermissionsGuard`, `WorkspaceGuard`                | Thread + transcript. Serves archived threads too.           |
| `PATCH /api/copilot/conversations/:id` | `OriginGuard`, `PermissionsGuard`, `WorkspaceGuard` | Rename and/or archive.                                      |
| `GET /api/copilot/proposals`           | `PermissionsGuard`, `WorkspaceGuard`                | The record of what changed.                                 |
| `GET /api/copilot/proposals/:id`       | `PermissionsGuard`, `WorkspaceGuard`                | One change.                                                 |

All require `copilot:use`.

**Archiving is the only removal, and there is deliberately no delete.** A
thread's `copilot_proposals` rows are the receipts for changes that were actually
made to the caller's content (ADR-0009), so dropping a conversation would take
the only record of those edits with it. `PATCH` sets `archived`, which moves the
thread between two **disjoint** lists — `GET /conversations` serves one or the
other, never both, or the flag would mean nothing to whoever reads the list. The
transcript is untouched and `GET /conversations/:id` still serves it, so a link
to an archived thread keeps working. If a hard delete is ever added it has to
answer for the proposals first.

Two things in the PATCH worth keeping:

- **`updatedAt` is not bumped.** It means "last used" and the list sorts by it;
  a rename would otherwise send a thread nobody has spoken to in a week to the
  top. Covered by a case in `copilot-conversations.spec.ts`.
- **The ownership predicate is in the `UPDATE`**, not a read beforehand, so
  there is no check-then-write window — and a miss is a flat 404 for "not yours"
  and "no such id" alike, matching the read routes.

The proposal routes are **reads only** — the
accept/reject pair and the `GET/PUT /api/copilot/policy` pair were deleted by
[ADR-0009](../../../docs/adr/0009-copilot-applies-directly.md), along with
`copilot:configure` itself. Whether a caller may make a change is decided once,
by the capability profile, before the tool is ever offered.

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
  `{}`. `forbidNonWhitelisted` 400s an unknown _top-level_ key by name, which is
  loud; this failure is silent.
- **Nest ignores a TypeScript default on a constructor parameter.** It resolves
  every argument positionally, so `limits: RunLimits = DEFAULT_RUN_LIMITS` fails
  boot with an unresolvable dependency. Use an `@Optional() @Inject(TOKEN)`
  parameter and apply the default in the body — see `COPILOT_RUN_LIMITS`.
  Relatedly, a parameter typed `Foo | null` emits `Object` for
  `design:paramtypes`, so an `@Optional()` one silently injects `undefined`
  unless you name the token explicitly.

## The tool seam — shared with MCP

`copilot/server` must not import `content-server`, and it no longer owns a tool
registry either. Both facts are settled by
[ADR-0007](../../../docs/adr/0007-one-tool-registry-two-surfaces.md):

- **The catalogue is `@ortha-cms/tools-server`'s `ToolRegistry`** — the same
  instance the MCP endpoint serves. `CopilotToolRegistry`,
  `COPILOT_TOOL_PROVIDER`, `ToolSpec` and `copilotToolsRegistrar` are gone. A
  binder implements `ToolProvider`, injects `ToolRegistry` `@Optional()`, and
  registers itself from `onModuleInit`.
- **`ToolsModule` is imported by this module**, not provided by it, so a
  deployment running the copilot _without_ MCP still has a registry and one
  running both has exactly one.
- **A copilot tool declares `surfaces: ['copilot']`.** It is not decoration:
  these tools read the _admin_ services (a viewer must see drafts) and their
  write half produces proposals only the chat panel can accept, so an MCP client
  reaching one would see unpublished content or create a change it cannot apply.
  The cross-surface e2e cases in both suites are the guard.
- **`ToolRegistry.call` is the authorization boundary**, checking `requires`
  before dispatch. The engine's offer is a usability filter on top.
- What stays here is the copilot-specific narrowing: `CapabilityProfileService`
  builds a `ToolActor` (`kind: 'user'`) and hands `forSurface('copilot')` to the
  pure `resolveCapabilityProfile`, which returns the offer plus the `withheld`
  reasons. It used to add a second gate — a per-workspace opt-in an `apply` tool
  had to appear in — and ADR-0009 removed it: a write tool is offered on the
  strength of its declared permissions, exactly like a read one.

Every tool ships with the plugin that owns its data, as a thin wrapper over the
same service the HTTP controllers call:

| Plugin     | Tools                                                                                                               |
| ---------- | ------------------------------------------------------------------------------------------------------------------- |
| `content`  | `admin_content_types`, `admin_content_search`, `admin_content_get`, `admin_content_revisions`, `admin_content_diff` |
| `i18n`     | `i18n_locales_list`, `i18n_translations_get`                                                                        |
| `media`    | `media_assets_search`, `media_folders_list`, `media_asset_read`                                                     |
| `activity` | `activity_recent` — deployment-wide, `activity:read` (admin only)                                                   |
| `users`    | `workspace_members_list` — scoped to the run's workspace                                                            |

Plus the `propose` half — the write tools, all of which **write nothing**:

| Plugin    | Tool                       | Produces kind          |
| --------- | -------------------------- | ---------------------- |
| `content` | `content_propose_create`   | `content.entry.create` |
| `content` | `content_propose_update`   | `content.entry.update` |
| `i18n`    | `i18n_propose_translation` | `i18n.entry.translate` |
| `media`   | `media_propose_alt_text`   | `media.asset.setAlt`   |
| `media`   | `media_propose_file`       | `media.asset.create`   |

## Asking before a write runs

A `propose`/`apply` tool the thread has not already allowed **parks the run**:
the engine yields `tool-permission-request` and awaits `ToolPermissionBroker`,
which `POST /api/copilot/runs/:runId/permission` resolves. Reads never ask (see
`mayRun` for why: a chat that opens with four prompts trains people to click
through them).

- **Before, not after.** This is the gate ADR-0009 §1b is about, and the reason
  it is worth the machinery: an injected call shows the user its arguments and
  is stopped with nothing having happened. A refusal is fed back as an ordinary
  tool error, so the model reports it and the answer still lands.
- **"Allow for this chat" lives on `copilot_conversations.allowed_tools`** and
  dies with the thread. Read **per call**, never per run — two calls in one turn
  can both be answered while the run is parked, and the second must see the
  first's answer. The append is done in SQL for the same reason.
- **The broker is in-memory.** A run and its decision must reach the same
  instance; single-node is fine, horizontal scaling needs sticky routing by
  `runId`. Its three exits — answered, five-minute timeout, abort — all clean up,
  because a registry that only deletes on the happy path leaks a promise per
  abandoned run.
- **A refused or timed-out call is audited** like any other. "The user said no"
  is exactly what a reviewer reading `copilot_tool_calls` wants to find.

## Writes — proposal row, then apply

A `propose` tool's return value **is** the change (`ProposalDraft`), and the
engine — not the tool — persists it as a `copilot_proposals` row and then
applies it. That split predates
[ADR-0009](../../../docs/adr/0009-copilot-applies-directly.md) and matters more
since: with no human step, the row written _before_ the write is the only thing
carrying ADR-0005 §5's "undoable, never invisible". A binder that wrote directly
would be a change with no receipt. One that returns something else gets an
ordinary tool error (`isProposalDraft`), never a malformed row.

Applying is inverted the same way the tools are: `copilot/server` cannot know
how to write a content entry, so the plugin that owns the data binds a
`ProposalApplier` for its `kind` via `copilotAppliersRegistrar(...)`. **An
applier must call the ordinary use-case** — the same one an HTTP request would
reach, with the human as actor. That is what makes an applied change validated,
audited and revision-backed; an applier that reimplements the write is the
failure the port exists to prevent, and with nobody reviewing the result it is
also the failure nobody would catch.

Three rules in `DecideProposalService` worth knowing before touching it:

- **No permission check of its own, deliberately.** The profile offered the tool
  at the start of the run and `executeTool` re-authorized it against a freshly
  resolved session immediately before the proposal existed. There is no third
  check because there is no third actor — `accept`, `reject` and the
  "you may accept what you could have proposed" re-resolution are gone.
- **The status flips before the write.** `decide` updates with a
  `status = 'pending'` predicate, so the applier is unreachable twice for one
  row. Still load-bearing with no reviewers: a model that re-proposes an
  identical change, or a retried run, must not write twice.
- **A failed apply reopens the row** with its message, and the engine reads that
  back into the tool result and the `proposal` run event. Nobody will retry it,
  so `pending` now means _failed_ — the model is told to say the change did not
  happen, and the card says so too.

Rows carry `toolCallId`, so a change joins to its `copilot_tool_calls` row and
the UI attaches the card to the step that produced it.

The model is told what happened, not handed the patch back — it already knows
what it asked for, and echoing the change invites it to "confirm" by calling
again. `SYSTEM_PROMPT_VERSION` 4 rewrote the MAKING CHANGES section for the
inverted failure mode: the old risk was a model claiming success when nothing
was saved, the new one is a model hedging about a write that already landed, or
quietly repeating a failed one.

## The system prompt

`system-prompt.ts` assembles it, `SYSTEM_PROMPT_VERSION` is stamped on the run,
and `system-prompt.spec.ts` pins the structure. Three rules for editing it:

- **Every section is conditional on something, and that is the point.** A run's
  prompt says only what is true of _that_ run: MAKING CHANGES needs write tools,
  the locale line needs `i18n_locales_list` to be on offer, `ON THIS SURFACE`
  needs a surface with something distinctive to say. Telling a viewer how writes
  behave, or a no-i18n deployment to look up locale slugs, buys a tool call that
  can only fail. `toolNames` carries the offered tool _names_ rather than a
  count for exactly this reason.
- **Per-tool mechanics belong in the tool's `description`, not here.** The
  prompt costs tokens on every run; a description costs them on the runs that
  read it, and arrives in context. HOW ORTHA WORKS carries only what is true of
  every deployment and what no single tool can say — the workspace grant
  boundary, `draft`/`published` being the whole state set, **publish state being
  the `status` + `publishedAt` pair**, numbered versions, and each locale being
  its own entry. The publish-state line (v6) is the counterpart of the
  propose-rule bug below: `draft`/`published` is true of the _column_, and a
  model that reads it as the whole story answers "how many entries are edited
  but not published?" with a count of every draft — the never-published ones
  included. Editing a published entry returns it to `draft` but **keeps**
  `publishedAt`, so "modified" is the pair, and the filter that finds it is in
  `admin_content_search`'s description where it costs only the runs that search.
- **The propose-rule bug is the cautionary tale.** v3 and v4 both said "any tool
  whose name starts with `propose`". Every propose tool is named for its owning
  plugin first (`content_propose_update`), so the rule matched **nothing** — a
  prompt can be wrong in a way that typechecks, passes e2e and reads fine. v5
  names a tool instead, and adds "despite the name", because since ADR-0009 the
  word `propose` argues against the rule it appears in. Until phase 4's offline
  eval set exists, the spec's conditional-structure cases are the only thing
  standing between a prompt edit and production — and note they would _not_ have
  caught this one.

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
  arguments, a tool that blew up — all come back as tool _errors_ the model can
  recover from, and the run continues. An unknown tool and a withheld one get
  the **same** message, because "that exists but you may not use it" is itself
  information.
- **A repeated identical call is refused, not re-run.** A model — especially a
  smaller local one — will sometimes re-request a call it already made instead
  of using the result. Without a guard the engine obliges every time until it
  hits `maxSteps`: eight model calls, eight identical queries, no answer, and a
  stop reason that explains nothing. The guard compares `name` + arguments
  (key-sorted, so argument order doesn't defeat it) and feeds back a tool error
  _saying_ the call was already made — telling the model is what breaks the
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

Four tables, migrated under `__drizzle_migrations_copilot`:

| Table                   | Holds                                                                                                                                                                                                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `copilot_conversations` | Thread per user × workspace. FKs cascade from both.                                                                                                                                                                                                                      |
| `copilot_messages`      | Append-only transcript, as the **port's** content blocks — so it survives a provider switch. `position` is explicit because two turns can land in the same millisecond.                                                                                                  |
| `copilot_tool_calls`    | The security-review surface (ADR-0005). Redacted output.                                                                                                                                                                                                                 |
| `copilot_proposals`     | Every change the copilot made, written before the write. `target`/`patch` are opaque jsonb — their shape belongs to the applier that declared the `kind`, and teaching this table about content entries would make the copilot the thing that changes when content does. |

`external-refs.ts` carries id-only stubs of `users` and `workspaces` so
drizzle-kit can emit the cross-context FKs without pulling another plugin's Nest
providers into its esbuild pass. Same pattern as `workspaces/server`.

**Every repository method takes the owning `userId` and `workspaceId` and filters
on both.** `WorkspaceGuard` proves the caller belongs to the workspace they
named; nothing upstream proves a _conversation id_ belongs to them.

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
one entry in `plugins.ts`. Provider _connection_ settings live with the host, in
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

`copilot:use` lives in `identity/server`'s `PERMISSIONS`, not here — the
catalogue has exactly one source of truth. **No migration:** `seedSystemRoles` is
idempotent and runs each boot. Viewers hold it (ADR-0005 §10, resolved), and a
viewer's copilot is provably read-only because the profile offers them no write
tool — which is the whole authority model now that nothing pauses for review.

There is no `copilot:configure`. It gated the per-workspace policy and nothing
else, so ADR-0009 removed it with the policy. Re-add it if the runtime model
registry ADR-0004 §5 anticipates ever lands.

## Package

- Name: `@ortha-cms/copilot-server`
- Register **after** `WorkspacesPlugin` (runs are workspace-scoped) and
  `IdentityPlugin` (runs execute as the calling user)

## Commands

- `npx nx typecheck @ortha-cms/copilot-server`
- `npx nx lint @ortha-cms/copilot-server`
- `npx nx test @ortha-cms/copilot-server`
- `npx nx run @ortha-cms/copilot-server:db:generate --name=<name>`
