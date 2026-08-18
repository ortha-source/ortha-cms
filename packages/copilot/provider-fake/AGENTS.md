# @ortha-cms/copilot-provider-fake

A scripted, deterministic `ModelProvider`. **Shipped, not test scaffolding**
([ADR-0004](../../../docs/adr/0004-model-agnostic-copilot-provider.md) §3): it
is how `server-e2e` will exercise the whole tool loop with no API key and no
network, and how a contributor runs the admin offline. It is registered in
`apps/server/src/plugins.ts` **last**, after whichever real adapters this
deployment configured — and a clone with no keys configures none, so `fake` is
the only provider there is, which is what lets a fresh checkout chat without
configuration. The first registered provider serves a run that names none, so
being last is also what keeps it out of the way of a deployment that has a real
one.

Depends only on `@ortha-cms/copilot-domain`. No network, no clock, no randomness
— the run engine is a non-deterministic multi-step loop, and a flaky fake would
make every assertion downstream of it flaky too.

## What it exports

- `createFakeProvider(config?): FakeProvider` where `config` is
  `{ script?, capabilities?, chunkSize?, models? }`.

`models` defaults to a single `fake`. Declare several to exercise a model
picker or the engine's model-switching path with no real provider; a run naming
one that wasn't declared is rejected exactly as production would reject it.

`FakeProvider` extends `ModelProvider` with the inspection surface tests need:

- `calls` — every `ModelRequest` served, in order.
- `reset()` — clears `calls` and rewinds the script.

`calls` is the assertion target for the negative path ADR-0005 makes mandatory:
_a viewer's run must be verified not to be offered write tools._ That is an
assertion about `calls[0].tools`, made without a model.

## Layout

```
src/lib/
  fake-provider.ts   # the factory — the stream loop, ~100 lines
  config.ts          # FakeProviderConfig/FakeTurn/FakeToolCall/FakeProvider + defaults
  script.ts          # createScriptReader — the two modes below, and exhaustion
  usage.ts           # estimateUsage — the deterministic token estimate
  text.ts            # chunkText — the delta splitter
```

## Two modes, and the difference matters

- **No `script` (dev mode).** Every call returns the same canned reply, forever.
  A contributor running the admin offline never hits an end.
- **`script` supplied (test mode).** Turns are consumed in order, and running
  past the end **throws**, naming how many turns were scripted and which call
  asked for one. Silently inventing a turn would let a test assert the wrong
  number of model calls and still pass.

## Behaviour

- Text is streamed in `chunkSize` (default 8) character deltas, so a consumer's
  reassembly is genuinely exercised rather than handed one whole string.
- A turn with `toolCalls` and no explicit `stopReason` infers `tool_use`;
  otherwise `end`. Tool-call ids default to `fake-tool-<call>-<index>`.
- Usage defaults to a deterministic ~chars/4 estimate of the request and the
  reply — not a tokenizer, just stable non-zero numbers for accounting
  assertions to bite on. Override per turn with `usage`.
- An abort yields a single `done` with `stopReason: 'aborted'` and **zero**
  usage, checked at every boundary a real adapter observes one at: before the
  first delta, between deltas, before a tool call, and before `done`. The script
  still advances: the run happened, it just didn't finish.

  It used to report a partial estimate on a mid-stream abort, which is the one
  path where the fake behaved differently from both production adapters — so any
  assertion about an aborted run's token columns was written against fake-only
  numbers. `conformance.spec.ts` runs the domain's
  `runModelProviderConformance` kit, the same one both production adapters run,
  so the three cannot drift apart again.
- `calls` records a **snapshot** of each request. The run engine appends to the
  very array it passes as `messages`, so an aliased record would report the whole
  conversation as what the first call was shown.
- `capabilities` is overridable, which is how degraded mode gets tested — e.g.
  `{ toolCalling: false }`.

```typescript
const provider = createFakeProvider({
    script: [
        {
            toolCalls: [
                { name: 'admin_content_search', input: { q: 'launch' } }
            ]
        },
        { text: 'I found 3 matching articles.' }
    ]
});
```

## Commands

- `npx nx typecheck @ortha-cms/copilot-provider-fake`
- `npx nx lint @ortha-cms/copilot-provider-fake`
- `npx nx test @ortha-cms/copilot-provider-fake`
