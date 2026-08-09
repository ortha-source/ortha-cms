# @ortha-cms/copilot-domain

The copilot's **framework-free core**: the `ModelProvider` port and everything
that crosses it, plus (as of phase 1) the tool contracts, the capability
profile, the run vocabulary, and the untrusted-content fence.

> Feature context: [`docs/design/copilot.md`](../../../docs/design/copilot.md).
> The two settled decisions:
> [ADR-0004](../../../docs/adr/0004-model-agnostic-copilot-provider.md) (how we
> reach a model) and
> [ADR-0005](../../../docs/adr/0005-copilot-authority-model.md) (what it may do).

## The one hard rule

**This package imports nothing.** Not Nest, not Drizzle, not React, and — the
rule ADR-0004 §1 exists to enforce — **no vendor SDK**. `@anthropic-ai/sdk` may
appear in `copilot/provider-anthropic` and nowhere else. That is what makes the
tool contracts, the capability profile and the run vocabulary testable without a
framework or a model.

This rule has real consequences, and they are features rather than costs: the
capability profile restates set membership instead of importing identity's
`AccessPolicy`, and tool-input validation is a hand-written schema subset
instead of a library. Both are documented where they live.

`package.json` has no `dependencies` block at all. Keep it that way; if
something here needs a dependency, it belongs in a layer above.

## What it exports

### The port

- `ModelProvider` — `models()`, `capabilities(model?)` and
  `stream(request, signal)`. Three methods, deliberately: the surface is narrow
  enough that a third-party abstraction library would cost more than it saves
  (ADR-0004, alternatives).
- **A provider serves several models.** `models()` returns the ids it offers,
  first as the default, so one endpoint and one credential can back a cheap
  model for routine turns and a frontier one for hard work — and a user can
  switch mid-conversation without a redeploy. It is synchronous because it is
  declared configuration: a model picker renders it with no round trip.
- `resolveModel(requested, available)` — the one rule every adapter applies:
  the named model, or the first as default, and `UnknownModelError` for
  anything else. Falling back to the default would answer on a different model
  than the caller asked for, and bill it silently.
- `ModelRequest` — model id (optional; the provider's configured default wins),
  system prompt, messages, tools, output ceiling. **No sampling parameters**:
  current frontier models reject `temperature`/`top_p`/`top_k` outright, so the
  port doesn't pretend to carry them.
- `ModelStreamEvent` — `text-delta` | `tool-call` | `done`. Two wire formats,
  two tool-call encodings and two usage shapes collapse to this one vocabulary,
  so the engine never grows a branch per vendor.
- `ModelUsage` / `ModelStopReason` — the inputs to cost accounting and to the
  "why did it stop" line the UI shows.

### The registry seam

- `ModelRegistry` + `MODEL_REGISTRY` — name→provider lookup plus
  `catalogue()`, every provider × model pair on offer (what a model picker
  renders, and the full set a run may legally choose from). Bound at the
  composition root. The implementation (`buildModelRegistry`) lives in
  `copilot/server`; only the interface and the token are here, so an adapter
  package depends on the domain and never on the server.
- `ModelResolver` + `MODEL_RESOLVER` — the optional per-run router. Plain code
  in `plugins.ts`, returning a registered provider **name**.
- `UnknownModelProviderError` — thrown by the registry, transport-agnostic.

### The abort contract, made executable

- `isAbortError(error, signal?)` and `abortedEvent()` (`lib/model/abort.ts`).

The port says an abort **ends** the stream with `stopReason: 'aborted'` rather
than throwing out of it, and that a cancelled call reports zero usage. Every
adapter has to implement that clause, so it lives here as two functions instead
of as prose copy-pasted into each one. Both are pure, so this costs the layer
nothing.

### The offer-time gate

The tool _contract_ and its registry are shared with the MCP endpoint and live
in `@ortha-cms/tools-server` (ADR-0007). `ToolSpec`, `ToolContext` and
`COPILOT_TOOL_PROVIDER` are gone from this package. What remains is what
genuinely belongs to a framework-free core:

- `resolveCapabilityProfile(...)` — the **offer**-time gate (ADR-0005 §3). Pure
  and total, which is what makes "a viewer is offered no write tools" a unit
  test rather than a promise. Since
  [ADR-0009](../../../docs/adr/0009-copilot-applies-directly.md) the declared
  permissions are its _only_ input: the per-workspace auto-apply opt-in, and the
  `apply-not-enabled` withheld reason it produced, are gone. It is **generic over a three-field structural
  type** (`AuthorizableTool`: `name`, `requires`, `effect`) rather than
  importing `ToolDefinition`, so this package still imports nothing and the
  server still passes the real registry's tools straight in.
- `validateToolInput(input, schema)` — a **deliberate JSON Schema subset**
  covering what the generated tool schemas use, ignoring keywords it doesn't
  know. Sound because it is defence in depth behind the profile, not the
  boundary: `ToolRegistry.call` is the boundary. Its job is stopping a
  malformed model call from becoming a 500.

### Proposals (phase 3)

- `ProposalDraft` / `ProposalTarget` / `ProposalChange` / `ProposalStatus` —
  what a `propose` tool returns. The engine applies it as soon as it is drafted
  (ADR-0009), so a new row lands `accepted`, or stays `pending` because the
  apply **failed**; `rejected` survives only on rows written before that. `target` and `patch` are deliberately opaque
  JSON: their shape belongs to the applier that declared the `kind`, and
  teaching the copilot every plugin's addressing would make it the thing that
  changes whenever one of them does.
- `isProposalDraft(value)` — the runtime guard. `effect: 'propose'` is a promise
  a binder makes about its return value; without this, a binder that broke it
  would write a malformed row into an append-only table instead of producing an
  ordinary tool error.
- `ProposalApplier` + `COPILOT_PROPOSAL_APPLIER` + `ProposalActor` /
  `ProposalApplyResult` — the write half, inverted exactly like the tool port so
  `copilot/server` still never imports a feature plugin. The interface's
  contract is one sentence: **an applier runs the ordinary use-case**, with the
  human as actor. `ProposalActor` carries the actor's email as well as their id,
  because the audit trail freezes an email snapshot on every event and an
  applier holding only an id would have to look it up — a query per apply, in
  the one path where getting the actor wrong is least acceptable.

### The run (phase 1)

- `CopilotRunEvent` — the engine's output vocabulary and exactly what the SSE
  controller serializes. `RunProposalEvent` follows a `propose` tool's own
  result rather than replacing it: the tool result is what the _model_ was told,
  the proposal is what the _human_ is being asked to decide, and a client
  renders the step list from one and the card from the other. A client reducer written against this union turns a new
  event kind into a compile error rather than a silently ignored frame.
- `RunLimits` / `DEFAULT_RUN_LIMITS` / `RunStopReason` — the three ceilings
  (steps, wall clock, tokens) and why a run ended. `RunStopReason` is a superset
  of `ModelStopReason`: the model reports why _it_ stopped, this reports why the
  _run_ did, including limits the model never sees.
- `fenceUntrusted(source, payload)` + `UNTRUSTED_DATA_RULE` — ADR-0005 §8's
  structural defence. Two properties carry it: the payload is JSON (so no field
  can introduce a line that reads as a new turn) and `<` is escaped (so the
  closing delimiter is unforgeable from inside). Unit-tested against a forged
  fence.

### The baseline

- `SUPPORTED_BASELINE`, `baselineShortfalls(caps)`, `meetsSupportedBaseline(caps)`.

ADR-0004 §4 commits us to a **supported tier** — streaming, native tool calling,
and a context window big enough for a workspace's type summaries — and to
saying so in words when a model falls below it. `baselineShortfalls` returns
_every_ dimension that falls short, not the first, because the settings UI has
to name which capability is missing. Unit-tested; the test is the specification.

## Conventions

- `interface` for type contracts, `type` for unions and derived types
- All exported symbols carry JSDoc
- No `.js` extensions in TypeScript imports; always `import type` for types

## Commands

- `npx nx typecheck @ortha-cms/copilot-domain`
- `npx nx lint @ortha-cms/copilot-domain`
- `npx nx test @ortha-cms/copilot-domain`
