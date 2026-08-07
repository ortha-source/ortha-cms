# @ortha-cms/copilot-provider-openai-compatible

A `ModelProvider` speaking the **OpenAI chat-completions wire format** against a
configurable `baseUrl`. Ollama, vLLM, llama.cpp, LM Studio, LiteLLM, OpenRouter,
Azure and OpenAI itself all speak it — which is what makes a local, air-gapped
install a _configuration choice rather than a fork_
([ADR-0004](../../../docs/adr/0004-model-agnostic-copilot-provider.md) §3).

Depends only on `@ortha-cms/copilot-domain` (for the port **type**, erased at
runtime) and Node built-ins. No SDK: the surface is `POST /chat/completions` and
a few lines of SSE parsing, and a dependency for that would not earn its place.

## What it exports

- `createOpenAiCompatibleProvider(config): ModelProvider`. `config` is
  `{ baseUrl, model, apiKey?, headers?, capabilities?, timeoutMs? }`.

`baseUrl` is the API root **including** the version segment
(`http://localhost:11434/v1`); `/chat/completions` is appended, with any
trailing slashes trimmed first.

## Layout

```
src/lib/
  openai-compatible-provider.ts  # the factory — request + stream loop, ~130 lines
  config.ts                      # config type, defaults, resolveEndpoint/resolveCapabilities
  sse.ts                         # readDataEvents — the event-stream reader
  wire/
    types.ts                     # ChatMessage, ChatCompletionChunk, ToolCallDelta
    request.ts                   # port -> OpenAI: messages, tools, body, headers
    response.ts                  # OpenAI -> port: toStopReason, toUsage
    tool-call-accumulator.ts     # fragment assembly + parseArgs
```

`tool-call-accumulator.ts` is the only piece here with real state, so it has its
own spec rather than being covered solely through the provider — parallel calls
interleave on the wire, and index-keyed assembly is worth pinning directly.

## Capabilities are declared, not probed

Unlike the Anthropic adapter, this one cannot ask: the wire format exposes no
capability discovery. So the **operator** declares it via `config.capabilities`,
and the defaults are the optimistic case (tool calling, streaming, 32K context).

That matters. An operator pointing this at a 3B local model **must** say
`{ toolCalling: false }`, or the engine will assume a baseline the model cannot
meet and the run will fail confusingly instead of dropping into the documented
degraded mode (ADR-0004 §4).

## Streaming normalisation — the actual work

Three shapes have to collapse into the port's vocabulary:

- **Text.** `choices[0].delta.content` → `text-delta`, forwarded immediately.
- **Tool calls.** Arrive as `arguments` **fragments** keyed by `index`, across
  many chunks. They are accumulated in a map and emitted only once the stream
  ends, sorted by index — so a call reaches the engine once, whole, and parsed.
  Malformed JSON yields `{}` rather than crashing the run: the engine then fails
  schema validation and returns a tool error the model can recover from.
- **Usage.** Requested with `stream_options: { include_usage: true }`, which
  servers that don't know the field simply ignore — so a missing trailing usage
  chunk reports zeros rather than failing.

`finish_reason` maps `tool_calls`/`function_call` → `tool_use`, `length` →
`max_tokens`, `content_filter` → `refusal`, everything else → `end`.

Tool **results** flatten onto their own `role: 'tool'` messages after the
assistant turn that requested them — the port's block-structured turns don't map
one-to-one onto OpenAI's flat message list, and a turn can become several
messages.

## Timeouts and aborts

Every request carries an `AbortSignal.timeout` (120 s default), combined with
the caller's signal via `AbortSignal.any`. A caller abort ends the stream with
`stopReason: 'aborted'` per the port contract; a _timeout_ throws with a message
naming the endpoint and the elapsed budget, because that is a misconfiguration
the operator needs to see.

The SSE reader (`sse.ts`) is deliberately forgiving: it reads `data:` lines,
ignores comments and keep-alives, tolerates `\r\n`, and stops at `[DONE]`.

## Commands

- `npx nx typecheck @ortha-cms/copilot-provider-openai-compatible`
- `npx nx lint @ortha-cms/copilot-provider-openai-compatible`
- `npx nx test @ortha-cms/copilot-provider-openai-compatible`
