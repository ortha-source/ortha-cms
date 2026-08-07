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
  `{ apiKey, model, baseUrl?, effort?, maxRetries?, timeoutMs? }`.

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

`capabilities()` calls the Models API once (cached for the adapter's lifetime)
and reads the live context window, output cap and vision support. If the call
fails — no network, no key, a gateway that doesn't proxy `/v1/models` — it falls
back to a conservative record rather than reporting "unknown" as "unsupported",
which would drop a frontier model into degraded mode over a transient blip.

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
