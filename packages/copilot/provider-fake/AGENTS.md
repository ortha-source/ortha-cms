# @ortha-cms/copilot-provider-fake

A scripted, deterministic `ModelProvider`. **Shipped, not test scaffolding**
([ADR-0004](../../../docs/adr/0004-model-agnostic-copilot-provider.md) §3): it
is how `server-e2e` will exercise the whole tool loop with no API key and no
network, and how a contributor runs the admin offline. It is registered in
`apps/server/src/plugins.ts` alongside the two real adapters, and it is the
`COPILOT_PROVIDER` default so a fresh clone boots without configuration.

Depends only on `@ortha-cms/copilot-domain`. No network, no clock, no randomness
— the run engine is a non-deterministic multi-step loop, and a flaky fake would
make every assertion downstream of it flaky too.

## What it exports

- `createFakeProvider(config?): FakeProvider` where `config` is
  `{ script?, capabilities?, chunkSize? }`.

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
- An already-aborted signal yields a single `done` with `stopReason: 'aborted'`.
  The script still advances: the run happened, it just didn't finish.
- `capabilities` is overridable, which is how degraded mode gets tested — e.g.
  `{ toolCalling: false }`.

```typescript
const provider = createFakeProvider({
    script: [
        {
            toolCalls: [
                { name: 'content.searchEntries', input: { q: 'launch' } }
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
