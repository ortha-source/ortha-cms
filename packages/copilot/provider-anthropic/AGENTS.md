# @ortha-cms/copilot-provider-anthropic

The **native Claude** adapter — a `ModelProvider` over `@anthropic-ai/sdk`. The
default for tool-heavy work, and the path on which native capabilities stay
available ([ADR-0004](../../../docs/adr/0004-model-agnostic-copilot-provider.md) §3).

**This is the only package in the repo allowed to import a model vendor's SDK.**
`copilot/domain` and `copilot/server` must not, ever — the same rule that keeps
Drizzle and Nest out of any `domain/` layer.

## What it exports

- `createAnthropicProvider(config): ModelProvider` — a factory the host binds at
  the composition root. `config` is
  `{ apiKey, models, baseUrl?, effort?, maxRetries?, timeoutMs? }`.

`models` is a **list**, first entry the default. One key and one client back
several models, so a user can switch mid-conversation. A run naming a model
outside the list raises `UnknownModelError` rather than quietly answering on
the default.

## Layout

```
src/lib/
  anthropic-provider.ts   # the factory — orchestration only, ~90 lines
  config.ts               # AnthropicProviderConfig, AnthropicEffort, FALLBACK_CAPABILITIES
  client.ts               # createLazyClient — memoized SDK client + the missing-key error
  capabilities.ts         # probeCapabilities — the Models API probe and its fallback
  wire/
    request.ts            # port -> Anthropic: messages, tools, toStreamParams
    response.ts           # Anthropic -> port: toStopReason, toUsage
```

The split follows the seams a reader actually needs: `wire/` is pure mapping and
holds no state, `client.ts` and `capabilities.ts` are the two pieces that touch
the network, and the factory is left thin enough to read the streaming loop in
one screen. The `wire/` functions are exercised through the provider spec
rather than directly — they have no behaviour a caller can reach on its own.

## The lazy client, and why

The SDK client is constructed on **first use**, not in the factory. A host
registers every provider it might route to, but an operator running local
inference has no Anthropic key — and an unused adapter must not fail their boot.
Selecting it without a key then produces a clear error naming the fix, at the
moment it actually matters.

## Streaming

`client.messages.stream(...)` is iterated for `text_delta` events only; tool
calls come from **`stream.finalMessage()`**, not from reassembled
`input_json_delta` fragments. That means a tool call reaches the engine once,
whole, and already parsed — the engine never has to handle half a call.

Aborting the caller's signal ends the stream with `stopReason: 'aborted'` rather
than throwing, per the port's contract. Usage is reported as zero there: a
cancelled call has no usage record we can trust.

That is not left to this file's good intentions: `conformance.spec.ts` runs the
domain's `runModelProviderConformance` kit, which drives the same clauses against
all three adapters. The SDK stub it uses **observes the signal** — rejecting at
construction when already aborted, erroring the iterator when the abort arrives
mid-stream — because a stub that ignored it would let the abort clauses pass
without being exercised.

## Thinking is left at the API default — do not disable it

The adapter passes **no `thinking` configuration**. On current models thinking
is on by default, and turning it off has a failure mode that is specifically
lethal for a tool-driven copilot: the model occasionally writes a tool call into
its _visible text_ instead of emitting a tool-use block. The turn succeeds, the
call silently never runs, no error is raised — and in an agentic loop that text
stays in history and skews later turns.

If a future phase needs cheaper runs, the lever is `config.effort` (`low` …
`max`), not disabling thinking.

Sampling parameters are likewise absent: current models reject `temperature`,
`top_p` and `top_k` outright, which is why the port never carried them.

## Capabilities are probed, not guessed

`capabilities(model?)` calls the Models API once **per model** (cached for the
adapter's lifetime) and reads the live context window, output cap and vision
support. If the call
fails — no network, no key, a gateway that doesn't proxy `/v1/models` — it falls
back to a conservative record rather than reporting "unknown" as "unsupported",
which would drop a frontier model into degraded mode over a transient blip.

A **failed** probe is not cached, only a successful one: the promise is stored
before it resolves so two concurrent callers share one probe, and evicted if it
rejects. Caching the fallback pinned a frontier model to it for the life of the
process — the network came back and the adapter never noticed.

The Models API exposes no tool-calling flag; every model it serves supports tool
calling, so the adapter reports `true`.

## Stop-reason mapping

| Anthropic                                         | port         |
| ------------------------------------------------- | ------------ |
| `tool_use`                                        | `tool_use`   |
| `refusal`                                         | `refusal`    |
| `max_tokens`, `model_context_window_exceeded`     | `max_tokens` |
| `end_turn`, `stop_sequence`, `pause_turn`, `null` | `end`        |

`pause_turn` is unreachable here: the adapter enables no server-side tools.

## Commands

- `npx nx typecheck @ortha-cms/copilot-provider-anthropic`
- `npx nx lint @ortha-cms/copilot-provider-anthropic`
- `npx nx test @ortha-cms/copilot-provider-anthropic`
