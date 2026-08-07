# @ortha-cms/copilot-domain

The copilot's **framework-free core**. Today it holds one thing: the
`ModelProvider` port and everything that crosses it — the request shape, the
normalised stream events, the usage record, and the supported-capability
baseline.

> Feature context: [`docs/design/copilot.md`](../../../docs/design/copilot.md).
> The two settled decisions:
> [ADR-0004](../../../docs/adr/0004-model-agnostic-copilot-provider.md) (how we
> reach a model) and
> [ADR-0005](../../../docs/adr/0005-copilot-authority-model.md) (what it may do).

## The one hard rule

**This package imports nothing.** Not Nest, not Drizzle, not React, and — the
rule ADR-0004 §1 exists to enforce — **no vendor SDK**. `@anthropic-ai/sdk` may
appear in `copilot/provider-anthropic` and nowhere else. That is what makes the
tool contracts, the capability profile and (later) the run state machine
testable without a framework or a model.

`package.json` has no `dependencies` block at all. Keep it that way; if
something here needs a dependency, it belongs in a layer above.

## What it exports

### The port

- `ModelProvider` — `capabilities()` and `stream(request, signal)`. Two methods,
  deliberately: the surface is narrow enough that a third-party abstraction
  library would cost more than it saves (ADR-0004, alternatives).
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

- `ModelRegistry` + `MODEL_REGISTRY` — name→provider lookup, bound at the
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
