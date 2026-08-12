# @ortha-cms/copilot-provider-anthropic — Test Artifact

> **Unit:** `packages/copilot/provider-anthropic` · **Package:** `@ortha-cms/copilot-provider-anthropic` · **Kind:** adapter (`ModelProvider` implementation)
> **Source of truth:** `packages/copilot/provider-anthropic/AGENTS.md`
> **Findings verified:** 2026-08-11 — 2 confirmed · 0 deleted · 7 corrected · 1 unverified
> **Generated:** 2026-08-11

## 1. Scope & Preconditions

**Owns** the native Claude adapter: the factory (`src/lib/anthropic-provider.ts`),
the memoized lazy SDK client (`src/lib/client.ts`), the Models-API capability
probe and its fallback (`src/lib/capabilities.ts`), the config type and
`FALLBACK_CAPABILITIES` (`src/lib/config.ts`), and the two pure wire mappings
(`src/lib/wire/request.ts`, `src/lib/wire/response.ts`).

**This is the only package in the repo allowed to import a model vendor's SDK**
(ADR-0004 §1). Verified: `@anthropic-ai/sdk` appears in
`packages/copilot/provider-anthropic/package.json` and in exactly four source
files here — and **nowhere else in the monorepo**.

**Does NOT own:**

- **The port.** `ModelProvider`, `ModelRequest`, `ModelStreamEvent`,
  `resolveModel`, `isAbortError`, `abortedEvent` all come from
  `@ortha-cms/copilot-domain`.
- **Registration.** The composition root constructs it
  (`apps/server/src/plugins.ts:114-120`) and `CopilotPlugin` never learns which
  adapters exist.
- **Its own configuration values.** `apiKey`, `models`, `baseUrl` come from
  `apps/server/ortha.config.ts:216-232`, sourced from `ANTHROPIC_API_KEY`,
  `COPILOT_ANTHROPIC_MODELS` and `ANTHROPIC_BASE_URL`.
- **Retry policy** — delegated to the SDK's `maxRetries` (default 2).
- **The run loop, tools, authorization, persistence** — all `copilot/server`.

### Entry points (exported API — `src/index.ts:1-2`)

| Export | Kind | Notes |
| --- | --- | --- |
| `createAnthropicProvider(config): ModelProvider` | factory | Returns `{ models, capabilities, stream }` |
| `AnthropicProviderConfig` | type | `{ apiKey, models, baseUrl?, effort?, maxRetries?, timeoutMs? }` |
| `AnthropicEffort` | type | `'low' \| 'medium' \| 'high' \| 'xhigh' \| 'max'` |

Not exported (internal): `createLazyClient`, `probeCapabilities`,
`FALLBACK_CAPABILITIES`, `toStreamParams`, `toAnthropicTools`,
`toAnthropicMessages`, `toStopReason`, `toUsage`. The `wire/` functions are
"exercised through the provider spec rather than directly — they have no
behaviour a caller can reach on its own" (AGENTS.md).

**No routes, no DI providers, no tables, no slots.**

### Runtime prerequisites

| Requirement | Where | Notes |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | `ortha.config.ts:217` | **Only needed if this provider is selected.** The client is lazy (`client.ts:16-40`), so an operator running local inference boots fine with none |
| `COPILOT_ENABLED=true` | `ortha.config.ts:194` | The engine's kill switch |
| `COPILOT_PROVIDER=claude` | `ortha.config.ts:198` | **Otherwise the default is `fake`** — see `docs/testing/copilot-provider-fake.md` 🐞 BUG-copilot-provider-fake-01 |
| A non-empty `models` list | `ortha.config.ts:222-228` | `CopilotPlugin` fails boot on an empty one (`copilot-plugin.ts:61-67`) |
| Network egress to `api.anthropic.com` (or `ANTHROPIC_BASE_URL`) | — | Absent, streaming throws and the probe falls back |
| A user holding `copilot:use`, and a workspace | identity / workspaces | To reach it through the run route at all |

### How to exercise it manually

```bash
docker compose up -d
npx nx run server:db:migrate
COPILOT_ENABLED=true \
COPILOT_PROVIDER=claude \
ANTHROPIC_API_KEY=sk-ant-… \
npm run dev
```

Then open `http://localhost:4200`, sign in, open a workspace, press **⌘J**, and
send a message. Or bypass the UI:

```bash
# after signing in and capturing the session cookie into cookies.txt
curl -N -X POST http://localhost:3000/api/copilot/runs \
  -b cookies.txt -H "X-Workspace-Id: $WS" -H 'content-type: application/json' \
  -H 'Origin: http://localhost:4200' \
  -d '{"message":"how many articles are drafts?","provider":"claude","model":"claude-opus-5"}'
```

Point it at a gateway instead of the public API:

```bash
ANTHROPIC_BASE_URL=https://my-gateway.internal/v1 COPILOT_PROVIDER=claude npm run dev
```

Automated:

```bash
npx nx test @ortha-cms/copilot-provider-anthropic   # 🧪 anthropic-provider.spec.ts (mocked SDK)
npx nx typecheck @ortha-cms/copilot-provider-anthropic
npx nx lint @ortha-cms/copilot-provider-anthropic
```

Note: `AGENTS.md`'s Commands section lists only `typecheck` and `lint`, but
`jest.config.js` and a 470-line spec exist and `nx test` runs. Doc drift.

### Dependencies that must be healthy

- `@anthropic-ai/sdk` `^0.115.0` — the streaming helper
  (`client.messages.stream`), `finalMessage()`, and `models.retrieve`.
- `@ortha-cms/copilot-domain` — the port, `resolveModel`, `isAbortError`,
  `abortedEvent`.
- The Anthropic API, or whatever `baseUrl` points at, for **both** `/v1/messages`
  and `/v1/models` — a gateway that proxies only the first degrades capabilities
  to the fallback silently.

---

## 2. Feature Inventory

| # | Feature | Where it lives | Coverage |
| --- | --- | --- | --- |
| F1 | The SDK client is constructed on **first use**, not in the factory | `src/lib/client.ts:16-40` | 🧪 UNIT `src/lib/anthropic-provider.spec.ts:74` |
| F2 | Selecting it with no key fails with a message naming the fix | `client.ts:21-26` | 🧪 UNIT `:83` |
| F3 | The client is constructed **once** and memoized | `client.ts:17-19` | 🧪 UNIT `:94` |
| F4 | `baseUrl` overrides the API host | `client.ts:29` | 🧪 UNIT `:94` |
| F5 | `maxRetries` / `timeoutMs` are forwarded only when set | `client.ts:30-35` | ❌ NONE |
| F6 | `models()` advertises every declared model, in order | `anthropic-provider.ts:100` | 🧪 UNIT `:411` |
| F7 | The **first** declared model is the default | `resolveModel` via `anthropic-provider.ts:50` | 🧪 UNIT `:290` |
| F8 | A per-request `model` override is honoured | same | 🧪 UNIT `:290` · ✅ E2E `apps/server-e2e/src/server/copilot/copilot-chat.spec.ts:677` |
| F9 | A model this provider does not offer raises `UnknownModelError` **before** any network call | `anthropic-provider.ts:48-50` | 🧪 UNIT `:302` · ✅ E2E `copilot-chat.spec.ts:733` |
| F10 | Text deltas are forwarded as they arrive | `anthropic-provider.ts:61-68` | 🧪 UNIT `:115` |
| F11 | Tool calls come from `finalMessage()`, whole and parsed — never from `input_json_delta` | `anthropic-provider.ts:70-83` | 🧪 UNIT `:173` |
| F12 | Exactly one `done` carries the stop reason and usage | `anthropic-provider.ts:85-89` | 🧪 UNIT `:115` |
| F13 | `cachedInputTokens` is omitted when the API reports none | `src/lib/wire/response.ts:23-32` | 🧪 UNIT `:148` |
| F14 | An abort **ends** the stream with `stopReason:'aborted'` and zero usage | `anthropic-provider.ts:90-96` | 🧪 UNIT `:232` |
| F15 | A genuine API failure is re-thrown, not swallowed as an abort | `anthropic-provider.ts:95` | 🧪 UNIT `:257` |
| F16 | **No `thinking` configuration is sent** | `src/lib/wire/request.ts:67-81` | 🧪 UNIT `:273` |
| F17 | **No sampling parameters** (`temperature`, `top_p`, `top_k`) | `wire/request.ts:67-81` | 🧪 UNIT `:282` |
| F18 | `effort` is sent as `output_config.effort`, only when configured | `wire/request.ts:79` | 🧪 UNIT `:315` |
| F19 | `system` is sent only when non-empty | `wire/request.ts:76` | ⚠️ PARTIAL — implied by `:327` |
| F20 | Tools are mapped to `{name, description, input_schema}` | `wire/request.ts:18-24` | 🧪 UNIT `:327` |
| F21 | The `tools` key is omitted entirely when the run offers none | `wire/request.ts:78` | 🧪 UNIT `:403` |
| F22 | Block-structured turns map onto `MessageParam` (text / tool_use / tool_result, with `is_error`) | `wire/request.ts:27-53` | 🧪 UNIT `:327` |
| F23 | Stop-reason mapping: `tool_use`→`tool_use`, `refusal`→`refusal`, `max_tokens` + `model_context_window_exceeded`→`max_tokens`, everything else→`end` | `src/lib/wire/response.ts:5-20` | ⚠️ PARTIAL — `:115` and `:173` cover `end` and `tool_use` only |
| F24 | `capabilities(model?)` probes the Models API | `src/lib/capabilities.ts:16-34` | 🧪 UNIT `:420` |
| F25 | The probe result is cached **per model** | `anthropic-provider.ts:42`, `:217-225` | 🧪 UNIT `:420`, `:442` |
| F26 | A failed probe falls back to `FALLBACK_CAPABILITIES` rather than reporting "unsupported" | `capabilities.ts:31-33` | 🧪 UNIT `:463` |
| F27 | `toolCalling` is always `true` — the Models API exposes no flag | `capabilities.ts:24` | 🧪 UNIT `:420` |
| F28 | **A failed probe is cached forever** | `anthropic-provider.ts:103-108` | ❌ NONE → 🐞 BUG-copilot-provider-anthropic-01 |
| F29 | `capabilities()` is consulted by production code | *nowhere* | ❌ NONE → cross-ref 🐞 BUG-copilot-domain-01 |

---

## 3. Manual Test Plan

**Global preconditions:** `docker compose up -d`;
`npx nx run server:db:migrate`; a real `ANTHROPIC_API_KEY`; a workspace granting
`test_article` with a handful of published and draft entries; a signed-in admin.
Run with `COPILOT_ENABLED=true COPILOT_PROVIDER=claude npm run dev` unless a
block says otherwise. "Watch the wire" means an outbound proxy (mitmproxy) or
`ANTHROPIC_BASE_URL` pointed at a logging reverse proxy.

**Keyboard-only path / screen-reader expectation, all blocks:** this unit has no
UI. Where a step says "open the panel", that surface's keyboard and
screen-reader behaviour is assessed in `docs/testing/copilot-admin.md` §4A; here
the observable is the network request and the persisted run record, both
reachable from a terminal. See §4A below.

### F1–F5 — the lazy client

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Start with **no** `ANTHROPIC_API_KEY` and `COPILOT_PROVIDER=fake` | Boot succeeds with no warning. The adapter is registered and inert |
| 2 | Send a chat message | Answered by `fake`. No Anthropic client was ever constructed |
| 3 | Switch the model picker to a `claude` model and send | An `error` frame: *"The Anthropic copilot provider was selected but no API key is configured. Set ANTHROPIC_API_KEY, or point plugins.copilot.defaultProvider at another provider."* — the message names both fixes |
| 4 | Set the key, restart, send twice | Both turns answer. Only **one** `Anthropic` instance exists (assert in a unit test; the spec at `:94` does) |
| 5 | Set `ANTHROPIC_BASE_URL=http://localhost:8081/v1` and point a logging proxy there | The request lands on the proxy, not on `api.anthropic.com` |
| 6 | Add `maxRetries: 0` to the `claude` config, make the proxy return 529 | The request is attempted **once**. With `maxRetries` unset the SDK retries twice |

### F6–F9 — model resolution

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `GET /api/copilot/models` | `items` contains `{"provider":"claude","model":"claude-opus-5"}`, `{"…","claude-sonnet-5"}`, `{"…","claude-haiku-4-5"}` in that order (`ortha.config.ts:224`) |
| 2 | Send with `{"provider":"claude"}` and no `model` | `GET /conversations/:id` shows the assistant turn with `"model":"claude-opus-5"` — the first |
| 3 | Send with `{"provider":"claude","model":"claude-haiku-4-5"}` | Recorded as `claude-haiku-4-5`; the wire shows `"model":"claude-haiku-4-5"` |
| 4 | Send with `{"provider":"claude","model":"claude-3-opus-20240229"}` | An `error` frame naming the requested model **and** the three available. **No HTTP request is made** — `resolveModel` runs before the `try` (`anthropic-provider.ts:48-50`) |
| 5 | Set `COPILOT_ANTHROPIC_MODELS=claude-sonnet-5` and restart | Only one entry in the catalogue; the picker hides itself (one backend) |

### F10–F15 — streaming

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `curl -N` a run and watch frames arrive | Many `event: text-delta` frames, spread over time — **not** one burst at the end. (AGENTS.md's warning about `yield*` in `streamTurn` is about the engine; this is the adapter half) |
| 2 | Ask something requiring a tool ("how many drafts?") | The frame order is: `run-started`, some `text-delta`s, then `tool-call`, then `tool-result`, then more `text-delta`s, then `done`. Note the adapter emits **all** tool calls after **all** text for a turn (`anthropic-provider.ts:61-83`) |
| 3 | Expand the tool step in the panel | The `input` is a parsed object, never a JSON string and never a fragment |
| 4 | Read the `done` frame's `usage` | `inputTokens` and `outputTokens` both > 0 |
| 5 | Ask a question long enough to hit a prompt cache on a second identical run | The second run's `usage` carries `cachedInputTokens`; the first does not |
| 6 | Press **Stop** mid-answer | The stream ends. The persisted turn has `stopReason:'aborted'` and **zero** usage. No exception in the server log |
| 7 | Kill network egress (`iptables`/proxy down) mid-answer | An `error` frame. The error is **re-thrown**, not converted to an abort — `isAbortError` checks the signal first and the signal is not aborted |
| 8 | Send with an intentionally invalid key | An `error` frame carrying the SDK's message. **Check it does not contain the key** — the SDK's error text is forwarded verbatim by `userFacingMessage` (see 🐞 BUG-copilot-provider-anthropic-04) |

### F16–F22 — request construction

Watch the wire for every step.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Any run | The body has **no** `thinking` key at all |
| 2 | Any run | The body has **no** `temperature`, `top_p` or `top_k` |
| 3 | Any run | `max_tokens` equals `COPILOT_MAX_OUTPUT_TOKENS` (default 8 192 — `ortha.config.ts:200`) |
| 4 | Any run | `system` is a single string starting `You are Ortha AI` |
| 5 | Add `effort: 'low'` to the `claude` config and restart | The body carries `"output_config":{"effort":"low"}` |
| 6 | Remove it | The key is absent entirely — not `undefined`, not `"high"` |
| 7 | Sign in as a **viewer** (read-only tools) and send | `tools` is present with only read tools; no `*_propose_*` entry |
| 8 | Run a turn where the profile offers nothing (remove every capability plugin) | The `tools` **key is absent**, not `[]` — several models reject an empty array |
| 9 | After a tool round trip, inspect the second request | Message 2 is `role:"assistant"` with a `text` block and a `tool_use` block; message 3 is `role:"user"` with a `tool_result` block whose `content` is the fenced string and `tool_use_id` matching |
| 10 | Force a tool error (stop Postgres mid-run) | The `tool_result` block carries `"is_error":true` |

### F23 — stop-reason mapping

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Normal completion | Persisted `stopReason:'end'` (via `end_turn`) |
| 2 | A run that ends asking for a tool | The adapter emits `tool_use`; the engine continues the loop |
| 3 | Set `COPILOT_MAX_OUTPUT_TOKENS=32` and ask for a long answer | `stopReason:'max-output-tokens'`; the transcript shows the warning Alert "The answer was cut short by the response limit" |
| 4 | Provoke a refusal (a request the safety classifiers decline) | `stopReason:'refusal'`; the transcript says "The model declined to answer." |
| 5 | Send a conversation exceeding the model's context window | `model_context_window_exceeded` maps to `max_tokens` → run reason `max-output-tokens`. **Note this is a misleading label**: the answer was not cut short by the *response* limit, the *input* did not fit. See EC-14 |

### F24–F28 — capabilities

| Step | Action | Expected result / **Observed** |
| --- | --- | --- |
| 1 | `npx nx test @ortha-cms/copilot-provider-anthropic` | `:420` asserts the probe runs once and is cached; `:442` that each model caches independently; `:463` the fallback |
| 2 | In a REPL: `const p = createAnthropicProvider({apiKey, models:['claude-opus-5']}); await p.capabilities()` | `{model:'claude-opus-5', toolCalling:true, streaming:true, vision:<live>, contextWindow:<live>, maxOutputTokens:<live>}` |
| 3 | Call it again with the proxy down | The **cached** value, no second request |
| 4 | Restart the process, take the network down, call `capabilities()` | `FALLBACK_CAPABILITIES` — `contextWindow: 200 000`, `maxOutputTokens: 8 192`, `vision: true` |
| 5 | Bring the network back **without restarting** and call again | **Observed:** still the fallback, forever — the failed promise is cached (`anthropic-provider.ts:103-108`) → 🐞 BUG-copilot-provider-anthropic-01. **Expected:** a re-probe |
| 6 | Point `ANTHROPIC_BASE_URL` at a gateway that proxies `/v1/messages` but 404s `/v1/models` | Chat works; capabilities are silently the fallback with no log line |
| 7 | `grep -rn "\.capabilities(" packages apps \| grep -v spec` | Only `apps/server-e2e/src/support/copilot.ts:37`. **Nothing in production calls it** → cross-ref 🐞 BUG-copilot-domain-01 |

---

## 4. Edge Cases & Negative Paths

### Empty / zero

- **EC-01 — `models: []`.** `❌ NONE` `resolveModel` throws a plain `Error`
  (`resolve-model.ts:20-24`), but `CopilotPlugin` rejects it at boot
  (`copilot-plugin.ts:61-67`). Unreachable through the host.
- **EC-02 — `apiKey: ''`.** `🧪 UNIT` `:83` — the named-fix error, on first use.
- **EC-03 — A stream with no text and no tool calls.** `❌ NONE`
  The engine gets `text: ''`, `toolUses: []`, `stopReason:'end'` and returns
  `'end'` with **no** `assistantBlocks`, so no assistant message is persisted
  (`run-engine.service.ts:313`). The UI shows a turn with nothing in it.
- **EC-04 — `system` empty.** `❌ NONE` `wire/request.ts:76` omits the key.
  Never happens — the engine always builds a prompt.
- **EC-05 — `usage` with zero on both counts.** `❌ NONE`
  `toUsage` passes them through. The run's token ceiling then never trips.

### Boundary

- **EC-06 — `maxOutputTokens` above the model's cap.** `❌ NONE`
  `toStreamParams` sends `request.maxOutputTokens` unconditionally
  (`wire/request.ts:75`). `COPILOT_MAX_OUTPUT_TOKENS=999999` produces an API
  400, whose message reaches the browser through `userFacingMessage`. Nothing
  clamps against the probed `maxOutputTokens` — which is available and unused
  (see F29).
- **EC-07 — `maxRetries: 0` vs unset.** `❌ NONE` (F5).
- **EC-08 — `timeoutMs` shorter than the model's thinking time.** `❌ NONE`
  The SDK aborts; `isAbortError(error, signal)` sees an un-aborted caller signal
  and checks `error.name`. If the SDK surfaces it as `APIConnectionTimeoutError`
  rather than `AbortError`, it is **re-thrown** as a failure — which is
  arguably right (it is a misconfiguration) but is not the abort path.
- **EC-09 — `effort: 'max'`.** `❌ NONE` Forwarded verbatim; the API validates.
- **EC-10 — A tool `inputSchema` the API rejects.** `❌ NONE`
  `input_schema: tool.inputSchema as Tool.InputSchema` (`wire/request.ts:22`) is
  an unchecked cast. A malformed generated schema surfaces as an API 400 for the
  whole turn, not as a per-tool error.

### Size & encoding

- **EC-11 — A 10 MB fenced tool result in `messages`.** `❌ NONE`
  Mapped straight onto `MessageParam` and serialised by the SDK. See
  `docs/testing/copilot-domain.md` 🐞 BUG-copilot-domain-02.
- **EC-12 — Unicode / emoji / RTL in a text delta.** `❌ NONE`
  The SDK yields decoded strings; the concern is whether a delta ever splits a
  surrogate pair. The port requires concatenation to yield the answer
  (`model-provider.ts:52`); nothing verifies it here.
- **EC-13 — A tool name over the API's length limit.** `❌ NONE` API 400.

### Contract / mapping

- **EC-14 — `model_context_window_exceeded` → `max_tokens` → `max-output-tokens`.**
  `❌ NONE` The mapping comment says "Both mean 'ran out of room' — the answer is
  truncated either way" (`wire/response.ts:13`). At the UI it becomes "The
  answer was cut short by the response limit"
  (`run-limits.ts:63`), which is wrong for the input case and points a user at
  the wrong lever. Category: ux-state. Recorded as 🐞 BUG-copilot-provider-anthropic-03.
- **EC-15 — `pause_turn`.** Unreachable — the adapter enables no server-side
  tools. Documented (`wire/response.ts:16-17`).
- **EC-16 — `stop_reason: null`.** `❌ NONE` → `'end'` via the `default` branch.
- **EC-17 — A `thinking` block in `finalMessage().content`.** `❌ NONE`
  `anthropic-provider.ts:74-83` iterates the content and yields **only**
  `tool_use` blocks; `streamTurn` collects only `text-delta`s and tool calls, so
  a thinking block is dropped from the history entirely. See
  🐞 BUG-copilot-provider-anthropic-02 (**Unverified**).
- **EC-18 — A `server_tool_use` or `web_search_result` block.** Ignored. The
  adapter enables none.
- **EC-19 — Two `tool_use` blocks in one message.** `🧪 UNIT` `:173` covers
  emission from the assembled message; the parallel case is implied.

### Permission matrix

The adapter is permission-agnostic — it receives an already-filtered `tools`
list. What varies by role is therefore the **request body**:

| Role | `tools` in the request | Observable |
| --- | --- | --- |
| admin | 17 entries incl. every `*_propose_*` | ✅ `copilot-proposals.spec.ts:181` |
| contributor | as admin minus `activity_recent` | ✅ `copilot-read-catalogue.spec.ts:173` |
| viewer | reads only | ✅ `copilot-chat.spec.ts:579` |
| no `copilot:use` | the adapter is never reached — 403 at the route | ✅ `copilot-chat.spec.ts:126` |

- **EC-20 — Could a caller reach this adapter without a workspace?** No —
  `WorkspaceGuard` is on the run route (`create-run.controller.ts:51`).
- **EC-21 — Could a caller choose a provider the operator did not register?**
  No — `registry.has(providerName)` (`run-engine.service.ts:249-253`). "Naming
  one is not an escalation: the registry is fixed at boot"
  (`packages/copilot/server/AGENTS.md`).

### Tenant isolation

- **EC-22 — Nothing here is workspace-aware**, correctly: the adapter sees a
  prompt and a tool list, both already scoped. The one tenancy-adjacent risk is
  that workspace content is **sent to a third party** — which is exactly what
  ADR-0005 §10's default-off switch exists to make an explicit operator
  decision. Worth stating in a test plan so it is never assumed away.

### Concurrency

- **EC-23 — Two runs at once on one provider instance.** `❌ NONE`
  The factory's closure holds `client` (memoized), `models` (a snapshot) and
  `cachedCapabilities` (a `Map`). `stream` is a generator with no shared mutable
  state. Safe.
- **EC-24 — Two concurrent `capabilities()` on one model.** `❌ NONE`
  The **promise** is cached before it resolves (`anthropic-provider.ts:104-107`),
  so both callers await one probe. Correct, and the reason it is a promise cache
  and not a value cache.
- **EC-25 — A client construction race.** `❌ NONE`
  `createLazyClient` is not atomic, but Node is single-threaded and the check
  and assignment are synchronous (`client.ts:19-38`). Safe.

### Failure & partiality

- **EC-26 — `finalMessage()` rejecting after the deltas streamed.** `❌ NONE`
  The partial text has already been yielded and is in `assistantBlocks`; the
  throw propagates to the engine, which persists the partial turn with
  `stopReason:'error'` (`run-engine.service.ts:296-326`). Good behaviour,
  untested.
- **EC-27 — The API returning 429.** `❌ NONE`
  The SDK retries (default 2) with backoff, then throws. The message reaches the
  user — see 🐞 BUG-copilot-provider-anthropic-04.
- **EC-28 — The API returning a 5xx HTML error page.** `❌ NONE`
  The SDK surfaces it; whatever text it carries is forwarded to the browser.
- **EC-29 — An abort arriving between the deltas and `finalMessage()`.**
  `❌ NONE` `isAbortError(error, signal)` sees `signal.aborted` and yields
  `abortedEvent()` — the signal check first is precisely for this.
- **EC-30 — An already-aborted signal at `stream()` entry.** `🧪 UNIT` `:232`
  The SDK rejects at construction, which is inside the `try` deliberately
  (`anthropic-provider.ts:52-56`), so it becomes an abort not a failure.

### Idempotency & replay

- **EC-31 — The same request sent twice.** Non-deterministic by nature. The
  engine's repeat guard is about *tool calls*, not model calls.
- **EC-32 — `capabilities()` after `models` mutates.** `❌ NONE`
  `models` is snapshotted at construction (`anthropic-provider.ts:39`), so a
  later mutation of the host's array cannot change resolution. Matches
  `buildModelRegistry`'s discipline.

---

### 4A. Accessibility & Section 508 Conformance

**This unit renders no UI.** It is a server-side network adapter with no DOM, no
focus, no colour. The block is short by design; everything not listed is **Not
Applicable**.

**Standards tested against:** Revised Section 508 (36 CFR Part 1194,
Appendices A–C), incorporating WCAG 2.0 A+AA by reference (E205.4, 504.2).
Verdicts cite WCAG **2.1** AA SC numbers alongside the 508 provision.

**What genuinely applies:**

- **♿ A11Y-copilot-provider-anthropic-01 — Stream events carry the structure a
  client needs to announce progress.** WCAG **4.1.3 Status Messages (AA)** ·
  508 **502.3** · Verdict: **Supports**
  `src/lib/anthropic-provider.ts:61-89` emits the port's three event kinds and
  keeps them separate: `text-delta` for token noise, `tool-call` as one whole
  parsed event (never fragments — `:186-199`), and exactly one `done` with a
  stop reason. A client can therefore route tokens away from an announcement
  channel and announce only the coarse events. **Note the ordering
  divergence** recorded in §6: this adapter emits all tool calls *after* all
  text for a turn, while `provider-openai` does the same but for a different
  reason and `provider-fake` interleaves differently — a client that assumed one
  ordering would announce steps in the wrong place. That is a correctness
  finding (🐞 BUG-copilot-provider-anthropic-05), and its a11y consequence is
  worth naming here.

- **♿ A11Y-copilot-provider-anthropic-02 — Error text reaching a person is the
  vendor's, not ours.** WCAG **3.3.1 Error Identification (A)** ·
  508 **E205.4** · Verdict: **Partially Supports**
  A non-abort throw is re-thrown unchanged (`anthropic-provider.ts:95`), and
  `userFacingMessage`
  (`packages/copilot/server/src/lib/chat/application/run-engine.service.ts:1149-1154`)
  forwards `error.message` verbatim into a `RunErrorEvent` the browser renders
  in a `role="alert"` Alert. So a screen-reader user hears whatever the SDK
  wrote — which for a 401 is "401 {"type":"error","error":{"type":"authentication_error"…}}"
  rather than a sentence. The **good** counter-example is in this same package:
  `client.ts:21-26`'s missing-key error is a complete, actionable sentence
  naming two fixes, and it is the message an operator is most likely to meet.
  Remediation: classify the common SDK failures (401, 429, 529, connection) into
  sentences, the way `useCopilotChat`'s `describe()` already does for the
  transport layer
  (`packages/copilot/admin/src/lib/application/useCopilotChat.ts` — 401 becomes
  "Your session has expired"). Cross-references 🐞 BUG-copilot-provider-anthropic-04
  and 🐞 BUG-copilot-server-03. Do NOT implement.

- **♿ A11Y-copilot-provider-anthropic-03 — 504 Authoring Tool.** 508 **504.2** ·
  Verdict: **Not Applicable**
  This adapter transports a prompt and returns tokens. It neither writes content
  nor decides what is written; the §504 question lives at `copilot/server`'s
  propose/apply path and at the content tools. See ♿ A11Y-copilot-server-02.

- **♿ A11Y-copilot-provider-anthropic-04 — 2.2.1 Timing Adjustable.** WCAG
  **2.2.1 (A)** · 508 **E205.4** · Verdict: **Not Applicable (this unit)**
  `config.timeoutMs` defaults to the SDK's ten minutes and is operator-set, not
  user-facing; there is no interaction a person must complete against a clock
  here. The 2.2.1 exposure is the **permission prompt's** five-minute expiry in
  `copilot/server` — see ♿ A11Y-copilot-server-01 and ♿ A11Y-copilot-admin-04.

**Not Applicable:** 1.1.1, 1.3.1, 1.3.2, 1.3.5, 1.4.1, 1.4.3, 1.4.4, 1.4.10,
1.4.11, 1.4.12, 1.4.13, 2.1.1, 2.1.2, 2.4.1, 2.4.2, 2.4.3, 2.4.6, 2.4.7, 3.1.1,
3.1.2, 3.2.1, 3.2.2, 3.3.2, 3.3.3, 3.3.4, 4.1.2 — no user interface.

**Note on the axe suite:** `apps/admin-e2e/src/copilot/a11y.spec.ts` scans the
admin's Agents view against a mocked `/api`. It never reaches this adapter, and
a static axe scan cannot say anything about streaming behaviour in any case.

---

## 5. E2E Coverage Map

Covered by one unit spec (`src/lib/anthropic-provider.spec.ts`, 470 lines,
against a mocked SDK) and, indirectly and thinly, by the copilot server e2e —
which runs on `fake`, so **no e2e in this repo exercises this adapter**.

| Feature | Spec | Asserts | Verdict |
| --- | --- | --- | --- |
| F1 lazy client | `anthropic-provider.spec.ts:74` | No SDK constructor call until used | ✅ |
| F2 missing key | `:83` | The message names the fix | ✅ |
| F3/F4 memoize + baseUrl | `:94` | Constructed once; `baseURL` forwarded | ✅ |
| F5 retries/timeout | — | — | ❌ NONE |
| F10/F12 deltas + usage | `:115` | Text forwarded in order; a `done` with usage | ✅ |
| F13 cache tokens | `:148` | Key omitted when absent | ✅ — the negative shape, which is the one that matters |
| F11 tool calls | `:173` | From the assembled message, "parsed and whole" | ✅ |
| F14 abort | `:232` | Ends with `aborted` rather than throwing | ✅ |
| F15 real failure | `:257` | Re-thrown, not swallowed | ✅ — the pair with `:232` is what makes `isAbortError` trustworthy |
| F16 no thinking | `:273` | No `thinking` key | ✅ — pins a decision with a stated lethal failure mode |
| F17 no sampling | `:282` | No `temperature`/`top_p`/`top_k` | ✅ |
| F7/F8 model default + override | `:290` | First as default; override honoured | ✅ |
| F9 unknown model | `:302` | Rejected | ⚠️ PARTIAL — does not assert **no HTTP call was made**, which is the reason the resolve sits before the `try` |
| F18 effort | `:315` | Sent only when configured | ✅ |
| F20/F22 wire mapping | `:327` | Tools and block-structured turns | ✅ |
| F21 no tools key | `:403` | Omitted, not `[]` | ✅ |
| F6 models() | `:411` | Every declared model, in order | ✅ |
| F24/F25 probe + cache | `:420`, `:442` | Probed once; per-model caching | ✅ |
| F26 fallback | `:463` | Conservative fallback on failure | ⚠️ PARTIAL — asserts the **first** call falls back; nothing asserts a **later** call re-probes, which is 🐞 BUG-copilot-provider-anthropic-01 |
| F19 system omitted | — | — | ⚠️ PARTIAL — implied by `:327` |
| F23 stop reasons | — | — | ⚠️ PARTIAL — only `end` and `tool_use`; `refusal`, `max_tokens` and `model_context_window_exceeded` untested |
| F27 toolCalling always true | `:420` | Part of the probe assertion | ✅ |
| F28 failed probe cached forever | — | — | ❌ NONE |
| F29 capabilities consulted | — | — | ❌ NONE — nothing to test; nothing calls it |
| **Any e2e at all** | — | — | ❌ NONE. `apps/server-e2e/src/support/copilot.ts` drives `fake`; the anthropic adapter is never exercised end to end |

**Coverage tally: 29 features · 17 ✅ · 5 ⚠️ · 7 ❌**

**A11y coverage, marked separately:** `❌ NONE`, correctly — nothing renders.
The copilot axe suite does not reach this package and, being a static snapshot,
could not evaluate streaming behaviour if it did.

---

## 6. 🐞 Potential Bugs

### 🐞 BUG-copilot-provider-anthropic-01 — A single failed capability probe is cached for the life of the process, permanently pinning the fallback · Severity: Medium

**Location:** `packages/copilot/provider-anthropic/src/lib/anthropic-provider.ts:40-42`,
`:101-109`, with `src/lib/capabilities.ts:16-33`
**Category:** correctness

**What the code does:**

```typescript
const cachedCapabilities = new Map<string, Promise<ModelCapabilities>>();
…
capabilities(model?: string): Promise<ModelCapabilities> {
    const resolved = resolveModel(model, models);
    let probe = cachedCapabilities.get(resolved);
    if (!probe) { probe = probeCapabilities(client, resolved); cachedCapabilities.set(resolved, probe); }
    return probe;
}
```

and

```typescript
export async function probeCapabilities(client, model) {
    const base = { ...FALLBACK_CAPABILITIES, model };
    try { const info = await client().models.retrieve(model); return { … }; }
    catch { return base; }
}
```

`probeCapabilities` **catches**, so the cached promise always **fulfils** — with
the fallback when the probe failed. The cache therefore never distinguishes "we
learned the real numbers" from "we could not ask", and the entry is never
invalidated.

**Why it is wrong:** the fallback exists for a stated reason — "reporting
'unknown' as 'unsupported' would drop a frontier model into degraded mode over a
transient network blip" (`capabilities.ts:8-11`). That reasoning is about a
*transient* failure and it argues for a **retry**, not for making the transient
answer permanent. Caching the promise is correct for the success case
(one probe per model, and it deduplicates concurrent callers — EC-24); it is
wrong for the failure case. The consequence: a deployment whose first
`capabilities()` call happens during a restart of the upstream, or on a gateway
that has not yet come up, reports `contextWindow: 200 000` and
`maxOutputTokens: 8 192` forever — numbers that are conservative for Opus and
**wrong** for a model with a larger window, and stale the moment Anthropic ships
a model with different limits. AGENTS.md's own phrasing, "cached for the
adapter's lifetime", describes the mechanism without noticing it applies to the
failure too.

**Repro:**
1. `ANTHROPIC_BASE_URL=http://localhost:9999/v1` (nothing listening),
   `COPILOT_PROVIDER=claude`, start the server.
2. In a REPL against the same provider instance: `await provider.capabilities()`
   → `{contextWindow: 200_000, maxOutputTokens: 8_192, vision: true, …}`.
3. Start a correct proxy on `:9999`.
4. `await provider.capabilities()` again.
→ **Observed:** the same fallback, no request made. Only a process restart
recovers. / **Expected:** the second call re-probes and returns live numbers.

**Blast radius:** today, **none observable**, because nothing in production
calls `capabilities()` at all (see `docs/testing/copilot-domain.md`
🐞 BUG-copilot-domain-01). It becomes live the moment ADR-0004 §4's degraded
mode or §5's settings UI is implemented — at which point a workspace could sit
in a wrongly-reported capability state until a restart, which is exactly the
class of bug that is hard to reproduce and easy to misdiagnose. Filing it now
because the fix is three lines and the alternative is discovering it later.

**Suggested fix:** cache only on success — have `probeCapabilities` re-throw and
let `capabilities()` catch, return the fallback and **delete** the cache entry;
or cache the failure with a short TTL. Do NOT implement.

---

### 🐞 BUG-copilot-provider-anthropic-02 — Unverified — extended-thinking blocks are dropped from the assistant turn, so a tool-using conversation may replay a history the API rejects · Severity: Medium

**Location:** `packages/copilot/provider-anthropic/src/lib/anthropic-provider.ts:61-89` (the stream loop emits only `text-delta` and `tool-call`), with `src/lib/wire/request.ts:27-53` (`toAnthropicMessages` maps exactly three block types back onto the wire: `text`, `tool_use`, `tool_result`)

**Unverified —** I could not confirm from this repository whether the Anthropic
Messages API requires `thinking` blocks to be preserved in the assistant turn
that precedes a `tool_result`. That requirement, if it exists, is a property of
the API rather than of this codebase, and there is no fixture, contract test or
comment here that records it either way. What I **can** verify is the dropping,
which is unambiguous in the code.

**What the code does:**

```typescript
for await (const event of messageStream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta')
        yield { type: 'text-delta', text: event.delta.text };
}
const message = await messageStream.finalMessage();
for (const block of message.content) {
    if (block.type === 'tool_use') yield { type: 'tool-call', … };
}
```

Only `text_delta` events and `tool_use` blocks leave the adapter. A `thinking`
or `redacted_thinking` block in `message.content` is silently discarded. It is
never yielded, so `streamTurn` never sees it
(`packages/copilot/server/src/lib/chat/application/run-engine.service.ts:485-504`),
so it is never pushed onto `assistantBlocks` or `messages`
(`:378-400`), so the next request in the loop reconstructs the assistant turn as
text + `tool_use` with no thinking block.

**Why it might be wrong:** this package deliberately leaves thinking **on** —
AGENTS.md devotes a section to it ("Thinking is left at the API default — do not
disable it") because disabling it makes the model write tool calls into visible
text. So thinking blocks are expected in every response on current models. The
port's `ModelContentBlock` union (`packages/copilot/domain/src/lib/model/model-message.ts:57`)
has exactly three members and no place to carry one, so the drop is structural
rather than an oversight — but that means the decision to leave thinking on and
the decision to model only three block kinds have never been reconciled. If the
API does require the blocks back, the failure mode is a 400 on the **second**
request of a tool-using turn, which is the most common shape this feature has.

**Repro:**
1. `COPILOT_PROVIDER=claude` with a current model, real key.
2. Ask something requiring two tool round trips ("find every draft article and
   tell me which has no summary").
3. Watch the wire for request #2.
→ **Observe:** whether request #2's assistant message contains a `thinking`
block. It will not. Then observe whether the API accepts it. If it 400s, this is
a High-severity bug; if it accepts, this is a fidelity loss only (the model
cannot see its own prior reasoning across a tool round trip) and stays Medium.

**Blast radius:** if confirmed, every multi-step tool run on the default
provider. If not, degraded multi-step reasoning quality with no error.

**Suggested fix:** determine the API requirement first. If blocks must be
preserved, the port needs a fourth opaque `ModelContentBlock` member (a
provider-scoped passthrough), which is a domain change and should be an ADR
amendment rather than a patch. Do NOT implement.

---

### 🐞 BUG-copilot-provider-anthropic-03 — `model_context_window_exceeded` is reported to the user as "the answer was cut short by the response limit" · Severity: Low

**Location:** `packages/copilot/provider-anthropic/src/lib/wire/response.ts:5-20`,
surfacing through `packages/copilot/server/src/lib/chat/application/run-engine.service.ts:385`
and `packages/copilot/domain/src/lib/run/run-limits.ts:63`
**Category:** ux-state

**What the code does:**

```typescript
case 'max_tokens':
case 'model_context_window_exceeded':
    // Both mean "ran out of room" — the answer is truncated either way.
    return 'max_tokens';
```

The engine maps `max_tokens` → `RunStopReason: 'max-output-tokens'`
(`run-engine.service.ts:385`), which the UI renders as "The answer was cut short
by the response limit." (`run-limits.ts:63`, and the admin's own copy at
`MessageList/index.tsx:67`).

**Why it is wrong:** the two are not the same failure and have opposite fixes.
`max_tokens` means the **output** hit `COPILOT_MAX_OUTPUT_TOKENS` — raise
`COPILOT_MAX_OUTPUT_TOKENS`, or ask for less. `model_context_window_exceeded`
means the **input** did not fit — start a new thread, shorten the conversation,
or use a larger-window model. Telling a user the response limit cut their answer
short when the real problem is that their conversation no longer fits sends them
to the wrong lever, and raising the output ceiling makes the input case *worse*.
The comment's "ran out of room" is true and unhelpfully abstract. `RunStopReason`
already has room for the distinction — it is a superset of `ModelStopReason` for
exactly this kind of reason (`run-limits.ts:34-38`).

**Repro:**
1. `COPILOT_PROVIDER=claude`, a long thread against a small-window model.
2. Keep asking until the accumulated transcript exceeds the window.
→ **Observed:** the warning Alert reads "This answer is incomplete — Stopped
because it hit the response length limit." / **Expected:** something naming the
conversation length, e.g. "this conversation is too long for the model — start a
new one".

**Blast radius:** every long conversation, on every deployment using this
adapter. Low severity (misleading, not incorrect behaviour) and high visibility
— it is the message a user sees at exactly the moment they are stuck.

**Suggested fix:** add a `context-window` member to `ModelStopReason` and
`RunStopReason` with its own explanation. Do NOT implement.

---

### 🐞 BUG-copilot-provider-anthropic-04 — SDK error text is forwarded verbatim to the browser, including any detail the vendor put in it · Severity: Low · 🔒 SECURITY

**Location:** `packages/copilot/provider-anthropic/src/lib/anthropic-provider.ts:90-96`,
with `packages/copilot/server/src/lib/chat/application/run-engine.service.ts:305` and `:1149-1154`
**Category:** information-disclosure (minor)

**What the code does:**

```typescript
} catch (error) {
    if (isAbortError(error, signal)) { yield abortedEvent(); return; }
    throw error;
}
```

The throw reaches `RunEngine.run`'s catch, which does
`yield { type: 'error', message: userFacingMessage(error) }` where
`userFacingMessage` is `error instanceof Error && error.message ? error.message : 'Something went wrong.'`.

**Why it is wrong:** `RunErrorEvent`'s own contract says the message must be
"safe to show a user — never a stack, a provider payload, or anything naming
internal wiring" (`packages/copilot/domain/src/lib/run/run-event.ts:169-172`).
An `@anthropic-ai/sdk` `APIError` message is the vendor's serialised error body,
which carries the request id, the error type and — when `ANTHROPIC_BASE_URL`
points at an operator's gateway — whatever that gateway wrote, including its own
hostname. The API key itself is not in the message, but the base URL of an
internal gateway can be.

**Repro:**
1. `ANTHROPIC_BASE_URL=http://internal-llm-gw.corp.local/v1`,
   `ANTHROPIC_API_KEY=bad`, `COPILOT_PROVIDER=claude`.
2. Send a message from the panel.
→ **Observed:** the transcript's destructive Alert shows the SDK's raw error
text. / **Expected:** a classified sentence, with the detail in the server log
only.

**Blast radius:** any user holding `copilot:use` — which is every role. The
sibling adapter is worse (`provider-openai` deliberately embeds 500 characters
of the upstream body — see `docs/testing/copilot-provider-openai.md`
🐞 BUG-copilot-provider-openai-01), and the shared root cause is
`userFacingMessage`, filed as `docs/testing/copilot-server.md`
🐞 BUG-copilot-server-03. Recorded here because this adapter is where the
message is minted and where classification belongs.

**Suggested fix:** classify at the adapter — map the SDK's error classes to
sentences and re-throw a typed error the controller can forward — leaving
`userFacingMessage` as the last resort rather than the first. Do NOT implement.

---

### 🐞 BUG-copilot-provider-anthropic-05 — Tool calls are emitted after all text, so a client cannot reconstruct their true position in the turn · Severity: Low

**Location:** `packages/copilot/provider-anthropic/src/lib/anthropic-provider.ts:61-89`
**Category:** correctness (cross-adapter divergence)

**What the code does:** the delta loop runs to completion, *then* `finalMessage()`
is awaited and its `tool_use` blocks are yielded. So the event order is always
`[all text-deltas…][all tool-calls…][done]`, whatever order the model actually
produced them in.

**Why it is wrong:** it is defensible in isolation — AGENTS.md argues it well
("a tool call reaches the engine once, whole, and already parsed"), and it is
strictly better than reassembling `input_json_delta` fragments. The problem is
**divergence**: `provider-openai` also emits tool calls only at the end
(`packages/copilot/provider-openai/src/lib/openai-provider.ts:102`), but
`provider-fake` emits text then tool calls **per scripted turn**
(`packages/copilot/provider-fake/src/lib/fake-provider.ts:64-87`) with
different id shapes, and the engine downstream builds the assistant message as
`[text][…toolUses]` (`run-engine.service.ts:392-400`) which bakes the ordering
in. The consequence is user-visible: a model that says "let me check" → calls a
tool → says "found it" → calls another renders in `copilot/admin` as all prose
first and both steps after, because `ChatBlock` order comes from the event order
(`packages/copilot/admin/AGENTS.md`, "the card lives in the transcript, exactly
where the change happened" — the same argument, applied to proposals, that this
ordering defeats for steps).

**Repro:**
1. `COPILOT_PROVIDER=claude`. Ask something that makes the model narrate between
   two tool calls.
→ **Observed:** in the transcript, both tool steps appear after all the prose of
that turn. / **Expected** (per the admin's own stated principle): interleaved in
the order they happened.

**Blast radius:** transcript legibility on every multi-tool turn, on both real
adapters. Low: nothing is wrong, only mis-ordered, and the fix is genuinely hard
(it means emitting `tool-call` from `content_block_stop` with buffered arguments,
which is the design AGENTS.md deliberately rejected).

**Suggested fix:** none recommended — record the ordering as a known property of
the port, and stop the admin's documentation implying steps are chronological
within a turn. If it is ever worth fixing, emit at `content_block_stop` using
the SDK's own accumulated block rather than raw fragments. Do NOT implement.

---

**Defect tally:** `5 🐞 · 0 Critical · 0 High · 2 Medium · 3 Low · 1 🔒`
**Accessibility tally:** `4 ♿ · 1 Supports · 1 Partially Supports · 0 Does Not Support · 2 Not Applicable`

### Checked and cleared

- **Is the vendor SDK confined to this package?** Yes.
  `grep -rn "@anthropic-ai" packages apps --include=*.ts --include=*.json` finds
  it only in this package's `package.json` and four source files. `copilot/domain`
  and `copilot/server` import no SDK. ADR-0004 §1 holds.
- **Is `thinking` disabled?** No — `toStreamParams` (`wire/request.ts:67-81`)
  sends no `thinking` key, and `:273` pins it. The stated lethal failure mode
  (the model writing tool calls into visible text) is avoided.
- **Are sampling parameters sent?** No — `:282` pins it, and the port never
  carried them (`model-provider.ts:5-24`).
- **Does the abort path swallow real failures?** No — the `:232`/`:257` pair
  proves both directions, and `isAbortError` checks the **signal first**
  (`abort.ts:9-14`), which is the right order for an SDK that may surface its
  own abort as any error type.
- **Does a cancelled call invent usage?** No — `abortedEvent()` reports zero,
  per the port contract. (The **fake** adapter does not — see
  `docs/testing/copilot-domain.md` 🐞 BUG-copilot-domain-06.)
- **Can a caller reach an unregistered provider or an unoffered model?** No.
  `registry.has` (`run-engine.service.ts:249-253`) and `resolveModel` before the
  `try` (`anthropic-provider.ts:48-50`).
- **Is the API key ever serialised to the browser?** Not by this package. It
  goes into the SDK constructor only (`client.ts:27-28`), and
  `GET /api/copilot/models` serves names only
  (`list-models.controller.ts:50-55`, whose docstring says so).
- **Is the client construction re-entrant / racy?** No — synchronous check and
  assign in a single-threaded runtime (`client.ts:19-38`).
- **Does `models()` return a live reference to the host's array?** No —
  snapshotted with `[...config.models]` (`anthropic-provider.ts:39`).

---

## 7. Recommended E2E Tests

Harness: **unit** = `npx nx test @ortha-cms/copilot-provider-anthropic` (mocked
SDK, no network); **server-e2e** = `apps/server-e2e` testcontainer + supertest.

| Priority | Harness | Proposed spec | Asserts | Closes |
| --- | --- | --- | --- | --- |
| 1 | unit | `anthropic-provider.spec.ts` — extend `describe('capabilities')` | After a failing probe, a **second** `capabilities()` call re-probes and returns the live record; a succeeding probe is still called once | 🐞 BUG-copilot-provider-anthropic-01, F28 ❌ |
| 2 | unit | `anthropic-provider.spec.ts` — new `describe('stop reasons')` | `refusal`, `max_tokens`, `model_context_window_exceeded`, `end_turn`, `stop_sequence` and `null` each map to the documented port value — a table-driven case over `toStopReason` | F23 ⚠️, 🐞 BUG-copilot-provider-anthropic-03 |
| 3 | unit | new `src/lib/model-provider.contract.spec.ts` importing the proposed shared kit | The port contract: abort ends rather than throws, reports zero usage, exactly one `done`, tool calls whole and parsed. Run the identical kit in all three adapters' specs | 🐞 BUG-copilot-domain-06, cross-adapter divergence |
| 4 | unit | `anthropic-provider.spec.ts` — extend `:302` | An unknown model rejects **without any SDK call** — the reason `resolveModel` sits outside the `try` | F9 ⚠️ |
| 5 | unit | `anthropic-provider.spec.ts` — new case | A `finalMessage()` containing a `thinking` block: record what the adapter does with it, so the answer to 🐞 BUG-copilot-provider-anthropic-02 is a pinned fact | 🐞 BUG-copilot-provider-anthropic-02 |
| 6 | unit | `anthropic-provider.spec.ts` — new `describe('errors')` | A 401 / 429 / connection failure each produce an error whose message contains **no** base URL and no key; today this **fails**, which is the point | 🐞 BUG-copilot-provider-anthropic-04 |
| 7 | unit | `anthropic-provider.spec.ts` — extend `describe('the lazy client')` | `maxRetries: 0` reaches the SDK constructor; unset means the key is absent; the same for `timeoutMs` | F5 ❌ |
| 8 | unit | `anthropic-provider.spec.ts` — new case | `finalMessage()` rejecting **after** deltas have streamed still leaves the yielded text delivered, and the throw propagates | EC-26 |
| 9 | server-e2e | new `apps/server-e2e/src/server/copilot/copilot-provider-wire.spec.ts` | Against a **local HTTP stub** standing in for the Anthropic API (via `ANTHROPIC_BASE_URL`), a full run through the real adapter: frame order, tool round trip, `is_error` on a failed tool, and the persisted `model`/`provider` columns. This is the missing end-to-end layer — every current e2e runs on `fake` | "Any e2e at all" ❌ |
| 10 | unit | `anthropic-provider.spec.ts` — new case | Two concurrent `capabilities()` calls for one model issue **one** request — pinning the promise-cache property that EC-24 relies on | EC-24 |
| 11 | unit | `anthropic-provider.spec.ts` — extend `:327` | A `tool_result` block with `isError: true` maps to `is_error: true` on the wire, and one without omits the key | F22 partial, EC in §4 |
| 12 | doc | `packages/copilot/provider-anthropic/AGENTS.md` | Add `npx nx test @ortha-cms/copilot-provider-anthropic` to Commands — the target exists and is not listed | doc drift noted in §1 |
