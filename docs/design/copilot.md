# Copilot — design

The AI partner inside the admin: a chat that can find, export, create and edit
content, running on whatever model the operator points it at, able to do exactly
what the signed-in person is allowed to do.

This document is the working reference for building it. Two decisions are
settled in ADRs and are not re-argued here:

- [ADR-0004](../adr/0004-model-agnostic-copilot-provider.md) — how we reach a
  model (the provider port, adapters, capability degradation, runtime config).
- [ADR-0005](../adr/0005-copilot-authority-model.md) — what the copilot may do
  (capability profile, propose-then-apply, untrusted content).

**Status:** proposed, not started. Phase 0 is the first buildable slice (§9).

---

## 1. Why this fits the codebase

A copilot is only as good as the structured surface it can act on. Ortha already
has the pieces that make one tractable, which is why this is an additive plugin
rather than a re-platform:

- **A self-describing content model.** Content types are code-defined and
  validated at boot; `ContentTypeRegistry` already serialises fields, types,
  required flags, relation targets and the `i18n`/publishable envelope flags.
  Tool JSON Schemas are *generated* from it, so the model never guesses a field
  name and a schema change updates the tools for free.
- **An authority model to inherit.** RBAC, `WorkspaceGuard` and the activity
  recorder already gate every mutation (ADR-0005).
- **An adapter precedent.** `StorageProvider` + `buildRegistry` + `resolve(ctx)`
  in `media/server` is the exact shape the model provider needs (ADR-0004).
- **Reviewability and async.** `EntryValidationService` and revision history make
  a generated edit diffable and validated; the transactional outbox gives
  at-least-once event delivery for background work — with one caveat in §8.

> `ARCHITECTURE.md` §8 still claims there is no content model. That is stale —
> content types, entries, revisions, media and i18n all shipped. Worth fixing,
> since the copilot's system prompt is assembled from exactly these docs.

## 2. The chat

The primary surface is a persistent chat panel: a right-hand sheet in the
workspace shell, opened from the sidebar footer or `⌘J`, with threads scoped to
a user × workspace. Three lighter entry points feed the same engine and the same
transcript, so work started inline can be continued in conversation.

A turn shows:

- **Your message**, plus where you are — workspace, content type, entry,
  selected rows.
- **Its work, as it happens.** Each tool call renders as a collapsed step
  (`searched articles · 12 results`), expandable to the exact input and output.
  No invisible actions.
- **Its answer**, streamed as markdown.
- **Any change, as a card.** A proposed edit is a per-field diff with
  Accept/Reject; an export is a download with its row count and the filter that
  produced it.

**Entry points**

| Surface         | Where                                     | What it does                                                                                                                                   |
| --------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Chat panel      | Workspace shell sidebar footer, `⌘J`      | The full conversation. All enabled tools.                                                                                                       |
| ⌘K palette      | `COMMAND_SLOT`                            | Natural language → the *existing* list filters via `query-builder-admin`'s `FilterField`s. The model emits a filter object, not SQL; the user sees the chips it chose. |
| Entry editor    | `ENTRY_MENU_SLOT`, `ENTRY_SIDEBAR_WIDGET_SLOT` | Tighten copy, write the SEO description, suggest relations, translate. Field-level diffs accepted individually.                             |
| Records toolbar | `RECORDS_TOOLBAR_SLOT`                    | Export by description — the copilot builds the filter and column set, reports the row count, streams a file.                                     |

Background work (phase 5) produces proposals that land in your chat as pending
cards; it never edits live.

## 3. Packages

Six new packages, no host edits. Layered per
[ADR-0003](../adr/0003-tactical-ddd-inside-plugins.md): `domain / application /
infrastructure / http`, with `domain/` importing no framework — so the tool
contracts, capability profile and run state machine are testable without Nest,
React or a model.

| Package                              | Owns                                                                                                                                                        |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `copilot/domain`                     | Run state machine, message/tool-call value objects, `ToolSpec`, `ModelProvider`, capability profile, proposal types. No framework imports.                    |
| `copilot/server`                     | `CopilotPlugin()`, run engine + tool loop, tool registry, MCP client, SSE controller, provider registry, schema + migrations, the `COPILOT_TOOL_PROVIDER` port. |
| `copilot/admin`                      | Chat panel, streaming transport, proposal diff UI, model/connector settings, slot contributions.                                                              |
| `copilot/provider-anthropic`         | Adapter over `@anthropic-ai/sdk`.                                                                                                                            |
| `copilot/provider-openai-compatible` | Configurable base URL — Ollama, vLLM, LiteLLM, OpenAI, Azure, OpenRouter.                                                                                     |
| `copilot/provider-fake`              | Scripted provider for e2e and offline dev.                                                                                                                   |

**Tool bindings live with their owners.** Content tools ship in
`content/server`, media tools in `media/server`, and so on — each a small
addition to a package that already holds the service it wraps.

## 4. Extension: two ways to add a tool

### Inside the repo — the DI port

`copilot/server` must not import `content-server`, `media-server` or
`i18n-server`; that would put the copilot at the bottom of the package graph.
Instead it declares a port and each plugin binds its own tools, the same
inversion as `CONTENT_ENTRY_EXTENSION`:

```ts
/** One capability the copilot may invoke on the user's behalf. */
export interface ToolSpec<I = unknown, O = unknown> {
    name: string; // 'content.searchEntries'
    description: string; // shown to the model
    inputSchema: JsonSchema; // generated from the content registry
    permissions: PermissionKey[]; // ALL must be held by the caller
    effect: 'read' | 'propose' | 'apply';
    run(input: I, ctx: ToolContext): Promise<O>;
}

/** Bound by content-server, media-server, i18n-server, activity-server, … */
export const COPILOT_TOOL_PROVIDER = Symbol('COPILOT_TOOL_PROVIDER');
```

`ToolContext` carries the authenticated user, the active workspace, the unit of
work and the run id — so a tool cannot execute outside a caller's scope even by
mistake. Any future plugin gets copilot support by binding this port; the
copilot never learns a new import.

### Outside the repo — MCP connectors

For third-party systems (a DAM, analytics, an issue tracker, a translation
memory) `copilot/server` runs an **MCP client**. An admin registers a connector;
its tools are discovered at connect time and merged into the catalogue. Rules
are in ADR-0005 §8: namespaced, permission-mapped by the installing admin,
treated as untrusted text, and failing in isolation — a connector timeout
degrades that run's catalogue, it never fails the chat.

## 5. Request flow

A bounded loop: call the model, execute the tools it asks for, feed results
back, stop on a final answer or a ceiling. Steps 5–8 repeat.

1. **`POST /api/copilot/runs`** — conversation id, message, surface context.
   `AuthGuard` + `OriginGuard` + `@RequirePermissions('copilot:use')`.
2. **Resolve the capability profile** — permissions × membership × workspace
   policy → this run's tool set. Everything downstream reads from it.
3. **Persist the turn, open the SSE stream.** The user message is written first,
   so a dropped connection never loses it.
4. **Assemble context** — system prompt + content-type *summaries* for this
   workspace + surface context + trimmed history, fitted to the provider's
   context window. Full field schema is fetched on demand via
   `content.listTypes`, not inlined. Content bodies arrive only through tool
   results, fenced as untrusted data.
5. **Model call**, streamed through the provider chosen by `resolve(ctx)`. Text
   deltas forward immediately; tool-use blocks are collected. Without native
   tool support, the constrained JSON protocol runs instead (ADR-0004 §4).
6. **Authorize each tool call** — in this run's profile, permissions re-verified
   against a live session, input valid against the generated schema. Any failure
   returns a tool error to the model: the run continues, the violation is logged.
7. **Execute** against the same use-cases the HTTP controllers call, inside a
   `UnitOfWork`. Writes produce a proposal unless workspace policy allows direct
   apply. Every call is audited in the same transaction.
8. **Feed results back** — bounded by max steps, wall clock and a per-run token
   ceiling; exceeding one ends the run with a reason the UI shows.
9. **Finalize** — persist the assistant message, tool calls, tokens and cost;
   emit `copilot.run.completed`; the client invalidates affected query keys.

## 6. Tool catalogue (v1)

`read` runs freely; `propose` produces a reviewable change; `apply` writes
directly and is off unless workspace policy enables it (ADR-0005 §6).

| Tool                      | Bound by  | Requires            | Effect  |
| ------------------------- | --------- | ------------------- | ------- |
| `content.listTypes`       | content   | `content:read`      | read    |
| `content.searchEntries`   | content   | `content:read`      | read    |
| `content.getEntry`        | content   | `content:read`      | read    |
| `content.diffRevisions`   | content   | `content:read`      | read    |
| `content.exportEntries`   | content   | `content:read`      | read    |
| `content.proposeEntry`    | content   | `content:create`    | propose |
| `content.proposeEdit`     | content   | `content:update`    | propose |
| `i18n.proposeTranslation` | i18n      | `content:update`    | propose |
| `media.searchAssets`      | media     | `media:read`        | read    |
| `media.proposeAltText`    | media     | `media:update`      | propose |
| `activity.recent`         | activity  | `activity:read`     | read    |
| `workspace.members`       | users     | `users:read`        | read    |
| `mcp.<connector>.*`       | connector | as mapped by admin  | read by default |

Because the profile is derived from `SYSTEM_ROLES`, the practical effect is:

| The copilot can…               | Viewer | Contributor | Admin |
| ------------------------------ | :----: | :---------: | :---: |
| Answer questions about content |   ✔    |      ✔      |   ✔   |
| Search & filter entries        |   ✔    |      ✔      |   ✔   |
| Export what you can read       |   ✔    |      ✔      |   ✔   |
| Draft & edit entries           |   —    |      ✔      |   ✔   |
| Translate into other locales   |   —    |      ✔      |   ✔   |
| Write alt text on assets       |   —    |      ✔      |   ✔   |
| Read the activity log          |   —    |      —      |   ✔   |
| Configure models & connectors  |   —    |      —      |   ✔   |

**Export deserves care.** `content.exportEntries` takes a filter, column set and
format (JSON/CSV/Markdown) and streams through a download route
(`media/server`'s `download-asset.controller` is the streaming precedent). It is
a read tool, but the one that moves the most data at once: show the row count
before producing the file, cap the export, resolve relation and media fields to
human-readable labels rather than raw ids, and write an activity row naming the
filter.

**New permissions.** `copilot:use` (admin + contributor, and viewer — see §10)
and `copilot:configure` (admin only).

## 7. Data model

`copilot/server` ships its own `drizzle.config.ts` and committed migrations
(`nx run copilot-server:db:generate --name=…`; applied by the host's
`db:migrate`).

| Table                   | Holds                                                                       | Notes                                                                |
| ----------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `copilot_conversations` | Thread per user × workspace, title, surface, archived flag                   | FKs to identity `users` and workspaces                                |
| `copilot_messages`      | Ordered turns: role, content blocks, model id, finish reason                 | Append-only — the transcript for replay and audit                     |
| `copilot_tool_calls`    | Tool name, input, redacted output, duration, error                           | What actually touched data; the security-review surface               |
| `copilot_proposals`     | Target (type, entry, locale), patch, status, decided by/at                   | The accept boundary; applying runs the ordinary update use-case       |
| `copilot_model_configs` | Adapter kind, base URL, model id, encrypted credential, probed capabilities  | Runtime provider registration (ADR-0004 §5); secrets never leave the server |
| `copilot_connectors`    | MCP endpoint, auth, enabled workspaces, per-tool permission mapping          | Admin-managed; disabled by default                                    |
| `copilot_usage`         | Per run: input/output tokens, cost, provider, model                          | Backs quotas and the cost panel                                       |

Phase 5 adds `copilot_embeddings` (entry, locale, chunk, vector), which needs
the `pgvector` extension — a deployment change, not just a migration, and the
reason semantic retrieval is last.

## 8. What we still have to build

The plugin seams are ready; the streaming and model plumbing is not.

| Capability                  | Today       | What's needed                                                                                                                                                                                                                       |
| --------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Model port & adapters       | none        | No LLM dependency in `package.json`. The port copies `StorageProvider` + `buildRegistry`, so the shape is settled; the adapters and streaming normalisation are the work.                                                             |
| Streaming transport         | none        | No SSE or websockets anywhere. Nest: an event-stream controller. Admin: the shared `apiClient` is **axios**, which cannot stream in the browser — the copilot needs a `fetch` transport replicating its credentials and `X-Workspace-Id` behaviour. |
| Runtime provider config      | none        | All config is env-only via `ortha.config.ts`. First DB-persisted settings and first encrypted-secret-at-rest in the codebase; needs a key in config and a rotation story.                                                             |
| MCP client                  | none        | Connection lifecycle, tool discovery, namespacing, permission mapping, timeouts, untrusted-text handling.                                                                                                                            |
| Tool-schema generation      | partial     | `SerializedContentType` has everything needed; a `registry → JsonSchema` mapper (and round-trip tests) does not exist.                                                                                                                |
| Export                      | partial     | No content export exists. Streaming CSV/JSON writer, label resolution, row caps, audited download route.                                                                                                                              |
| Long-running work           | partial     | **`OutboxDispatcher.drain()` runs every subscriber inside one transaction.** A multi-second model call in a subscriber would hold that transaction and its row locks open for the whole batch. Background AI must enqueue a job row and let a separate worker do the model call — or the dispatcher must learn to hand off outside the tx. |
| Cost & quota                | none        | Token accounting, per-workspace caps, per-user rate limiting. `@nestjs/throttler` is already in the lockfile via identity.                                                                                                            |
| Chat UI primitives          | partial     | `sheet`, `command`, `textarea`, `sonner`, `tabs`, `collapsible` exist. Missing: markdown rendering, streaming text, message bubbles, tool-step disclosure, field-level proposal diff (`revisionDiff` is a starting point).             |
| Deterministic tests         | none        | `server-e2e`'s testcontainer harness can cover the loop only with the fake provider — including negative permission cases. `admin-e2e` mocks `/api` with `page.route` and will need to fulfil an event-stream body.                    |
| Prompt versioning & evals   | none        | Prompts are product surface: version them in the repo, add an offline eval set so a prompt edit is reviewable like code and a swapped-in model can be measured.                                                                       |
| Localized output            | partial     | UI strings follow the co-located `react-intl` convention, but the *model's* reply language needs an explicit rule (follow the admin UI locale; translations target the requested content locale).                                      |

## 9. Roadmap

Six phases; each after phase 1 is independently shippable.

**Phase 0 — Foundations.** `ModelProvider` port + registry, the three adapters,
`plugins.copilot` config, `copilot:use` / `copilot:configure`, empty plugin
registered in both hosts. *Ships nothing visible; unblocks everything.*

**Phase 1 — Chat (the vertical slice).** SSE endpoint, run engine, capability
profile, conversation persistence, the read-only content tools, the chat panel.
Server-e2e over the fake provider, including the viewer-can't-write case.
*Ships: conversational search over your own content.*

**Phase 2 — Export.** Streaming CSV/JSON/Markdown with label resolution, row
caps and audit; `content.exportEntries`; the records-toolbar entry point.

**Phase 3 — Create & edit.** `copilot_proposals`, field-level diff UI,
propose-entry / propose-edit, apply-as-revision, per-workspace auto-apply
policy, entry-editor entry points.

**Phase 4 — Configure & connect.** Runtime model settings with encrypted secrets
and connection testing; MCP connector registration with permission mapping; ⌘K
natural language → filters; translation tool.

**Phase 5 — Background & retrieval.** Job runner outside the outbox transaction,
background alt text and translation drafts, `pgvector` embeddings with backfill,
cost dashboard and quotas. *Requires a deployment change; deferrable
indefinitely.*

Phases 0–4 deliver the whole product statement. Phase 5 is optional.

### Readiness — verified, nothing blocks a start

| Needed for phase 0–1              | State      | Evidence                                                                                                                                                          |
| --------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Register a new plugin             | ready      | `ServerModule.forRoot` imports whatever the plugin list holds — one line in `plugins.ts`, one in `main.tsx`.                                                       |
| Call content logic in-process     | ready      | Logic already lives in injectable services: `EntriesService.list(type, query, workspaceId)`, `EntryWriterService.update(type, id, values, workspaceId, relations, userId)`. Tools are thin wrappers; no refactor. |
| Resolve permissions in code       | ready      | `PermissionsService.forRole(roleId)` + the pure `AccessPolicy.canAll(actor, …)`. The capability profile is ~20 lines on top.                                        |
| Add the new permission keys       | ready      | **No migration** — `seedSystemRoles` is idempotent and runs each boot from `PERMISSIONS` / `SYSTEM_ROLES` (`ON CONFLICT DO NOTHING`).                              |
| Own tables & migrations           | ready      | `@ortha-cms/nx` infers `db:generate` from a `drizzle.config.ts`; the host's `db:migrate` reads `plugins.ts`.                                                        |
| Stream a response                 | clear path | `createServer` adds only a global prefix and `ValidationPipe` — no compression or global interceptor to buffer a stream. Node 22 gives native `fetch` server-side.  |
| Export `AccessPolicy` / `Actor`   | 1-line fix | `identity-server` exports `PermissionsService` and `PermissionsGuard` but not the policy itself.                                                                   |
| New npm dependencies              | two        | `@anthropic-ai/sdk` now; `@modelcontextprotocol/sdk` at phase 4.                                                                                                    |

**MCP is an output, not an input.** It exists in this design so *operators* can
attach their own systems (§4). Phases 0–3 ship with no MCP involved.

**Three things to confirm with a short spike before the engine is written:**

1. **SSE through the Vite dev proxy.** It matches `^/api/` and should pass a
   stream through untouched — worth proving, and the same question applies to
   whatever reverse proxy fronts production.
2. **The strict global pipe.** `ValidationPipe` runs with
   `forbidNonWhitelisted: true`, so the run DTO must declare every field or
   requests 400 with no obvious cause.
3. **Guard composition.** Only `AuthGuard` is global (`APP_GUARD`);
   `PermissionsGuard`, `OriginGuard` and `WorkspaceGuard` are per-controller
   decorators. The copilot's own routes must apply them explicitly — forgetting
   `WorkspaceGuard` would silently unscope a tool.

## 10. Open questions

Settled enough to start phase 0; decide before the phase that needs them.

- **How much schema goes in the system prompt?** A workspace with fifty content
  types would blow the budget if every field were inlined. Current plan: type
  summaries in the prompt, full schema on demand via `content.listTypes` — one
  extra round trip, bounded cost. Revisit with real workspaces.
- **Does `copilot:use` extend to viewers?** A read-only copilot is useful and,
  by construction, cannot mutate; the counter-argument is cost, since viewers
  are the largest population. Leaning yes, with per-role rate limits rather than
  a role exclusion.
- **SSE or websockets?** SSE is the smaller change and enough for token
  streaming. Websockets only earn their cost if presence or server-initiated
  notifications follow. Revisit at phase 5.
- **Who owns proposals — copilot or content?** Current plan: copilot owns the
  table, content exposes an *apply* use-case, so content stays ignorant of where
  a patch came from — which also lets a future human-authored suggestion reuse
  it.
- **Is there a headless surface?** `api-tokens` already mints workspace-scoped
  bearer tokens; exposing runs to them turns the copilot into an automation
  endpoint with a much larger blast radius. Not in v1.
