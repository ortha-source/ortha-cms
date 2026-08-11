# @ortha-cms/copilot-provider-openai — Test Artifact

> **Unit:** `packages/copilot/provider-openai` · **Package:** `@ortha-cms/copilot-provider-openai` · **Kind:** adapter (`ModelProvider` implementation)
> **Source of truth:** `packages/copilot/provider-openai/AGENTS.md`
> **Generated:** 2026-08-11

## 1. Scope & Preconditions

**Owns** the OpenAI chat-completions wire-format adapter against a configurable
`baseUrl` — the package that makes a local, air-gapped install "a configuration
choice rather than a fork" (ADR-0004 §3). Ollama, vLLM, llama.cpp, LM Studio,
LiteLLM, OpenRouter, Azure and OpenAI itself are all reachable through it.

| Area | File |
| --- | --- |
| Factory, request + stream loop | `src/lib/openai-provider.ts` |
| Config, defaults, `resolveEndpoint`, `resolveCapabilities` | `src/lib/config.ts` |
| The SSE reader | `src/lib/sse.ts` |
| Port → wire | `src/lib/wire/request.ts` |
| Wire → port | `src/lib/wire/response.ts` |
| Tool-call fragment assembly | `src/lib/wire/tool-call-accumulator.ts` |
| Wire types | `src/lib/wire/types.ts` |

**No SDK.** `package.json` declares exactly one dependency,
`@ortha-cms/copilot-domain`, which is a **type-only** import erased at runtime.
Everything else is Node built-ins: `fetch`, `TextDecoder`, `AbortSignal`,
`ReadableStream`. This is the ADR-0004 §1 rule holding in the strongest possible
form — this package could not import a vendor SDK if it wanted to.

**Does NOT own:** the port (domain), registration (`apps/server/src/plugins.ts:121-125`),
its own config values (`apps/server/ortha.config.ts:233-244`), retries (there are
none — see 🐞 BUG-copilot-provider-openai-06), the run loop, tools,
authorization or persistence.

### Entry points (exported API — `src/index.ts:1-2`)

| Export | Kind | Notes |
| --- | --- | --- |
| `createOpenAiProvider(config): ModelProvider` | factory | Returns `{ models, capabilities, stream }` |
| `OpenAiProviderConfig` | type | `{ baseUrl, models, apiKey?, headers?, capabilities?, timeoutMs? }` |

Not exported: `DEFAULT_CAPABILITIES`, `DEFAULT_TIMEOUT_MS`, `resolveEndpoint`,
`resolveCapabilities`, `readDataEvents`, the four `wire/` modules.

> **AGENTS.md is stale here.** It documents
> `createOpenAiCompatibleProvider(config)` with
> `{ baseUrl, model, apiKey?, headers?, capabilities?, timeoutMs? }` — singular
> `model`. The package actually exports `createOpenAiProvider` with **plural**
> `models`. See 🐞 BUG-copilot-provider-openai-07.

**No routes, no DI providers, no tables, no slots.**

### Runtime prerequisites

| Requirement | Where | Notes |
| --- | --- | --- |
| `COPILOT_ENABLED=true` | `ortha.config.ts:194` | The kill switch |
| `COPILOT_PROVIDER=ollama` | `ortha.config.ts:198` | **Otherwise the default is `fake`** — see `docs/testing/copilot-provider-fake.md` 🐞 BUG-copilot-provider-fake-01 |
| A reachable `baseUrl` | `ortha.config.ts:236-238`, default `http://localhost:11434/v1` | The API root **including** the version segment; `/chat/completions` is appended |
| `COPILOT_OPENAI_MODELS` | `ortha.config.ts:239`, default `llama3.1` | Comma-separated; first is the default |
| `COPILOT_OPENAI_API_KEY` | `ortha.config.ts:243` | Optional — a local runtime usually wants none |
| A model that actually exists on that endpoint | — | `ollama pull llama3.1` |
| A user holding `copilot:use`, and a workspace | identity / workspaces | To reach it through the run route |

**The declared-capabilities trap:** the wire format exposes no capability
discovery, so `config.capabilities` is the **operator's** declaration and the
defaults are optimistic — `{ toolCalling: true, streaming: true, vision: false,
contextWindow: 32 768, maxOutputTokens: 4 096 }` (`src/lib/config.ts:41-47`).
AGENTS.md is emphatic that a 3B local model **must** be declared
`{ toolCalling: false }`. Since nothing reads capabilities at all
(`docs/testing/copilot-domain.md` 🐞 BUG-copilot-domain-01), declaring it
correctly currently changes nothing — which makes the trap worse, not better.

### How to exercise it manually

```bash
docker compose up -d
npx nx run server:db:migrate
ollama serve &                  # or vLLM, llama.cpp, LM Studio…
ollama pull llama3.1

COPILOT_ENABLED=true \
COPILOT_PROVIDER=ollama \
COPILOT_OPENAI_BASE_URL=http://localhost:11434/v1 \
COPILOT_OPENAI_MODELS=llama3.1 \
npm run dev
```

Sign in at `http://localhost:4200`, open a workspace, press **⌘J**, send a
message. Or drive the route directly:

```bash
curl -N -X POST http://localhost:3000/api/copilot/runs \
  -b cookies.txt -H "X-Workspace-Id: $WS" -H 'content-type: application/json' \
  -H 'Origin: http://localhost:4200' \
  -d '{"message":"how many drafts?","provider":"ollama","model":"llama3.1"}'
```

Against a real OpenAI endpoint:

```bash
COPILOT_OPENAI_BASE_URL=https://api.openai.com/v1 \
COPILOT_OPENAI_MODELS=gpt-4o-mini \
COPILOT_OPENAI_API_KEY=sk-… \
COPILOT_PROVIDER=ollama npm run dev
```

**A local wire stub is the most useful harness for this unit** — it is the only
way to drive the malformed-SSE, truncated-stream and dialect-divergence cases:

```bash
node -e "require('http').createServer((q,s)=>{s.writeHead(200,{'content-type':'text/event-stream'});
  s.write('data: {\"choices\":[{\"delta\":{\"content\":\"hi\"}}]}\n\n');
  s.write('data: [DONE]\n\n'); s.end();}).listen(8099)"
COPILOT_OPENAI_BASE_URL=http://localhost:8099/v1 COPILOT_PROVIDER=ollama npm run dev
```

Automated:

```bash
npx nx test @ortha-cms/copilot-provider-openai   # 🧪 two specs, fetch mocked
npx nx typecheck @ortha-cms/copilot-provider-openai
npx nx lint @ortha-cms/copilot-provider-openai
```

### Dependencies that must be healthy

- Node ≥ 20 for `fetch`, `AbortSignal.timeout` and `AbortSignal.any`
  (`openai-provider.ts:126-127`).
- `@ortha-cms/copilot-domain` — the port, `resolveModel`, `isAbortError`,
  `abortedEvent`.
- The configured endpoint, which must accept `POST /chat/completions` with
  `stream: true` and answer `text/event-stream`.

---

## 2. Feature Inventory

| # | Feature | Where it lives | Coverage |
| --- | --- | --- | --- |
| F1 | `resolveEndpoint` appends `/chat/completions`, trimming trailing slashes | `src/lib/config.ts:52-54` | 🧪 UNIT `src/lib/openai-provider.spec.ts:51` |
| F2 | `models()` advertises every declared model, first as default | `openai-provider.ts:196`, `:125` | 🧪 UNIT `:386` |
| F3 | A per-request `model` override is sent | `openai-provider.ts:125` | 🧪 UNIT `:394` |
| F4 | A model this endpoint does not serve is rejected **before anything is sent** | `openai-provider.ts:122-125` | 🧪 UNIT `:402` |
| F5 | Text deltas are forwarded in order, as they arrive | `openai-provider.ts:159-161` | 🧪 UNIT `:61` |
| F6 | Tool-call fragments are accumulated by `index` and emitted **once the stream ends** | `openai-provider.ts:162`, `:168`; `wire/tool-call-accumulator.ts:454-487` | 🧪 UNIT `:83`, `src/lib/wire/tool-call-accumulator.spec.ts:9` |
| F7 | Parallel calls interleave on the wire and are emitted in `index` order | `tool-call-accumulator.ts:470-472` | 🧪 UNIT `:135`, `tool-call-accumulator.spec.ts:26` |
| F8 | Malformed argument JSON yields `{}` rather than crashing the run | `tool-call-accumulator.ts:435-444` | 🧪 UNIT `:177`, `tool-call-accumulator.spec.ts:79` |
| F9 | A missing tool-call `id` is synthesised as `call-<index>` | `tool-call-accumulator.ts:479` | 🧪 UNIT `tool-call-accumulator.spec.ts:52` |
| F10 | A fragment set that never carried a `name` is **dropped**, not invented | `tool-call-accumulator.ts:473-484` | 🧪 UNIT `tool-call-accumulator.spec.ts:64` |
| F11 | Usage is requested with `stream_options: { include_usage: true }` and read from the trailing chunk | `wire/request.ts:355-358`; `openai-provider.ts:151-153` | 🧪 UNIT `:212` |
| F12 | A server that ignores `stream_options` reports **zeros**, not an error | `openai-provider.ts:143` | ⚠️ PARTIAL — the default is set; no case drives a server that omits it |
| F13 | `cachedInputTokens` is read from `prompt_tokens_details.cached_tokens` when present | `wire/response.ts:400-405` | ❌ NONE |
| F14 | `finish_reason` mapping: `tool_calls`/`function_call`→`tool_use`, `length`→`max_tokens`, `content_filter`→`refusal`, else→`end` | `wire/response.ts:376-390` | 🧪 UNIT `:240` |
| F15 | Tool **results** flatten onto their own `role: 'tool'` messages after the assistant turn | `wire/request.ts:284-329` | 🧪 UNIT `:256` |
| F16 | Tools are sent in the function-calling shape; the key is omitted when there are none | `wire/request.ts:332-341`, `:353` | 🧪 UNIT `:306` |
| F17 | `system` becomes the first message with `role: 'system'` | `wire/request.ts:288-290` | 🧪 UNIT `:256` |
| F18 | Headers: `content-type`, optional `authorization: Bearer`, then `config.headers` **overriding** both | `wire/request.ts:363-371` | ❌ NONE |
| F19 | Every request carries an `AbortSignal.timeout`, combined with the caller's via `AbortSignal.any` | `openai-provider.ts:126-127` | ❌ NONE |
| F20 | A caller abort ends the stream with `stopReason:'aborted'` | `openai-provider.ts:170-174` | 🧪 UNIT `:347` |
| F21 | A **timeout** throws with a message naming the endpoint and the budget | `openai-provider.ts:175-179` | ❌ NONE |
| F22 | A non-2xx response raises an error naming the endpoint, the status, and up to 500 chars of the body | `openai-provider.ts:184-193` | 🧪 UNIT `:337` |
| F23 | `capabilities()` reports the operator's declaration over the defaults | `config.ts:57-66`; `openai-provider.ts:197-201` | 🧪 UNIT `:369`, `:411` |
| F24 | The declaration applies to **every** model on the endpoint | `config.ts:57-66` | 🧪 UNIT `:411` |
| F25 | The SSE reader tolerates `\r\n`, comment lines and keep-alives, and stops at `[DONE]` | `src/lib/sse.ts:219-268` | ⚠️ PARTIAL — no `\r\n` case, no comment case |
| F26 | A chunk that is not JSON is skipped, not fatal | `openai-provider.ts:206-213` | ❌ NONE |
| F27 | The reader lock is released so an aborted request tears the socket down | `sse.ts:264-268` | ❌ NONE |
| F28 | `max_tokens` is sent (not `max_completion_tokens`) | `wire/request.ts:354` | ❌ NONE → 🐞 BUG-copilot-provider-openai-03 |
| F29 | A multi-line `data:` SSE event | `sse.ts:238-254` | ❌ NONE → 🐞 BUG-copilot-provider-openai-04 |
| F30 | An unbounded SSE buffer | `sse.ts:232` | ❌ NONE → 🐞 BUG-copilot-provider-openai-05 |

---

## 3. Manual Test Plan

**Global preconditions:** `docker compose up -d`; `npx nx run server:db:migrate`;
a workspace granting `test_article`; a signed-in admin; a running endpoint at
`COPILOT_OPENAI_BASE_URL`. Where a block needs a specific wire behaviour, use
the local stub from §1 — it is the only way to drive most of §4.

**Keyboard-only path / screen-reader expectation, all blocks:** this unit has no
UI. Where a step says "open the panel", that surface is assessed in
`docs/testing/copilot-admin.md` §4A; here the observable is the outbound HTTP
request and the persisted run record, both reachable from a terminal. See §4A.

### F1 — endpoint construction

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `COPILOT_OPENAI_BASE_URL=http://localhost:11434/v1` | Requests go to `http://localhost:11434/v1/chat/completions` |
| 2 | `…/v1/` (trailing slash) | Same — no `//` |
| 3 | `…/v1///` | Same — `replace(/\/+$/,'')` trims all of them |
| 4 | `COPILOT_OPENAI_BASE_URL=http://localhost:11434` (no version segment) | `http://localhost:11434/chat/completions` — **a 404 on Ollama**. The adapter cannot detect this; the error names the endpoint, which is the diagnosis |

### F2–F4 — model resolution

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `COPILOT_OPENAI_MODELS=llama3.1,qwen2.5` and `GET /api/copilot/models` | Two `{"provider":"ollama","model":…}` entries, in that order |
| 2 | Send with `{"provider":"ollama"}` and no model | The wire body has `"model":"llama3.1"`; the persisted turn records it |
| 3 | Send with `{"provider":"ollama","model":"qwen2.5"}` | Both reflect `qwen2.5` |
| 4 | Send with `{"provider":"ollama","model":"mistral"}` | An `error` frame naming what is available. **No HTTP request is made** — `resolveModel` runs before `fetch` (`openai-provider.ts:122-125`) |

### F5–F10 — streaming and tool assembly

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `curl -N` a run against a slow local model | `event: text-delta` frames arrive spread over time, not in one burst |
| 2 | Ask something requiring a tool | The frame order is: all `text-delta`s for the turn, **then** `tool-call`, then `tool-result`, then the next turn's text. Tool calls are emitted only after the stream ends (`openai-provider.ts:168`) — the same ordering as the anthropic adapter, and see 🐞 BUG-copilot-provider-anthropic-05 |
| 3 | Expand the tool step | `input` is a parsed object |
| 4 | Force two parallel calls (a model that supports them) | Both steps appear, in `index` order |
| 5 | Stub a response whose `arguments` fragments never form valid JSON | The step still appears with `input: {}`, then fails schema validation with `Invalid arguments: …` — a recoverable tool error, not a dead stream |
| 6 | Stub a fragment set carrying `arguments` but never a `function.name` | **No** tool call is emitted at all. The turn ends with `finish_reason: tool_calls` but no `toolUses`, so `streamTurn` returns `toolUses: []` and the engine returns `'end'` — the run finishes with whatever text was produced, silently |
| 7 | Stub a fragment set with no `id` | The step's id is `call-0`; the engine's `tool_result` echoes it |

### F11–F14 — usage and stop reasons

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Against Ollama, read the persisted turn's token columns | Non-zero if the server honours `stream_options`; **zero** if not — and the run's token ceiling then never trips |
| 2 | Against api.openai.com, same | `prompt_tokens` / `completion_tokens` populated; `cachedInputTokens` present on a cache hit |
| 3 | Set `COPILOT_MAX_OUTPUT_TOKENS=16` and ask for a long answer | `finish_reason: length` → `max_tokens` → run reason `max-output-tokens`; the warning Alert appears |
| 4 | Trigger a content filter | `content_filter` → `refusal`; the transcript says "The model declined to answer." |
| 5 | Stub `finish_reason: "function_call"` (legacy) | Mapped to `tool_use` |
| 6 | Stub `finish_reason: "some_new_reason"` | Mapped to `end` — an unknown reason is treated as a clean finish, which is the forgiving default and worth knowing |

### F15–F18 — request construction

Watch the wire for every step.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Any run | `messages[0]` is `{role:'system', content:'You are Ortha AI…'}` |
| 2 | Any run | `stream: true` and `stream_options: {include_usage: true}` |
| 3 | Any run | `max_tokens` equals `COPILOT_MAX_OUTPUT_TOKENS` — note **not** `max_completion_tokens` (🐞 BUG-copilot-provider-openai-03) |
| 4 | After a tool round trip | The assistant message carries `tool_calls` and `content: ""`; then one `{role:'tool', tool_call_id, content}` message **per result** |
| 5 | A turn where the profile offers no tools | The `tools` key is **absent**, not `[]` |
| 6 | Add `headers: { 'x-org': 'acme' }` to the config | The header is present |
| 7 | Add `headers: { authorization: 'Bearer other' }` **and** an `apiKey` | The spread order (`wire/request.ts:366-370`) means `config.headers` **wins** — the `apiKey` is silently overridden. Deliberate ("letting `config.headers` override the rest") and worth pinning |
| 8 | Set an Azure-shaped config: `headers: { 'api-key': '…' }`, no `apiKey` | No `authorization` header is sent |

### F19–F22 — timeouts, aborts and failures

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Press **Stop** mid-answer | The stream ends; the turn records `stopReason:'aborted'` and **zero** usage; no exception in the log |
| 2 | Set `timeoutMs: 2000` and point at a stub that never responds | After 2 s an `error` frame: `Copilot model request to http://…/v1/chat/completions timed out after 2000ms.` — **note the internal URL is in a message shown to the user** (🐞 BUG-copilot-provider-openai-01) |
| 3 | Point at a stub returning `401 {"error":{"message":"bad key","param":null}}` | An `error` frame: `Copilot model request to http://… failed: 401 Unauthorized — {"error":{"message":"bad key",…}}` — **the upstream body is echoed to the browser** |
| 4 | Point at a stub returning a 500 HTML error page | The first 500 characters of that HTML reach the browser |
| 5 | Stop the endpoint entirely | `fetch` rejects with a `TypeError`; `isAbortError` is false, `timeout.aborted` is false, so it is re-thrown and reaches the user as its raw message |
| 6 | Abort **and** let the timeout fire in the same tick | `isAbortError(error, signal)` checks `signal.aborted` first, so the caller's abort wins and the timeout message is lost. Correct precedence |

### F23–F24 — declared capabilities

| Step | Action | Expected result / **Observed** |
| --- | --- | --- |
| 1 | In a REPL: `createOpenAiProvider({baseUrl:'…', models:['llama3.1']}).capabilities()` | `{model:'llama3.1', toolCalling:true, streaming:true, vision:false, contextWindow:32768, maxOutputTokens:4096}` — the optimistic defaults |
| 2 | Add `capabilities: { toolCalling: false, contextWindow: 4096 }` | Merged over the defaults; `model` is always the resolved one |
| 3 | `capabilities('qwen2.5')` on a two-model provider | The **same** declaration with a different `model` — one profile per endpoint (`config.ts:57-66`) |
| 4 | Declare `{toolCalling:false}` and run a turn | **Observed:** the full tool list is still sent and the model ignores it. Nothing degrades and nothing says so → cross-ref `docs/testing/copilot-domain.md` 🐞 BUG-copilot-domain-01. **Expected** per ADR-0004 §4: a reduced tool set and a UI line |

### F25–F27 — the SSE reader

Drive all of these with the local stub.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Frames separated by `\r\n\r\n` | Parsed — the reader splits on `\n` and trims |
| 2 | A comment line `: keep-alive` | Skipped |
| 3 | `data: [DONE]` | The generator returns; anything after is ignored |
| 4 | A chunk boundary splitting a `data:` line mid-JSON | Buffered and joined on the next read |
| 5 | A `data:` line whose payload is not JSON | Skipped by `parseChunk` (`openai-provider.ts:206-213`); the stream continues |
| 6 | A stream that ends **without** `[DONE]` | The tail is flushed (`sse.ts:257-263`) and the loop ends normally with `stopReason` from the last `finish_reason` |
| 7 | A **multi-line** `data:` event (SSE-legal): `data: {"choices":\ndata: [{"delta":…}]}` | **Observed:** each line is treated as its own event; both fail `JSON.parse` and are dropped silently → 🐞 BUG-copilot-provider-openai-04 |
| 8 | A stream that emits 50 MB with no `\n` | **Observed:** `buffer` grows unbounded for the whole 120 s budget → 🐞 BUG-copilot-provider-openai-05 |

---

## 4. Edge Cases & Negative Paths

### Empty / zero

- **EC-01 — `models: []`.** `❌ NONE` `resolveModel` throws a plain `Error`;
  `CopilotPlugin` rejects it at boot (`copilot-plugin.ts:61-67`).
- **EC-02 — `apiKey` absent.** `🧪 UNIT` (implied) No `authorization` header —
  the correct behaviour for a local runtime.
- **EC-03 — An empty stream (headers, then immediate close).** `❌ NONE`
  No chunks → `stopReason:'end'`, zero usage, no text. The engine returns
  `'end'` with nothing persisted.
- **EC-04 — `choices: []` in a chunk.** `❌ NONE`
  `chunk.choices?.[0]` is undefined → `continue` (`openai-provider.ts:155-158`).
  Correct: the usage-only trailing chunk has exactly this shape.
- **EC-05 — `delta.content: ""`.** `❌ NONE` Falsy, so no `text-delta` is
  emitted. Right — an empty delta is noise.
- **EC-06 — `delta.content: null`.** `❌ NONE` Same; the type allows it
  (`wire/types.ts:511`).
- **EC-07 — A response with `body: null`.** `❌ NONE`
  `!response.ok || !response.body` → `requestError` (`openai-provider.ts:137-139`),
  whose own `response.body ? await response.text() : ''` guard then yields no
  detail. Consistent.

### Boundary

- **EC-08 — `timeoutMs: 0`.** `❌ NONE` `AbortSignal.timeout(0)` fires
  immediately — every request times out. `?? DEFAULT_TIMEOUT_MS` does not catch
  `0` because `0` is not nullish (`openai-provider.ts:115`).
- **EC-09 — `timeoutMs` shorter than the model's first token.** `❌ NONE`
  The documented failure: the message names the endpoint and the budget, "because
  that is a misconfiguration the operator needs to see" (AGENTS.md). It also
  names it to the *user* — see 🐞 BUG-copilot-provider-openai-01.
- **EC-10 — `max_tokens` above the model's cap.** `❌ NONE`
  Ollama clamps; OpenAI 400s. Nothing clamps against the declared
  `capabilities.maxOutputTokens`, which is available and unused.
- **EC-11 — A tool-call `index` that is not 0-based, or sparse.** `🧪 UNIT`
  `tool-call-accumulator.spec.ts:26` covers interleaving; the map is keyed by
  whatever index arrives and sorted numerically (`:470-472`), so sparse indices
  work.
- **EC-12 — A negative `index`.** `❌ NONE` Sorts first. Harmless.
- **EC-13 — 100 parallel tool calls.** `❌ NONE`
  All accumulated and drained; the engine then runs them **sequentially**
  (`run-engine.service.ts:403-438`) and each may park on a permission prompt.

### Size & encoding

- **EC-14 — A 10 MB tool result in `messages`.** `❌ NONE`
  `JSON.stringify(toRequestBody(...))` serialises the whole conversation per
  turn. See `docs/testing/copilot-domain.md` 🐞 BUG-copilot-domain-02.
- **EC-15 — A multi-byte character split across two `read()` chunks.**
  `❌ NONE` `decoder.decode(value, { stream: true })` (`sse.ts:232`) handles it
  correctly — the `stream: true` flag is load-bearing and easy to drop.
- **EC-16 — Emoji / RTL in a delta.** `❌ NONE` Passed through.
- **EC-17 — A `data:` payload of 5 MB.** `❌ NONE` Buffered whole, then
  `JSON.parse`d. No cap.
- **EC-18 — A tool `description` over the endpoint's limit.** `❌ NONE`
  Upstream 400, echoed to the user.

### Dialect divergence (the interesting axis for this adapter)

- **EC-19 — `max_tokens` vs `max_completion_tokens`.** `❌ NONE`
  → 🐞 BUG-copilot-provider-openai-03.
- **EC-20 — An assistant message with `content: ""` **and** `tool_calls`.**
  `❌ NONE` `wire/request.ts:318-323` always sets `content: text.join('\n')`,
  which is `''` when the turn was tool-calls-only. Some servers reject an empty
  string where `null` is expected. → 🐞 BUG-copilot-provider-openai-08
  (**Unverified**).
- **EC-21 — A server that does not support `tools` at all.** `❌ NONE`
  Ollama with a non-tool model returns a 400 naming the field. The whole turn
  fails; there is no fallback, because degraded mode does not exist.
- **EC-22 — A server that ignores `stream_options`.** `⚠️ PARTIAL`
  Documented; zeros reported. The consequence — the run's token ceiling can
  never trip — is unstated.
- **EC-23 — Azure's deployment-in-the-URL shape.** `❌ NONE`
  `resolveEndpoint` appends `/chat/completions` to whatever it is given, so an
  Azure base URL must already include the deployment path. AGENTS.md claims
  Azure works; nothing verifies it.
- **EC-24 — OpenRouter's required attribution headers.** `❌ NONE`
  Supported via `config.headers`. Untested.
- **EC-25 — A server that streams `role` in the first delta and content after.**
  `❌ NONE` Ignored — only `delta.content` and `delta.tool_calls` are read.
  Correct.
- **EC-26 — A server that sends `finish_reason` on a chunk **before** the last.**
  `❌ NONE` `stopReason` is overwritten by each non-null `finish_reason`
  (`openai-provider.ts:163-165`), so the last wins. Reasonable.

### Permission matrix

The adapter is permission-agnostic; what varies by role is the request body's
`tools` array.

| Role | `tools` sent | Observable |
| --- | --- | --- |
| admin | 17 entries incl. every `*_propose_*` | ✅ `copilot-proposals.spec.ts:181` |
| contributor | as admin minus `activity_recent` | ✅ `copilot-read-catalogue.spec.ts:173` |
| viewer | reads only | ✅ `copilot-chat.spec.ts:579` |
| no `copilot:use` | never reached — 403 at the route | ✅ `copilot-chat.spec.ts:126` |

- **EC-27 — Can a caller choose an unregistered provider?** No —
  `registry.has` (`run-engine.service.ts:249-253`).
- **EC-28 — Can a caller influence `baseUrl`?** **No.** It is operator config
  only (`ortha.config.ts:236-238`), never in `CreateRunDto`. This is the
  boundary that keeps 🐞 BUG-copilot-provider-openai-02 an operator-risk rather
  than a user-reachable SSRF.

### Tenant isolation

- **EC-29 — Nothing here is workspace-aware**, correctly. The one
  tenancy-adjacent fact worth a test-plan line: an operator pointing `baseUrl`
  at a hosted endpoint sends **workspace content** to a third party. That is
  exactly what ADR-0005 §10's default-off switch makes an explicit decision.

### Concurrency

- **EC-30 — Two runs at once on one provider instance.** `❌ NONE`
  The closure holds only `endpoint`, `timeoutMs` and `models` — all immutable.
  The accumulator is created **per stream** (`openai-provider.ts:141`), which is
  the important part. Safe.
- **EC-31 — Two runs sharing a keep-alive socket.** `❌ NONE`
  `fetch` handles it. Each has its own `ReadableStream` and reader.

### Failure & partiality

- **EC-32 — The connection dropping mid-stream.** `❌ NONE`
  `reader.read()` rejects; `isAbortError` is false and `timeout.aborted` is
  false, so it is re-thrown. The engine persists the partial turn with
  `stopReason:'error'`. The already-yielded text survives. Good behaviour,
  untested.
- **EC-33 — A 200 response that is not `text/event-stream`.** `❌ NONE`
  `response.ok` is true and `body` exists, so the reader runs and finds no
  `data:` lines. The stream ends with no text, zero usage and `stopReason:'end'`
  — **a silent empty answer** rather than an error. A server that ignored
  `stream: true` and returned one JSON object produces exactly this.
- **EC-34 — `[DONE]` before any content.** `❌ NONE` Empty answer, `'end'`.
- **EC-35 — A 429 with `Retry-After`.** `❌ NONE`
  No retry logic at all (unlike the anthropic adapter, which inherits the SDK's).
  → 🐞 BUG-copilot-provider-openai-06.
- **EC-36 — `AbortSignal.any` on a Node without it.** `❌ NONE`
  Node < 20 throws a `TypeError` at `openai-provider.ts:127`, which
  `isAbortError` classifies as not-an-abort and re-throws — an obscure failure.
  The repo targets Node 22 (per `sse-stream.ts:88`), so this is theoretical.

### Idempotency & replay

- **EC-37 — The same request twice.** Non-deterministic by nature.
- **EC-38 — `models` mutated after construction.** `❌ NONE`
  Snapshotted with `[...config.models]` (`openai-provider.ts:116`). Safe.
- **EC-39 — `config.capabilities` mutated after construction.** `❌ NONE`
  **Not** snapshotted — `resolveCapabilities(config, model)` reads
  `config.capabilities` at call time (`config.ts:57-66`), so a mutation *does*
  take effect. Inconsistent with `models`, harmless today.

---

### 4A. Accessibility & Section 508 Conformance

**This unit renders no UI.** It is a server-side HTTP client with no DOM, no
focus, no colour. The block is short by design; everything not listed is **Not
Applicable**.

**Standards tested against:** Revised Section 508 (36 CFR Part 1194,
Appendices A–C), incorporating WCAG 2.0 A+AA by reference (E205.4, 504.2).
Verdicts cite WCAG **2.1** AA SC numbers alongside the 508 provision.

**What genuinely applies:**

- ♿ **A11Y-copilot-provider-openai-01 — Stream events carry the structure a
  client needs to announce progress.** WCAG **4.1.3 Status Messages (AA)** ·
  508 **502.3** · Verdict: **Supports**
  `src/lib/openai-provider.ts:145-169` normalises three wire shapes into the
  port's three event kinds, keeping `text-delta` separate from `tool-call` and
  from the single terminal `done`. A client can therefore route token noise away
  from an announcement channel. The accumulator guarantees a tool call reaches
  the consumer **whole** (`wire/tool-call-accumulator.ts:469-486`), so an
  announcement like "Searching content" is never made against half a call.
  Note the ordering property recorded in §3 F5–F10: tool calls arrive only at
  end-of-stream, so a client announcing steps chronologically will place them
  after all the prose of that turn — the same divergence filed against the
  anthropic adapter (🐞 BUG-copilot-provider-anthropic-05).

- ♿ **A11Y-copilot-provider-openai-02 — Error text reaching a person is an
  internal URL plus an upstream payload, not a sentence.** WCAG **3.3.1 Error
  Identification (A)** and **3.3.3 Error Suggestion (AA)** · 508 **E205.4** ·
  Verdict: **Does Not Support**
  `openai-provider.ts:184-193` builds
  `Copilot model request to <endpoint> failed: <status> <statusText> — <500 chars of body>`
  and `:175-179` builds
  `Copilot model request to <endpoint> timed out after <n>ms.` Both are thrown
  as bare `Error`s, forwarded verbatim by `userFacingMessage`
  (`packages/copilot/server/src/lib/chat/application/run-engine.service.ts:1149-1154`),
  and rendered in the transcript inside a `role="destructive"` Alert that a
  screen reader announces
  (`packages/copilot/admin/src/lib/presentation/MessageList/index.tsx:264-272`).
  So the text a blind user hears when a run fails is
  `Copilot model request to http://internal-llm.corp.local/v1/chat/completions failed: 401 Unauthorized — {"error":{"message":"Incorrect API key provided: sk-…`
  — an infrastructure string with no action a user can take. §3.3.3 asks for a
  suggestion; this offers none, and the noise actively obscures that there is
  nothing the user can do.
  Repro: §3 F19–F22 steps 2–4.
  Keyboard-only experience: unaffected (the Alert is not interactive).
  Screen-reader experience: a long, punctuation-dense URL and JSON blob read
  character-class by character-class.
  Remediation: classify at the adapter into user sentences ("Ortha AI could not
  reach the model service — ask an administrator to check its configuration")
  and log the detail server-side. Cross-references
  🐞 BUG-copilot-provider-openai-01 and 🐞 BUG-copilot-server-03. Do NOT
  implement.

- ♿ **A11Y-copilot-provider-openai-03 — 504 Authoring Tool.** 508 **504.2** ·
  Verdict: **Not Applicable**
  This adapter transports a prompt and returns tokens; it neither writes content
  nor decides what is written. The §504 question lives at `copilot/server`'s
  propose/apply path — see ♿ A11Y-copilot-server-02.

- ♿ **A11Y-copilot-provider-openai-04 — 2.2.1 Timing Adjustable.** WCAG
  **2.2.1 (A)** · 508 **E205.4** · Verdict: **Not Applicable (this unit)**
  `DEFAULT_TIMEOUT_MS` (120 000) bounds a *network* request, not a human
  interaction; nobody is racing it. The genuine 2.2.1 exposure is the permission
  prompt's five-minute expiry — see ♿ A11Y-copilot-server-01 and
  ♿ A11Y-copilot-admin-04.

**Not Applicable:** 1.1.1, 1.3.1, 1.3.2, 1.3.5, 1.4.1, 1.4.3, 1.4.4, 1.4.10,
1.4.11, 1.4.12, 1.4.13, 2.1.1, 2.1.2, 2.4.1, 2.4.2, 2.4.3, 2.4.6, 2.4.7, 3.1.1,
3.1.2, 3.2.1, 3.2.2, 3.3.2, 3.3.4, 4.1.2 — no user interface.

**Note on the axe suite:** `apps/admin-e2e/src/copilot/a11y.spec.ts` scans the
Agents view against a mocked `/api`. It never reaches this adapter, and a static
axe scan could not evaluate streaming behaviour if it did.

---

## 5. E2E Coverage Map

Two unit specs (`src/lib/openai-provider.spec.ts`, 17 cases, `fetch` mocked; and
`src/lib/wire/tool-call-accumulator.spec.ts`, 6 cases). **No e2e in this repo
exercises this adapter** — the server e2e runs on `fake`.

| Feature | Spec | Asserts | Verdict |
| --- | --- | --- | --- |
| F1 endpoint | `openai-provider.spec.ts:51` | No doubled slash | ✅ |
| F5 deltas | `:61` | Forwarded in order | ✅ |
| F6 assembly | `:83`, `tool-call-accumulator.spec.ts:9` | Fragments joined, emitted once | ✅ |
| F7 parallel | `:135`, `tool-call-accumulator.spec.ts:26` | Interleaved, index order | ✅ — the reason this file has its own spec, and it earns it |
| F8 malformed JSON | `:177`, `tool-call-accumulator.spec.ts:79` | `{}` rather than a crash | ✅ |
| F9 missing id | `tool-call-accumulator.spec.ts:52` | `call-<index>` | ✅ |
| F10 missing name | `tool-call-accumulator.spec.ts:64` | Dropped | ✅ — the "dropping beats inventing" decision, pinned |
| F11 usage | `:212` | Read from the trailing chunk | ✅ |
| F12 usage absent | — | — | ⚠️ PARTIAL |
| F13 cached tokens | — | — | ❌ NONE |
| F14 stop reasons | `:240` | `length`→max_tokens, `content_filter`→refusal | ⚠️ PARTIAL — `tool_calls`, `function_call` and the `default` branch untested |
| F15 tool results | `:256` | Flattened onto `role:'tool'` messages | ✅ — the hardest mapping here, and covered |
| F16 tools shape | `:306` | Function-calling shape; key omitted when none | ✅ |
| F17 system | `:256` | First message | ✅ |
| F18 headers | — | — | ❌ NONE — including the override precedence, which is a documented decision |
| F19 timeout wiring | — | — | ❌ NONE |
| F20 abort | `:347` | Ends with `aborted` | ✅ |
| F21 timeout error | — | — | ❌ NONE — the message naming the endpoint is untested |
| F22 request error | `:337` | Names the endpoint and status | ⚠️ PARTIAL — nothing asserts the **body echo**, which is the security-relevant half |
| F23/F24 capabilities | `:369`, `:411` | Declaration over defaults; per model | ✅ |
| F2/F3/F4 models | `:386`, `:394`, `:402` | Order, override, rejection "before sending anything" | ✅ — `:402`'s name explicitly claims the no-request property |
| F25 SSE tolerance | — | — | ⚠️ PARTIAL — the happy path is exercised by every other case; `\r\n`, comments and a missing `[DONE]` are not |
| F26 non-JSON chunk | — | — | ❌ NONE |
| F27 reader release | — | — | ❌ NONE |
| F28 `max_tokens` | — | — | ❌ NONE |
| F29 multi-line `data:` | — | — | ❌ NONE |
| F30 unbounded buffer | — | — | ❌ NONE |
| **Any e2e at all** | — | — | ❌ NONE |

**Coverage tally: 30 features · 15 ✅ · 5 ⚠️ · 10 ❌**

**A11y coverage, marked separately:** `❌ NONE`, correctly — nothing renders.
♿ A11Y-copilot-provider-openai-02 is uncovered by any suite; the copilot axe
suite does not reach this package and, being a static snapshot, cannot assess
streaming or error-announcement behaviour.

---

## 6. 🐞 Potential Bugs

### 🐞 BUG-copilot-provider-openai-01 — The internal endpoint URL and up to 500 characters of the upstream response body are sent to the browser as a user-facing error · Severity: Medium · 🔒 SECURITY

**Location:** `packages/copilot/provider-openai/src/lib/openai-provider.ts:175-193`,
surfacing through `packages/copilot/server/src/lib/chat/application/run-engine.service.ts:1149-1154`
**Category:** information-disclosure

**What the code does:**

```typescript
if (timeout.aborted) {
    throw new Error(`Copilot model request to ${endpoint} timed out after ${timeoutMs}ms.`);
}
…
async function requestError(response: Response): Promise<Error> {
    const detail = response.body ? await response.text().catch(() => '') : '';
    return new Error(
        `Copilot model request to ${endpoint} failed: ${response.status} ${response.statusText}` +
            (detail ? ` — ${detail.slice(0, 500)}` : ''));
}
```

Both are bare `Error`s. `RunEngine.run`'s catch does
`yield { type: 'error', message: userFacingMessage(error) }`, and
`userFacingMessage` returns `error.message` for any `Error`
(`run-engine.service.ts:1149-1154`). The frame is rendered verbatim in the
transcript's destructive Alert
(`packages/copilot/admin/src/lib/presentation/MessageList/index.tsx:264-272`).

**Why it is wrong:** `RunErrorEvent`'s contract is explicit — "Carries a message
safe to show a user — **never a stack, a provider payload, or anything naming
internal wiring**" (`packages/copilot/domain/src/lib/run/run-event.ts:169-172`).
`endpoint` is internal wiring by definition: for a self-hosted deployment it is
`http://ollama.internal:11434/v1/chat/completions` or an internal LiteLLM
gateway, and `detail` is a **provider payload** — the two things the contract
names. The 500-character slice is a deliberate bound on *length*, not on
*content*. Note how carefully the same problem is handled one layer away:
`toToolError` reduces a non-`HttpException` to an opaque 500 precisely because
"the message could name a table, a column, or a connection string"
(`packages/tools/server/src/lib/tool-error.ts:37-40`), and there is a unit test
asserting `ECONNREFUSED` cannot leak (`tool-error.spec.ts:410`). The model-error
path has neither the guard nor the test.

**Repro:**
1. `COPILOT_ENABLED=true COPILOT_PROVIDER=ollama COPILOT_OPENAI_BASE_URL=http://internal-llm.corp.local/v1 COPILOT_OPENAI_API_KEY=wrong npm run dev`
2. Sign in as **any** role (every role holds `copilot:use`), press ⌘J, send "hi".
→ **Observed:** the transcript shows
`Copilot model request to http://internal-llm.corp.local/v1/chat/completions failed: 401 Unauthorized — {"error":{"message":"Incorrect API key provided: sk-ab****...","type":"invalid_request_error",…}}`
/ **Expected:** a classified sentence, with the detail in the server log only.
3. Repeat with a stub that returns a 500 HTML page — the page's first 500
   characters, including any internal hostname in it, reach the browser.

**Blast radius:** every user with `copilot:use` — i.e. every role, including
`viewer` — learns the internal inference host, its port and path, and whatever
the upstream chose to say. On a shared or partially-trusted deployment that is
network reconnaissance handed over by a failing feature. The upstream body may
also carry a partially-masked credential, an org id, or a rate-limit identifier.

**Suggested fix:** classify in the adapter — throw a typed error carrying a user
sentence and log the endpoint and body server-side — and, defensively, make
`userFacingMessage` allow-list known error types rather than trusting
`error.message`. Do NOT implement.

---

### 🐞 BUG-copilot-provider-openai-02 — An operator-supplied `baseUrl` is fetched server-side with no restriction, and the response body is echoed to the caller · Severity: Medium · 🔒 SECURITY

**Location:** `packages/copilot/provider-openai/src/lib/config.ts:52-54` and
`src/lib/openai-provider.ts:114`, `:130-135`, `:184-193`
**Category:** SSRF (operator-scoped)

**What the code does:**

```typescript
export function resolveEndpoint(baseUrl: string): string {
    return `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
}
…
const response = await fetch(endpoint, { method: 'POST', headers: toRequestHeaders(config), body: …, signal: combined });
if (!response.ok || !response.body) { throw await requestError(response); }
```

No scheme check, no host allow-list, no private-range guard. `config.headers`
is forwarded verbatim. And per BUG-01, up to 500 characters of whatever
answers are returned to the caller.

**Why it is wrong — and the honest framing:** `baseUrl` comes only from
`COPILOT_OPENAI_BASE_URL` (`apps/server/ortha.config.ts:236-238`) and is never
in `CreateRunDto`, so a **user** cannot point it anywhere (EC-28). This is
therefore not a user-reachable SSRF, and the `baseUrl` being free-form is the
entire feature — ADR-0004 §3 exists so that "one adapter makes a local,
air-gapped install a configuration choice rather than a fork". What makes it
worth filing is the **combination**: a mis-set or maliciously-set env var turns
the copilot into a *read oracle* for anything the server can reach, because the
response body comes back to any `copilot:use` holder as an error message. Point
it at `http://169.254.169.254/latest/meta-data/` and the 404 body is echoed;
point it at an internal admin API and its error text is echoed. Without BUG-01
this would be a configuration footgun; with BUG-01 it is a configuration footgun
with an exfiltration channel. Note the adapter also cannot distinguish "this is
not an LLM endpoint" — a 200 that is not `text/event-stream` produces a silent
empty answer (EC-33), so probing is quiet.

**Repro:**
1. `COPILOT_OPENAI_BASE_URL=http://169.254.169.254/latest/meta-data COPILOT_PROVIDER=ollama COPILOT_ENABLED=true npm run dev`
2. Send any message as any role.
→ **Observed:** the request is made from the server, and the response status and
first 500 characters of the body are rendered in the caller's transcript.
/ **Expected:** at minimum, the body not echoed (BUG-01); ideally an explicit
statement in the config docs that this value is trusted.

**Blast radius:** requires an operator to set the variable, so the threat model
is a compromised or careless deploy configuration, or a multi-tenant control
plane that lets a less-trusted party set env vars. Medium rather than High for
that reason.

**Suggested fix:** fix BUG-01 first — it removes the exfiltration channel and
downgrades this to an ordinary trusted-configuration value. Optionally add a
startup log line naming the resolved endpoint so a wrong value is visible at
boot rather than at first failure. Do NOT implement.

---

### 🐞 BUG-copilot-provider-openai-03 — Unverified — `max_tokens` is sent where current OpenAI models require `max_completion_tokens` · Severity: Medium

**Location:** `packages/copilot/provider-openai/src/lib/wire/request.ts:343-360`

**Unverified —** I cannot exercise `api.openai.com` from this repository, and
nothing here records which OpenAI models the adapter is expected to work
against. The field name in the code is unambiguous; whether the target endpoint
rejects it is a property of that endpoint.

**What the code does:**

```typescript
export function toRequestBody(request, config, model): Record<string, unknown> {
    const tools = request.tools ?? [];
    return { model, messages: toChatMessages(request.messages, request.system),
        ...(tools.length > 0 ? { tools: toChatTools(tools) } : {}),
        max_tokens: request.maxOutputTokens, stream: true,
        stream_options: { include_usage: true } };
}
```

`max_tokens` unconditionally, for every endpoint.

**Why it might be wrong:** OpenAI deprecated `max_tokens` in favour of
`max_completion_tokens` for its newer model families, and some of them reject
the old field with a 400 rather than ignoring it. The adapter's stated selling
point is that "Ollama, vLLM, llama.cpp, LM Studio, LiteLLM, OpenRouter, Azure
and OpenAI itself all speak" this format (AGENTS.md) — and the *one* member of
that list that has diverged is the one the format is named after. The local
runtimes accept `max_tokens`, so this fails only against the endpoint an
operator is least likely to be testing during development.

**Repro:**
1. `COPILOT_OPENAI_BASE_URL=https://api.openai.com/v1 COPILOT_OPENAI_MODELS=<a current model> COPILOT_OPENAI_API_KEY=sk-… COPILOT_PROVIDER=ollama npm run dev`
2. Send any message.
→ **Observe:** whether the run returns an answer or an `error` frame reading
`… failed: 400 Bad Request — {"error":{"message":"Unsupported parameter: 'max_tokens'…`
If it is the latter, this is a real Medium bug; if the endpoint still accepts
`max_tokens`, it is a latent one.

**Blast radius:** every run against the affected models — a total failure of the
feature, with an error message that (per BUG-01) at least names the field.

**Suggested fix:** send whichever field the endpoint expects. Since the adapter
has no discovery, the honest options are a config flag
(`tokenLimitField?: 'max_tokens' | 'max_completion_tokens'`) or sending
`max_completion_tokens` and falling back on a 400 naming the parameter. Do NOT
implement.

---

### 🐞 BUG-copilot-provider-openai-04 — The SSE reader ignores event boundaries, so a legal multi-line `data:` event is silently dropped · Severity: Medium

**Location:** `packages/copilot/provider-openai/src/lib/sse.ts:234-254`
**Category:** correctness

**What the code does:**

```typescript
// Events are separated by a blank line, but every server we target
// emits exactly one `data:` line per event, so splitting on
// newlines and ignoring everything else is both simpler and more
// forgiving of `\r\n` and stray comment/keep-alive lines.
let newline = buffer.indexOf('\n');
while (newline !== -1) {
    const line = buffer.slice(0, newline).trim();
    …
    if (!line.startsWith('data:')) continue;
    const payload = line.slice('data:'.length).trim();
    if (payload === '[DONE]') return;
    if (payload) yield payload;
}
```

Each `data:` **line** is treated as a complete event payload.

**Why it is wrong:** the SSE specification allows an event to carry several
`data:` lines, which the consumer joins with `\n` before parsing. The comment
acknowledges the shortcut and justifies it with "every server we target emits
exactly one `data:` line per event" — an empirical claim about a set of servers
(Ollama, vLLM, llama.cpp, LM Studio, LiteLLM, OpenRouter, Azure, OpenAI) that
this adapter exists precisely to *not* hard-code assumptions about. When it does
not hold, each line fails `JSON.parse` in `parseChunk`
(`openai-provider.ts:206-213`), which returns `undefined`, and the loop
`continue`s — so the chunk is **silently dropped**. A stream of such events
produces an empty answer with `stopReason: 'end'` and no error anywhere: the
worst available failure shape, because it is indistinguishable from a model that
said nothing.

**Repro:**
1. Stub server emitting a legal multi-line event:
   ```
   data: {"choices":[{"delta":
   data: {"content":"hello"}}]}
   \n
   ```
2. `COPILOT_OPENAI_BASE_URL=http://localhost:8099/v1 COPILOT_PROVIDER=ollama` and send a message.
→ **Observed:** two `parseChunk` failures, both swallowed; the run ends with an
empty answer and `stopReason:'end'`. / **Expected:** the two lines joined with
`\n`, parsed as one chunk, and `hello` streamed.

**Blast radius:** any endpoint that formats events this way — most likely an
intermediary (a gateway that re-frames), which is exactly the LiteLLM/proxy case
the adapter is sold on. The silence is what makes it Medium rather than Low: a
`parseChunk` failure telling nobody is a defensible choice for a stray keep-alive
and a bad one for a whole event.

**Suggested fix:** buffer on the blank-line boundary (`\n\n`, tolerating
`\r\n\r\n`) and join an event's `data:` lines with `\n` before parsing — the
same shape the admin's own `streamRun` already uses
(`packages/copilot/admin/src/lib/application/runStream.ts:113-122` splits on
`\n\n`). At minimum, log at debug when `parseChunk` fails. Do NOT implement.

---

### 🐞 BUG-copilot-provider-openai-05 — The SSE buffer is unbounded, so a server that streams without newlines grows it for the whole timeout window · Severity: Low

**Location:** `packages/copilot/provider-openai/src/lib/sse.ts:226-256`
**Category:** perf / availability

**What the code does:**

```typescript
let buffer = '';
for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let newline = buffer.indexOf('\n');
    while (newline !== -1) { … }
}
```

`buffer` is only ever drained when a `\n` is found. No cap.

**Why it is wrong:** an endpoint that streams a large body with no newline —
a misconfigured proxy, a server that ignored `stream: true` and is writing one
huge JSON document, a hostile endpoint — accumulates the whole body in a JS
string for up to `timeoutMs` (120 s by default). The `data:` payload cap in
EC-17 is the same shape one level down. Every other bounded thing in this
codebase is bounded deliberately (`MAX_MESSAGE_LENGTH`,
`MAX_RUN_ATTACHMENTS`, `MAX_SKILL_INSTRUCTIONS_LENGTH`, `maxTotalTokens`); this
one is not, and it sits on the network edge.

**Repro:**
1. Stub server: `res.writeHead(200,{'content-type':'text/event-stream'}); setInterval(()=>res.write('x'.repeat(1<<20)), 10);`
2. Send a message; watch RSS.
→ **Observed:** heap grows ~100 MB/s until the 120 s timeout aborts the fetch.
/ **Expected:** the reader gives up once the buffer exceeds a sane cap, with an
error naming the endpoint.

**Blast radius:** one run's memory, bounded by the timeout, and recoverable.
Low. Note it is reachable only from the operator-configured endpoint, so it
shares BUG-02's threat model.

**Suggested fix:** cap `buffer.length` and throw a named error when it is
exceeded. Do NOT implement.

---

### 🐞 BUG-copilot-provider-openai-06 — No retry on a transient failure, diverging from the anthropic adapter · Severity: Low

**Location:** `packages/copilot/provider-openai/src/lib/openai-provider.ts:129-181`
**Category:** correctness (cross-adapter divergence)

**What the code does:** one `fetch`, no retry, no backoff. A 429, a 502 from a
proxy, or a connection reset ends the run.

**Why it is wrong:** the sibling adapter retries — `AnthropicProviderConfig`
exposes `maxRetries` ("Retries on 429/5xx/connection errors. Defaults to the
SDK's 2" — `packages/copilot/provider-anthropic/src/lib/config.ts:24-25`), and
the SDK does the work. So the same transient upstream failure ends the run on
one provider and is absorbed on the other, with nothing in either package
documenting the difference. `OpenAiProviderConfig` has no `maxRetries` field at
all (`src/lib/config.ts:6-38`). For the local-runtime case this is arguably
right — a local Ollama that 500s will 500 again — but the adapter's whole point
is that it also fronts OpenRouter, Azure and OpenAI, where 429s are routine.

**Repro:**
1. Stub returning `429` on the first request and `200` on the second.
2. Send a message.
→ **Observed:** an `error` frame after one attempt. Against `claude` with the
same stub behaviour: an answer. / **Expected:** one documented policy.

**Blast radius:** avoidable run failures against rate-limited hosted endpoints.
Low; the user can retry.

**Suggested fix:** either add `maxRetries` with backoff on 429/5xx/connection,
or state in AGENTS.md that this adapter deliberately does not retry and why.
Do NOT implement.

---

### 🐞 BUG-copilot-provider-openai-07 — AGENTS.md documents an export and a config shape the package does not have · Severity: Low

**Location:** `packages/copilot/provider-openai/AGENTS.md` § "What it exports"
vs `src/index.ts:1-2` and `src/lib/config.ts:6-38`
**Category:** correctness (documentation)

**What the docs say:**

> - `createOpenAiCompatibleProvider(config): ModelProvider`. `config` is
>   `{ baseUrl, model, apiKey?, headers?, capabilities?, timeoutMs? }`.

**What the code has:** `createOpenAiProvider`, and `models: readonly string[]`
(plural), not `model`. The example inside the source is stale in the same way —
`openai-provider.ts:104-108` shows `model: 'llama3.1'` in a `@example` block
whose type would not compile.

**Why it is wrong:** AGENTS.md is the canonical context file for agents and the
first thing a human reads before wiring a second endpoint. Both errors are the
kind that fail at typecheck rather than at runtime, so the cost is a wasted
edit-compile cycle — but the *plural* change is load-bearing (it is what lets one
endpoint serve several models and a user switch mid-conversation), and a doc
that still says `model` describes the pre-multi-model design. The package's own
"Why not just `copilot-provider-openai-compatible`" section explains a rename
that the export list did not follow.

**Repro:** `grep -n "createOpenAiCompatibleProvider" packages/copilot/provider-openai/AGENTS.md src/index.ts`
→ present in the doc, absent from the code.

**Blast radius:** an operator adding a second backend. Low.

**Suggested fix:** update AGENTS.md's export name and config shape, and the
`@example` at `openai-provider.ts:104-108`. Do NOT implement.

---

### 🐞 BUG-copilot-provider-openai-08 — Unverified — an assistant message carrying `tool_calls` is sent with `content: ""`, which some endpoints reject · Severity: Low

**Location:** `packages/copilot/provider-openai/src/lib/wire/request.ts:318-323`

**Unverified —** I cannot exercise the various endpoints, and nothing in the
repo records which of them accept an empty-string `content` alongside
`tool_calls`.

**What the code does:**

```typescript
if (text.length > 0 || toolCalls.length > 0) {
    chat.push({ role: message.role, content: text.join('\n'),
        ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}) });
}
```

When a turn was tool-calls-only, `text` is empty and `content` is `''`. The
`ChatMessage` type declares `content: string` as required
(`wire/types.ts:490-499`), so `null` cannot be expressed.

**Why it might be wrong:** the OpenAI schema types an assistant message's
`content` as nullable, and a tool-calls-only turn conventionally carries
`content: null`. Some strict implementations (and some validating gateways)
reject `""` where they accept `null`. This only bites on the **second** request
of a tool-using turn, which is the shape this feature is mostly made of.

**Repro:**
1. Point at each target endpoint in turn (Ollama, vLLM, LiteLLM, Azure, OpenAI).
2. Ask something requiring a tool round trip.
→ **Observe:** whether request #2 is accepted. Any 400 mentioning `content`
confirms it.

**Blast radius:** if confirmed for any target, every tool-using run against that
endpoint fails on the second turn.

**Suggested fix:** widen `ChatMessage['content']` to `string | null` and emit
`null` when a turn is tool-calls-only. Do NOT implement.

---

### Checked and cleared

- **Does this package import a vendor SDK?** No. `package.json` declares only
  `@ortha-cms/copilot-domain`, a type-only dependency. ADR-0004 §1 holds in the
  strongest form.
- **Can a *caller* influence `baseUrl`, `headers` or `apiKey`?** No. None is on
  `CreateRunDto` (`packages/copilot/server/src/lib/chat/application/dto/create-run.dto.ts:135-231`);
  all three are operator config. That is what keeps BUG-02 operator-scoped.
- **Is the abort path correct?** Yes — `isAbortError(error, signal)` checks the
  caller's signal first, so a caller abort wins over a timeout that fired in the
  same tick, and a timeout is distinguished by `timeout.aborted`
  (`openai-provider.ts:170-179`). Pinned at `:347`.
- **Does a cancelled call invent usage?** No — `abortedEvent()` reports zero,
  matching the port and the anthropic adapter. (The **fake** does not — see
  `docs/testing/copilot-domain.md` 🐞 BUG-copilot-domain-06.)
- **Is a tool call ever emitted as fragments?** No —
  `toolCalls.drain()` runs only after the read loop ends
  (`openai-provider.ts:166-168`), and the accumulator is per-stream (`:141`).
  Six unit cases pin it.
- **Does malformed argument JSON kill the run?** No — `parseArgs` returns `{}`
  (`tool-call-accumulator.ts:435-444`), the engine's `validateToolInput` then
  fails it as a recoverable tool error. A deliberate, tested chain.
- **Is a multi-byte character split across chunks handled?**
  Yes — `decoder.decode(value, { stream: true })` (`sse.ts:232`).
- **Is the reader lock released on abort?** Yes — the `finally` at
  `sse.ts:264-268`, with the reason in a comment.
- **Does `models()` return a live reference to the host's array?** No —
  `[...config.models]` (`openai-provider.ts:116`). (`config.capabilities` **is**
  read live — EC-39, harmless.)
- **Is `resolveModel` called before any network I/O?** Yes
  (`openai-provider.ts:122-125`), and `:402`'s test name asserts it.

---

## 7. Recommended E2E Tests

Harness: **unit** = `npx nx test @ortha-cms/copilot-provider-openai` (`fetch`
mocked); **server-e2e** = `apps/server-e2e` testcontainer + supertest with a
local HTTP stub standing in for the endpoint.

| Priority | Harness | Proposed spec | Asserts | Closes |
| --- | --- | --- | --- | --- |
| 1 | unit | `openai-provider.spec.ts` — new `describe('errors do not leak infrastructure')` | The error thrown for a 401, a 500 HTML page and a timeout contains **no** `baseUrl` and **no** upstream body; today all three **fail**, which is the point | 🐞 BUG-copilot-provider-openai-01, ♿ A11Y-copilot-provider-openai-02, F21/F22 ❌ |
| 2 | unit | `openai-provider.spec.ts` — new `describe('SSE framing')` | A legal multi-line `data:` event is parsed as one chunk; `\r\n` framing works; a `: comment` is skipped; a stream ending without `[DONE]` still flushes the tail; a non-JSON `data:` line is skipped without killing the stream | 🐞 BUG-copilot-provider-openai-04, F25 ⚠️, F26 ❌ |
| 3 | unit | `openai-provider.spec.ts` — new case | A response body of 5 MB with no newline aborts with a named error rather than buffering to the timeout | 🐞 BUG-copilot-provider-openai-05, F30 ❌ |
| 4 | server-e2e | new `apps/server-e2e/src/server/copilot/copilot-openai-wire.spec.ts` | A full run against a local stub through the **real** adapter: frame order, tool round trip, the second request's message shape (assistant `tool_calls` + one `role:'tool'` message per result), the persisted `model`/`provider` columns, and a partial answer surviving a mid-stream disconnect | "Any e2e at all" ❌, F15 depth, EC-32 |
| 5 | unit | `openai-provider.spec.ts` — new `describe('request body')` | `max_tokens` is present and equals `maxOutputTokens`; then, once the field question is settled, that the configured field name is used | 🐞 BUG-copilot-provider-openai-03, F28 ❌ |
| 6 | unit | `openai-provider.spec.ts` — new `describe('headers')` | `content-type` always; `authorization` only with an `apiKey`; `config.headers` **overrides** both — pinning the documented precedence | F18 ❌ |
| 7 | unit | `openai-provider.spec.ts` — extend `describe` around `:240` | A table over `finish_reason`: `tool_calls`, `function_call`, `length`, `content_filter`, `stop`, `null` and an unknown string each map to the documented port value | F14 ⚠️ |
| 8 | unit | shared contract kit (see `docs/testing/copilot-domain.md` §7 item 3) | The port contract, run identically in all three adapters: abort ends rather than throws, zero usage, exactly one `done`, tool calls whole and parsed | 🐞 BUG-copilot-domain-06 |
| 9 | unit | `openai-provider.spec.ts` — new case | A server that never sends a usage chunk reports zeros — and the case is named so the consequence (the token ceiling cannot trip) is on record | F12 ⚠️ |
| 10 | unit | `openai-provider.spec.ts` — new case | A 200 response that is **not** an event stream produces an explicit failure rather than a silent empty answer | EC-33 |
| 11 | unit | `openai-provider.spec.ts` — new case | `cachedInputTokens` is read from `prompt_tokens_details.cached_tokens` and omitted when absent — the same negative-shape assertion the anthropic spec has at `:148` | F13 ❌ |
| 12 | unit | `openai-provider.spec.ts` — new case | `timeoutMs: 0` behaves sensibly (or is rejected), rather than aborting every request | EC-08 |
| 13 | doc | `packages/copilot/provider-openai/AGENTS.md` + `openai-provider.ts:104-108` | The export name and the plural `models` shape match the code | 🐞 BUG-copilot-provider-openai-07 |
