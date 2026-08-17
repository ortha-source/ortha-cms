# @ortha-cms/copilot-provider-openai

A `ModelProvider` speaking the **OpenAI chat-completions wire format** against a
configurable `baseUrl`. Ollama, vLLM, llama.cpp, LM Studio, LiteLLM, OpenRouter,
Azure and OpenAI itself all speak it — which is what makes a local, air-gapped
install a _configuration choice rather than a fork_
([ADR-0004](../../../docs/adr/0004-model-agnostic-copilot-provider.md) §3).

Depends only on `@ortha-cms/copilot-domain` (for the port **type**, erased at
runtime) and Node built-ins. No SDK: the surface is `POST /chat/completions` and
a few lines of SSE parsing, and a dependency for that would not earn its place.

## What it exports

- `createOpenAiProvider(config): ModelProvider`. `config` is
  `{ baseUrl, models, apiKey?, headers?, capabilities?, timeoutMs?,
  maxTokensField? }`.

`models` is a **list**, first entry the default — one endpoint and one
credential back several models, so a user can switch mid-conversation. A run
naming a model outside the list raises `UnknownModelError` rather than quietly
answering on the default.

`baseUrl` is the API root **including** the version segment
(`http://localhost:11434/v1`); `/chat/completions` is appended, with any
trailing slashes trimmed first.

## Layout

```
src/lib/
  openai-provider.ts             # the factory — request + stream loop, ~150 lines
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

The declaration applies to **every** model on the endpoint. When two differ
materially — one calls tools, one doesn't — register them as two providers
rather than flattening both to the weaker profile.

## Why not just `copilot-provider-openai-compatible`

It was, and the shorter name is a deliberate trade. The adapter is **not** an
OpenAI client: it speaks a wire format that Ollama, vLLM, llama.cpp, LM Studio,
LiteLLM, OpenRouter and Azure all implement. If you are self-hosting and don't
use OpenAI, this is still the package you want — the `baseUrl` is the whole
point.

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

The output ceiling rides on **`max_tokens`**, which every local runtime
understands. OpenAI's reasoning models reject that name and require
`max_completion_tokens`; a deployment pointing at them sets
`maxTokensField: 'max_completion_tokens'`, because the two cannot both be sent —
an unrecognised parameter is itself a 400 there.

Tool **results** flatten onto their own `role: 'tool'` messages after the
assistant turn that requested them — the port's block-structured turns don't map
one-to-one onto OpenAI's flat message list, and a turn can become several
messages.

## The port's clauses are checked, not assumed

`conformance.spec.ts` runs the domain's `runModelProviderConformance` kit, which
drives the same contract against all three adapters — one `done`, an abort that
ends the stream, zero usage on an abort, and the promises around them. The
stubbed endpoint it uses **observes the signal**, erroring the body mid-stream
the way a real socket does, because a stub that ignored it would let the abort
clauses pass unexercised.

## Timeouts and aborts

Every request carries an `AbortSignal.timeout` (120 s default), combined with
the caller's signal via `AbortSignal.any`. A caller abort ends the stream with
`stopReason: 'aborted'` per the port contract; a _timeout_ throws with a message
naming the endpoint and the elapsed budget, because that is a misconfiguration
the operator needs to see.

The SSE reader (`sse.ts`) frames events on the **blank line** the format
defines, joins an event's `data:` lines with newlines, ignores comments,
keep-alives and every other field, tolerates `\r\n`, flushes a final event that
arrived without its trailing blank line, and stops at `[DONE]`. One event is
capped at `MAX_EVENT_CHARS` (1 MiB): a proxy that streams without ever sending a
boundary would otherwise grow one string for the whole request budget.

## Commands

- `npx nx typecheck @ortha-cms/copilot-provider-openai`
- `npx nx lint @ortha-cms/copilot-provider-openai`
- `npx nx test @ortha-cms/copilot-provider-openai`
