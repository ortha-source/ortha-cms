# @ortha-cms/copilot-provider-fake — Test Artifact

> **Unit:** `packages/copilot/provider-fake` · **Package:** `@ortha-cms/copilot-provider-fake` · **Kind:** adapter (model-provider)
> **Source of truth:** `packages/copilot/provider-fake/AGENTS.md`
> **Generated:** 2026-08-11

## 1. Scope & Preconditions

**Owns** one implementation of `copilot-domain`'s `ModelProvider` port that
answers from a script instead of a model. It is **shipped product, not test
scaffolding** ([ADR-0004](../adr/0004-model-agnostic-copilot-provider.md) §3):
it is registered in `apps/server/src/plugins.ts:129` beside the two real
adapters, it is what `server-e2e` drives the entire run loop with, and it is how
a contributor runs the admin offline.

| Piece | Where |
| --- | --- |
| The factory + stream loop | `src/lib/fake-provider.ts` (113 lines) |
| Config, `FakeTurn`, `FakeProvider`, defaults | `src/lib/config.ts` |
| The two modes and script exhaustion | `src/lib/script.ts` |
| Delta splitter | `src/lib/text.ts` |
| Deterministic token estimate | `src/lib/usage.ts` |

**Does NOT own:**

- **Any network, clock or randomness.** Deliberate — the run engine is a
  non-deterministic multi-step loop and a flaky fake would make every assertion
  downstream flaky too.
- **Any vendor SDK.** Its only dependency is `@ortha-cms/copilot-domain`
  (`package.json:20-22`), verified by grep: the four source files import from
  `@ortha-cms/copilot-domain` and from each other, nothing else.
- **Model selection.** `resolveModel` is `copilot-domain`'s
  (`packages/copilot/domain/src/lib/model/resolve-model.ts:16-32`).
- **Registration.** `buildModelRegistry` in `copilot/server` owns the name → provider map.
- **Anything about tools.** It never reads `request.tools`, never validates that a
  scripted call names an offered tool, and never assembles a call from fragments.

### Entry points (exported API — `src/index.ts:1-7`)

| Export | Kind | Notes |
| --- | --- | --- |
| `createFakeProvider(config?)` | function | Returns a `FakeProvider` |
| `FakeProvider` | type | `ModelProvider` + `readonly calls: readonly ModelRequest[]` + `reset()` |
| `FakeProviderConfig` | type | `{ script?, capabilities?, chunkSize?, models? }` |
| `FakeTurn` | type | `{ text?, toolCalls?, stopReason?, usage? }` |
| `FakeToolCall` | type | `{ id?, name, input }` |

Not exported (and worth knowing when writing a test): `DEV_MODE_REPLY`,
`DEFAULT_CAPABILITIES`, `DEFAULT_CHUNK_SIZE` (8) and `DEFAULT_MODELS` (`['fake']`)
are declared in `src/lib/config.ts:67-83` but do **not** appear in `src/index.ts`,
so a spec asserting on the dev-mode reply has to hardcode the string.

**No HTTP routes, no schema, no migrations, no DI providers.** It is constructed
at the composition root and handed to `CopilotPlugin`.

### Runtime prerequisites

- **None of its own.** No env var, no key, no network, no Postgres, no clock.
  That is the point.
- To exercise it **through the copilot** you need the server's prerequisites
  (`docs/testing/copilot-server.md` §1) plus `COPILOT_PROVIDER=fake` — which,
  note, is the **default** (`apps/server/ortha.config.ts:198`).
- To exercise it in isolation: nothing but `npx nx test`.

### How to exercise it manually

```bash
npx nx test @ortha-cms/copilot-provider-fake     # 🧪 11 cases
npx nx typecheck @ortha-cms/copilot-provider-fake
npx nx lint @ortha-cms/copilot-provider-fake
```

Through the whole stack, in **dev mode** (no script):

```bash
docker compose up -d
COPILOT_ENABLED=true npm run dev     # COPILOT_PROVIDER defaults to `fake`
# open the admin, press ⌘J, ask anything
```

Every answer is the same canned sentence:

> The fake copilot provider is active, so no model was called. Point
> `plugins.copilot.defaultProvider` at a real provider to get a real answer.

Through the **e2e harness**, in test mode:

```bash
npx nx e2e server-e2e --testPathPatterns=copilot     # needs Docker
```

The harness swaps a freshly scripted instance in per test
(`apps/server-e2e/src/support/copilot.ts:23,52-53`), which is why
`scriptCopilot(...)` takes the whole script at construction rather than
appending to a live one.

Node REPL, the smallest possible loop:

```typescript
const p = createFakeProvider({ script: [{ text: 'hi' }], chunkSize: 1 });
for await (const e of p.stream({ model: 'fake', messages: [], maxOutputTokens: 10 })) {
    console.log(e);
}
```

### Dependencies that must be healthy

- `@ortha-cms/copilot-domain` — `resolveModel`, `abortedEvent`, and the
  `ModelProvider` / `ModelRequest` / `ModelStreamEvent` / `ModelCapabilities`
  types. A change to the `ModelStreamEvent` union is a change here.
- Nothing else. There is no runtime dependency to be unhealthy.

---

## 2. Feature Inventory

| # | Feature | Where it lives | Coverage |
| --- | --- | --- | --- |
| F1 | `createFakeProvider()` with no config returns a working `ModelProvider` | `fake-provider.ts:39-45` | 🧪 UNIT `fake-provider.spec.ts:26` |
| F2 | **Dev mode** — no `script`, the same canned reply forever | `script.ts:24-27`, `config.ts:67-70` | 🧪 UNIT `fake-provider.spec.ts:26` |
| F3 | **Test mode** — turns consumed in order | `script.ts:28-36` | 🧪 UNIT `fake-provider.spec.ts:52` |
| F4 | Running past the end of a script **throws**, naming the count and the call index | `script.ts:29-34` | 🧪 UNIT `fake-provider.spec.ts:80` |
| F5 | Text is streamed as `text-delta` events of `chunkSize` (default 8) | `fake-provider.ts:64-77`, `text.ts:6-13` | 🧪 UNIT `fake-provider.spec.ts:37` |
| F6 | Tool calls are emitted **after** the text, whole and already parsed | `fake-provider.ts:79-87` | 🧪 UNIT `fake-provider.spec.ts:52` |
| F7 | Tool-call ids default to `fake-tool-<callIndex>-<index>` | `fake-provider.ts:83` | 🧪 UNIT `fake-provider.spec.ts:68-73` |
| F8 | A turn with `toolCalls` and no `stopReason` infers `tool_use`; otherwise `end` | `fake-provider.ts:90-92` | 🧪 UNIT `fake-provider.spec.ts:74,77` |
| F9 | An explicit `stopReason` overrides the inference | `fake-provider.ts:91` | ❌ NONE |
| F10 | Usage defaults to a deterministic ~chars/4 estimate of request + reply | `usage.ts:8-40` | ⚠️ PARTIAL — only the aborted case's `{0,0}` is asserted (`fake-provider.spec.ts:119-125`) |
| F11 | A turn may override `usage` | `fake-provider.ts:93` | ❌ NONE |
| F12 | An **already-aborted** signal yields one `done` with `aborted`, and the script still advances | `fake-provider.ts:57-62` | ⚠️ PARTIAL — `fake-provider.spec.ts:110` asserts the frame; **not** that the script advanced |
| F13 | An abort **mid-stream** stops between chunks and reports usage | `fake-provider.ts:66-75` | ❌ NONE → 🐞 BUG-copilot-provider-fake-03 |
| F14 | `models()` returns the declared list; defaults to `['fake']` | `fake-provider.ts:43,103` | 🧪 UNIT `fake-provider.spec.ts:150,154` |
| F15 | `stream` rejects a model the provider was not given, exactly as production would | `fake-provider.ts:53` | 🧪 UNIT `fake-provider.spec.ts:161` |
| F16 | `capabilities(model?)` merges `DEFAULT_CAPABILITIES` with the override and stamps the resolved model | `fake-provider.ts:104-110` | 🧪 UNIT `fake-provider.spec.ts:128,158` |
| F17 | `calls` records every `ModelRequest` served, in order — the negative-path assertion target | `fake-provider.ts:45,54,98` | 🧪 UNIT `fake-provider.spec.ts:89` · ✅ E2E `apps/server-e2e/src/server/copilot/copilot-chat.spec.ts:579` (via `copilotToolNames`) |
| F18 | `reset()` clears `calls` and rewinds the script | `fake-provider.ts:99-102`, `script.ts:39-41` | 🧪 UNIT `fake-provider.spec.ts:140` |
| F19 | `chunkSize` is floored at 1 | `fake-provider.ts:42` | ❌ NONE |
| F20 | It imports **no vendor SDK** and reaches no network (ADR-0004 §1) | `package.json:20-22` | ❌ NONE (no lint rule or dependency-boundary test enforces it) |
| F21 | It is registered unconditionally in the host and is the `COPILOT_PROVIDER` **default** | `apps/server/src/plugins.ts:126-129`, `apps/server/ortha.config.ts:198` | ❌ NONE → 🐞 BUG-copilot-provider-fake-01 |
| F22 | A caller may select it per run with `{"provider":"fake"}` | `create-run.dto.ts:169-173` → `run-engine.service.ts:243-254` | ⚠️ PARTIAL — `copilot-chat.spec.ts:677` runs on a named provider; nothing asserts what naming `fake` implies in a real deployment |

---

## 3. Manual Test Plan

**Global preconditions.** A checkout with dependencies installed. For the
stack-level blocks: `docker compose up -d`, a `.env`, `COPILOT_ENABLED=true`,
migrations applied, an admin session and a workspace. Node ≥ 22.

**Keyboard-only path / screen-reader expectation:** not applicable — this unit
renders no UI and has no HTTP surface. See §4A.

Shorthand for the isolation blocks (a `.mjs` scratch file or `nx test` with a
temporary case):

```typescript
const drain = async (events) => { const out = []; for await (const e of events) out.push(e); return out; };
const req = { model: 'fake', messages: [{ role: 'user', content: [{ type: 'text', text: 'hello' }] }], maxOutputTokens: 1024 };
```

### F1 / F2 — dev mode

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `const p = createFakeProvider(); await drain(p.stream(req))` | An array of `text-delta` events followed by exactly one `done` |
| 2 | Join the deltas | The full `DEV_MODE_REPLY` sentence, ending "…to get a real answer." |
| 3 | `done` | `{ type: 'done', stopReason: 'end', usage: { inputTokens: >0, outputTokens: >0 } }` |
| 4 | Drain a second time and deep-compare | **Identical** to the first |
| 5 | Drain a hundred times | Never throws; `p.calls` has 100 entries |
| 6 | Run the stack with `COPILOT_PROVIDER` unset and ask three different questions in the admin | The same canned sentence three times — and note this is what a misconfigured **production** deployment does (see 🐞 BUG-copilot-provider-fake-01) |

### F3 / F4 — test mode and exhaustion

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `createFakeProvider({ script: [{ text: 'one' }, { text: 'two' }] })` | — |
| 2 | Drain once | Deltas spelling `one`, `done` with `end` |
| 3 | Drain again | `two` |
| 4 | Drain a third time | **Rejects** with `Fake copilot provider script exhausted: 2 turn(s) scripted, call 3 requested. Add a turn, or assert fewer model calls.` |
| 5 | Confirm the throw surfaces on the first `next()` | `p.stream(req)` itself does not throw; the rejection arrives when the iteration starts (it is an async generator) |
| 6 | Drive the same overrun through the run engine | The engine's `catch` classifies it as an error, the run ends `stopReason: 'error'`, and the SSE stream carries an `error` frame with that message. Confirm the message is legible in the e2e failure output rather than an opaque 500 |
| 7 | `createFakeProvider({ script: [] })` and drain once | Rejects immediately — an empty array is a supplied script, not dev mode |

### F5 / F19 — chunking

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `chunkSize: 3` on `'I found 3 matching articles.'` | Deltas of length 3, the last shorter; joined they reconstruct the string exactly |
| 2 | `chunkSize: 1` | One delta per **UTF-16 unit** |
| 3 | `chunkSize: 1` on `'🎉 done'` | The emoji is split across two deltas as two lone surrogates — see EC-08 |
| 4 | `chunkSize: 0` | Floored to 1 (`Math.max(1, …)`); no infinite loop |
| 5 | `chunkSize: -5` | Same |
| 6 | `chunkSize: 1e6` on a short reply | One delta |
| 7 | A turn with `text: ''` (or omitted) and one tool call | **No** `text-delta` events at all, then the `tool-call`, then `done` |

### F6 / F7 / F8 / F9 — tool calls and stop reasons

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `script: [{ toolCalls: [{ name: 'admin_content_search', input: { q: 'launch' } }] }]` | One `tool-call` with `id: 'fake-tool-0-0'`, the name, and the `input` **as an object** (already parsed, never a JSON string) |
| 2 | `done` for that turn | `stopReason: 'tool_use'` — inferred |
| 3 | Two tool calls in one turn | Ids `fake-tool-0-0` and `fake-tool-0-1` |
| 4 | A second turn with a tool call | Ids `fake-tool-1-0` — the call index is the **provider call** index, not the turn index within a script (they coincide only because one drain is one call) |
| 5 | `{ toolCalls: [{ id: 'toolu_custom', name: 'x', input: {} }] }` | The explicit id wins |
| 6 | `{ text: 'hi', toolCalls: [{ … }] }` | Deltas first, **then** the tool call, then `done` with `tool_use` |
| 7 | `{ toolCalls: [{ … }], stopReason: 'end' }` | `end`, not `tool_use` — the override wins |
| 8 | `{ text: 'x', stopReason: 'max_tokens' }` | `max_tokens`; through the engine this becomes `stopReason: 'max-output-tokens'` on the run |
| 9 | `{ text: 'x', stopReason: 'refusal' }` | Through the engine: run `stopReason: 'refusal'` |
| 10 | `{ toolCalls: [{ name: 'no_such_tool', input: {} }] }` driven through the engine | The engine refuses it as unknown — **the fake does not check the name against `request.tools`** |
| 11 | `{ toolCalls: [{ name: 'x', input: undefined }] }` | The event carries `input: undefined`; the engine's `validateToolInput` sees `undefined` |

### F10 / F11 — usage

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Drain the dev reply with a one-message request | `usage.inputTokens ≈ ceil(len(system + messages + tool names/descriptions) / 4)`, `outputTokens = ceil(len(reply)/4)` |
| 2 | Same request twice | Identical numbers — no clock, no randomness |
| 3 | Add a `system` string of 400 chars | `inputTokens` grows by exactly 100 |
| 4 | Add two `tools` with 100-char descriptions | `inputTokens` grows by their name + description lengths / 4 |
| 5 | A request whose messages contain a `tool_use` block | `requestText` pushes `block.name` **and** `JSON.stringify(block.input)` (`usage.ts:22`) |
| 6 | A request whose messages contain a `tool_result` block | It pushes `block.content` (`usage.ts:20`) |
| 7 | `{ text: 'x', usage: { inputTokens: 7, outputTokens: 9 } }` | The override is reported verbatim |
| 8 | Drive four scripted turns through the engine and read `copilot_messages.input_tokens` | The engine's accumulated sum, non-zero — which is what makes the token-ceiling path testable at all |

### F12 / F13 — abort

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `drain(p.stream(req, AbortSignal.abort()))` | Exactly one event: `{ type: 'done', stopReason: 'aborted', usage: { inputTokens: 0, outputTokens: 0 } }` |
| 2 | Immediately drain again with a live signal | The **second** scripted turn is served — the script advanced even though the call did not finish |
| 3 | Script one long text with `chunkSize: 1`; abort the controller after the third delta | The stream ends with `done`/`aborted`. **Check the usage:** expected the partial (three characters ≈ 1 token). Observed: the estimate of the **whole** reply → 🐞 BUG-copilot-provider-fake-03 |
| 4 | Abort after the last delta but before `done` | The loop has exited, so `done` carries the turn's normal stop reason and full usage — the abort is not observed at all |
| 5 | Abort during a turn whose text is empty but which has tool calls | The tool-call loop has **no** abort check (`fake-provider.ts:79-87`), so every call is emitted after the abort |
| 6 | Compare with a real provider | Anthropic and OpenAI both catch the SDK/fetch rejection and yield `abortedEvent()` — they cannot emit anything after the transport is torn down |

### F14 / F15 — models

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `createFakeProvider().models()` | `['fake']` |
| 2 | `createFakeProvider({ models: ['small', 'large'] }).models()` | `['small', 'large']` in order |
| 3 | Mutate the array passed in, afterwards | `models()` is unaffected — it is spread at construction (`fake-provider.ts:43`) |
| 4 | `stream({ ...req, model: 'huge' })` | Rejects with `UnknownModelError`, message containing "not offered by this copilot provider" |
| 5 | Check `calls` after step 4 | **Empty** — `resolveModel` runs before `calls.push` (`fake-provider.ts:53-54`), so a rejected model neither records a call nor advances the script |
| 6 | `stream({ ...req, model: undefined })` | Resolves to the first declared model |
| 7 | `createFakeProvider({ models: [] })` and stream | Rejects with "This model provider declares no models." — and note `CopilotPlugin` refuses this at construction anyway (`copilot-plugin.ts:61-67`) |

### F16 — capabilities

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `await createFakeProvider().capabilities()` | `{ model: 'fake', toolCalling: true, streaming: true, vision: false, contextWindow: 1_000_000, maxOutputTokens: 64_000 }` |
| 2 | `capabilities({ toolCalling: false, contextWindow: 4_096 })` override | Merged over the defaults; `streaming` still true |
| 3 | `createFakeProvider({ models: ['small','large'] }).capabilities('large')` | `model: 'large'` — the resolved model overrides even an override that set `model` |
| 4 | `capabilities('huge')` | Rejects with `UnknownModelError` |
| 5 | Grep the repo for a production caller of `.capabilities(` | Only `apps/server-e2e/src/support/copilot.ts:37`. **Nothing in `copilot/server` calls it** — see EC-14 |

### F17 / F18 — the inspection surface

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Serve a request carrying `tools: [{ name: 'admin_content_search', … }]` | `p.calls[0].tools?.map(t => t.name)` is `['admin_content_search']` |
| 2 | Run a **viewer's** turn through the engine and read `calls[0].tools` | No `*_propose_*` name — this is ADR-0005's mandatory negative assertion, made without a model |
| 3 | `p.reset()` | `calls.length === 0` and the script rewinds to turn 1 |
| 4 | Confirm `calls` is the same array object across reads | It is (`fake-provider.ts:98` returns the live array), so a caller holding a reference sees later pushes |
| 5 | Serve two turns through the **engine**, then inspect `calls[0].messages` | **Suspected:** it now contains the assistant turn and tool results appended *after* the first call was served → 🐞 BUG-copilot-provider-fake-02 |

### F20 — no vendor SDK, no network (ADR-0004 §1)

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `cat packages/copilot/provider-fake/package.json` | Exactly one dependency: `@ortha-cms/copilot-domain` |
| 2 | `grep -rn "^import\|require(" packages/copilot/provider-fake/src` | Five import statements, all resolving to `@ortha-cms/copilot-domain` or a sibling file |
| 3 | `grep -rn "fetch\|http\|https\|axios\|Anthropic\|openai" packages/copilot/provider-fake/src` | No matches |
| 4 | `grep -rn "Date\.\|Math.random\|setTimeout\|performance" packages/copilot/provider-fake/src` | No matches — no clock, no randomness |
| 5 | Run `npx nx test @ortha-cms/copilot-provider-fake` with the network disabled | Passes |

### F21 / F22 — can it be selected in production by accident?

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Deploy with `NODE_ENV=production`, `COPILOT_ENABLED=true`, `ANTHROPIC_API_KEY` set, and **`COPILOT_PROVIDER` unset** | Expected: the deployment refuses to start, or falls back to a real provider. **Observed:** it boots, and every run answers with the canned sentence (`ortha.config.ts:198` defaults to `'fake'`) → 🐞 BUG-copilot-provider-fake-01 |
| 2 | `GET /api/copilot/models` on that deployment | The catalogue lists `{provider: 'fake', model: 'fake'}` alongside the real backends — to any user holding `copilot:use` |
| 3 | In the admin's model picker | **Fake** is a selectable option for every user |
| 4 | Any user: `POST /api/copilot/runs` with `{"message":"…","provider":"fake"}` | 200, the canned reply, and a `copilot_messages` row recording `provider: 'fake'` — indistinguishable in the audit trail from any other choice except by that column |
| 5 | Ask the fake to make a change (a write tool) | It never emits a `tool-call` in dev mode, so no write ever happens — the failure mode is "the assistant is useless", not "the assistant is dangerous" |
| 6 | Check for any guard: grep for `NODE_ENV` in `packages/copilot/**` and `plugins.ts` | None. The registration at `plugins.ts:126-129` is unconditional |

---

## 4. Edge Cases & Negative Paths

### Empty / zero / absent

- **EC-01 — `createFakeProvider({})`.** `⚠️ PARTIAL` — equivalent to no argument;
  `fake-provider.spec.ts:26` covers the no-argument form only.
- **EC-02 — `script: []`.** `❌ NONE` — an empty array is truthy, so
  `createScriptReader` takes the test-mode branch and the **first** call throws
  "0 turn(s) scripted, call 1 requested". Correct, and worth pinning: an author
  writing `scriptCopilot()` with no turns gets that message rather than the dev
  reply.
- **EC-03 — a turn that is `{}`.** `❌ NONE` — no text, no tool calls: zero
  `text-delta`s, zero `tool-call`s, one `done` with `end` and a `usage` whose
  `outputTokens` is 0. This is the correct way to script "the model said
  nothing", and the engine turns it into a run that ends with **no assistant
  message row at all** (`run-engine.service.ts:313`).
- **EC-04 — `toolCalls: []`.** `❌ NONE` — `length > 0` is false, so the stop
  reason infers `end`, not `tool_use`.
- **EC-05 — `text: ''` explicitly.** `❌ NONE` — `chunkText('', n)` returns `[]`;
  no deltas.
- **EC-06 — a request with `messages: []`.** `⚠️ PARTIAL` — `usage.ts:14-25`
  handles it (`parts` is just the system string); the spec's request always has
  one message.

### Boundary

- **EC-07 — `chunkSize` at the text length exactly, and at length ± 1.**
  `❌ NONE` — `chunkText` is a plain `for` with `slice`, so the boundary is safe,
  but the last-chunk-shorter case is only implied by
  `fake-provider.spec.ts:37`'s reassembly assertion.
- **EC-08 — an astral-plane character split by `chunkSize`.** `❌ NONE` —
  `String.prototype.slice` cuts **UTF-16 units**, so `chunkText('🎉', 1)` yields
  two lone surrogates. Reassembly still produces the right string (the engine
  concatenates), so this is harmless *end to end*, but a consumer asserting on an
  individual `text-delta` gets `'\ud83c'`. Real providers emit UTF-8-safe token
  boundaries, so this is a fake-only shape a test could accidentally depend on.
- **EC-09 — the script index at `Number.MAX_SAFE_INTEGER`.** Not reachable.
- **EC-10 — `maxOutputTokens: 0` in the request.** `❌ NONE` — the fake ignores
  `maxOutputTokens` entirely, so a scripted 10 000-character reply is served
  regardless. A real provider would truncate and report `max_tokens`.

### Size & encoding

- **EC-11 — a 1 MB scripted reply at `chunkSize: 8`.** `❌ NONE` — 131 072
  `text-delta` events through the engine, each one an SSE frame. Nothing bounds
  it; the run's token ceiling is checked only between steps
  (see `docs/testing/copilot-server.md` 🐞 BUG-copilot-server-03), so this is one
  way to exercise that.
- **EC-12 — a scripted `input` that is not JSON-serializable** (a cycle, a
  `BigInt`). `❌ NONE` — the fake passes it through untouched, and
  `usage.ts:22` calls `JSON.stringify(block.input)` on history blocks, which
  **throws on a cycle**. Reachable only if a previous turn's tool-use input was
  cyclic, which the engine cannot produce from a real provider — but a fake
  script can.
- **EC-13 — RTL / emoji / combining marks in the reply.** `❌ NONE` — see EC-08.

### Permission matrix

**Not applicable.** This unit has no caller identity, no permission, no
workspace, and no route. The permission questions belong to
`docs/testing/copilot-server.md`. Its only authority-adjacent property is that
`calls[0].tools` is the assertion target for "a viewer was offered no write
tool", which is the point of `FakeProvider` existing at all.

### Tenant isolation

**Not applicable** — the fake holds no per-workspace state. Note, however, that
the e2e harness holds **one module-level instance**
(`apps/server-e2e/src/support/copilot.ts:23`) shared across every test in a file,
which is why `scriptCopilot` replaces it rather than appending: a leftover script
from a previous test would be served to the next one.

### Concurrency

- **EC-14 — two concurrent `stream()` calls on one instance.** `❌ NONE` and it
  is **not safe**: `calls.push` and `script.next()` are read-modify-write on
  shared state with no lock, and `callIndex` is captured before the first
  `await`. Two overlapping runs interleave the script arbitrarily. The run engine
  serialises its own model calls, but two *runs* in one process share the
  provider — so a server-e2e test that starts two runs concurrently would get
  non-deterministic turns from the "deterministic" fake. Worth stating because
  determinism is this package's entire value proposition.
- **EC-15 — `reset()` during an in-flight drain.** `❌ NONE` — `calls.length = 0`
  mutates the array a consumer may be holding.

### Failure & partiality

- **EC-16 — the exhaustion throw's shape.** `⚠️ PARTIAL` —
  `fake-provider.spec.ts:84` matches `/script exhausted/`; the count and call
  index in the message (which are what make the failure diagnosable) are not
  asserted.
- **EC-17 — the fake never fails the way a real provider fails.** `❌ NONE`. This
  is the whole of §4's divergence section below, and it is the most important
  thing in this artifact.

### Divergence from the real adapters — the systematic pass

The fake exists so CI can run the loop. Everything the fake does *differently*
from `provider-anthropic` and `provider-openai` is a class of bug CI cannot see.

| Aspect | fake | anthropic | openai | Consequence for CI |
| --- | --- | --- | --- | --- |
| **Tool-call assembly** | emitted whole, already parsed, from the script (`fake-provider.ts:79-87`) | assembled from `finalMessage()`, so also whole and parsed (`anthropic-provider.ts:70-81`) | **accumulated from `input_json_delta` fragments** by `createToolCallAccumulator` and drained at the end (`openai-provider.ts:92,99`) | A fragment-assembly bug in the OpenAI adapter — a split JSON string, an out-of-order index, a `tool_calls` array with holes — is invisible to every copilot e2e test. Only `openai-provider.spec.ts` can catch it |
| **Ordering** | all text, then all tool calls, then `done` | all text (streamed), then tool calls (post-hoc), then `done` | text **interleaved** with accumulation, tool calls drained after the loop, then `done` | Ordering happens to agree, so the engine's assumption ("`toolUses` is complete when `streamTurn` returns") is safe. **Checked and cleared** |
| **Text after a tool call** | impossible — `text` is one string emitted first | possible in principle (a `content_block_delta` after a `tool_use` block) but the adapter streams all deltas before reading `finalMessage`, so it also lands first | possible and preserved in order | A model that explains *after* deciding to call a tool is never simulated. The admin's "a step ends the paragraph" rule (`chatReducer`) is exercised only in the shape the fake produces |
| **Abort** | checked synchronously between chunks; **no check in the tool-call loop** (`fake-provider.ts:79-87`) | the SDK rejects; `isAbortError` → `abortedEvent()` (`anthropic-provider.ts:90-95`) | `fetch` rejects; same (`openai-provider.ts:104-108`) | The fake can emit tool calls **after** an abort; a real provider cannot. A consumer that assumed "nothing arrives after abort" would pass CI and fail in production — and the engine does assume it, guarding only at step boundaries |
| **Timeout** | none | none (the SDK's own) | `AbortSignal.timeout(timeoutMs)`, default `DEFAULT_TIMEOUT_MS`, with a distinct error message (`openai-provider.ts:59,109-113`) | The timeout path — the most common real failure with a local Ollama — has no CI exercise through the engine at all |
| **Transport error** | never; the only throw is script exhaustion | rethrows the SDK's error (a vendor `APIError` with status and message) | throws `Copilot model request to <endpoint> failed: <status> <statusText> — <body, 500 chars>` (`openai-provider.ts:118-125`) | The engine turns a provider throw into `userFacingMessage(error)` = `error.message` and sends it to the browser as an `error` frame (`run-engine.service.ts:305`). So a 401 from OpenAI puts **the endpoint URL and up to 500 characters of the provider's response body** in front of any user with `copilot:use`. Nothing in CI ever produces that string, so nothing tests what it contains |
| **`maxOutputTokens`** | ignored | forwarded (`wire/request.ts`) | forwarded | `stopReason: 'max_tokens'` never occurs naturally; the run's `max-output-tokens` path is reachable only by scripting it explicitly, which no spec does |
| **`system`, `tools`, `messages`** | recorded in `calls`, otherwise ignored | mapped to the wire format | mapped to the wire format | A malformed `ModelMessage` (an empty `content` array, a `tool_result` with no matching `tool_use`) is accepted silently by the fake and rejected with a 400 by both real providers. The engine builds these in `loop`, so a history-assembly bug is fake-invisible |
| **Tool name validation** | none — a script may call a tool that was never offered | impossible (a real model only calls what it was told about) | impossible | Deliberate and useful: it is how `copilot-chat.spec.ts:634` proves execution-time re-authorization. But it means "the model called a withheld tool" is a *test-only* scenario, so the refusal path's real-world frequency is zero |
| **`capabilities()`** | constants, always resolves | one network probe per model, cached (`anthropic-provider.ts:99-107`) | resolved from config, synchronous | The probe can fail (a bad key, a network partition) and nothing consumes the result — see EC-18 |
| **Determinism** | total | none | none | Everything above |

- **EC-18 — `capabilities()` has no production consumer.** `❌ NONE`. Grepping
  `.capabilities(` across `packages` and `apps` finds exactly one non-adapter,
  non-spec caller: `apps/server-e2e/src/support/copilot.ts:37`. The run engine
  never calls it. So `FakeProviderConfig.capabilities` — documented in AGENTS.md
  as "how degraded mode gets tested — e.g. `{ toolCalling: false }`" — exercises
  a degraded mode the engine does not implement: with `toolCalling: false` the
  engine still sends `tools` and still executes whatever the script calls. Worth
  recording so the option is not mistaken for a guarantee.

### 4A. Accessibility & Section 508 Conformance

**Mostly Not Applicable, and that is the honest answer.** This unit renders no
UI, exposes no route, produces no document, and has no user-facing surface of any
kind. Chapters 4 (hardware) and 5 (software, 502/503/504) and every
perceivable/operable/understandable success criterion address something this
package does not have.

| Provision / SC | Verdict | Why |
| --- | --- | --- |
| WCAG 2.1 A + AA, all criteria (508 E205.4) | **Not Applicable** | No content is authored, rendered or delivered by this unit |
| 502.2 / 502.3 (interoperability with AT) | **Not Applicable** | No platform object, no name/role/state/value to expose |
| 503.2 (platform preferences — reduced motion) | **Not Applicable** | No animation, no timing, no clock |
| 503.4 (captions, audio controls) | **Not Applicable** | No media |
| **504 Authoring Tools** | **Not Applicable — with one qualification below** | It authors nothing itself |

**The one thing worth saying.** 504.2 asks whether the authoring tool enables an
author to produce conformant content, and the copilot's write path is an
authoring path (see `docs/testing/copilot-server.md` §4A, ♿ A11Y-copilot-server-01
and -02). The fake is the provider CI runs that path against — so any
accessibility check that is ever added to the write path (an alt-text
requirement, a heading-structure check on a proposed richtext body) has to be
scriptable here, and today nothing prevents a script from proposing content that
would fail such a check. That is not a defect in this package; it is the reason
the recommended tests in §7 include a scripted case for whatever gate lands
server-side, so the check is exercised in CI rather than only against a real
model.

One further note, because it is easy to get backwards: the fake reports
`vision: false` (`config.ts:77`). If a vision gate is added to
`media_propose_alt_text` (♿ A11Y-copilot-server-01's remediation), the fake's
default would correctly suppress the tool — and every existing alt-text e2e case
would start failing. That is the *right* failure, and it is worth knowing in
advance which flag controls it.

**No a11y coverage exists or is needed for this unit.** The `admin-e2e` axe
suites do not and cannot reach it.

---

## 5. E2E Coverage Map

The package's own suite is `src/lib/fake-provider.spec.ts` (11 cases, 165 lines),
run by `npx nx test`. There is no dedicated e2e — the fake is exercised
*implicitly* by every copilot server-e2e spec, through
`apps/server-e2e/src/support/copilot.ts`.

| Feature | Spec | Asserts | Verdict |
| --- | --- | --- | --- |
| F1/F2 dev mode | `src/lib/fake-provider.spec.ts:26` | two drains are deep-equal; `done`/`end`; `calls` length 2 | 🧪 UNIT — does not assert the reply's **content**, so a change to `DEV_MODE_REPLY` (which is not exported) breaks nothing |
| F5 chunking | `fake-provider.spec.ts:37` | with `chunkSize: 3`, the joined deltas reconstruct the string exactly | 🧪 UNIT — reassembly only; no assertion on the number or length of deltas |
| F3/F6/F7/F8 script order + ids + inference | `fake-provider.spec.ts:52` | turn 1 emits `tool-call` `fake-tool-0-0` with the input, `stopReason: 'tool_use'`; turn 2 `end` | 🧪 UNIT |
| F4 exhaustion | `fake-provider.spec.ts:80` | the third drain rejects `/script exhausted/` | ⚠️ PARTIAL — the count and call index in the message are the diagnostic value and are unasserted |
| F17 `calls` | `fake-provider.spec.ts:89` | `calls[0].tools` carries the offered tool names | ⚠️ PARTIAL — this is the negative-path assertion target ADR-0005 makes mandatory, and nothing asserts that `calls[n]` is a **stable snapshot**; see 🐞 BUG-copilot-provider-fake-02 |
| F12 pre-flight abort | `fake-provider.spec.ts:110` | exactly one `done`, `aborted`, `{0,0}` usage | ⚠️ PARTIAL — the documented side effect ("the script still advances") is not asserted, so removing it would not fail |
| F13 mid-stream abort | — | — | ❌ NONE |
| F9 explicit `stopReason` | — | — | ❌ NONE |
| F10/F11 usage | `fake-provider.spec.ts:119-125` (indirectly) | the aborted case's zeros | ❌ NONE for the estimate itself or for the per-turn override |
| F16 capabilities | `fake-provider.spec.ts:128,158` | the override merges; the resolved model is stamped | 🧪 UNIT |
| F18 reset | `fake-provider.spec.ts:140` | `calls` cleared, script rewound (the next drain yields 2 events) | 🧪 UNIT |
| F14/F15 models | `fake-provider.spec.ts:150,154` | default `['fake']`; declared list; an unlisted model rejects | 🧪 UNIT — does not assert that a rejected model leaves `calls` empty and the script unadvanced |
| F19 `chunkSize` floor | — | — | ❌ NONE |
| F20 no vendor SDK | — | — | ❌ NONE — ADR-0004 §1's central constraint is enforced by review only. There is no dependency-boundary lint rule and no test |
| F21 production selection | — | — | ❌ NONE |
| **Implicit, through the engine** | `apps/server-e2e/src/server/copilot/*.spec.ts` (all six files, ~4 283 lines) | every copilot e2e drives the fake via `scriptCopilot(...)`; `copilot-chat.spec.ts:579,591,607,621` reads `calls[0].tools` for the capability-profile assertions; `:522` scripts nine turns for `max-steps` | ✅ E2E for the *fake's role*; ❌ NONE for the fake's own contract, which those specs assume |
| **a11y** | — | — | Not Applicable (§4A) |

**Coverage tally: 22 features · 9 ✅/🧪 · 6 ⚠️ · 7 ❌.**

---

## 6. 🐞 Potential Bugs

### 🐞 BUG-copilot-provider-fake-01 — the fake is the default provider in production, with nothing to prevent it · Severity: High · 🔒

**Location:** `apps/server/ortha.config.ts:198` and
`apps/server/src/plugins.ts:126-129`
**Category:** correctness / operational-safety

**What the code does:**

```typescript
// Which registered provider serves a run when `plugins.ts` supplies
// no custom `resolve` handler. `fake` needs no key and no network,
// so a fresh clone and CI both boot without configuration.
defaultProvider: process.env['COPILOT_PROVIDER'] ?? 'fake',
```

and, unconditionally:

```typescript
// Shipped, not test scaffolding (ADR-0004 §3): it is how
// server-e2e drives the loop with no key and no network, and
// how a contributor runs the admin offline.
{ name: 'fake', provider: createFakeProvider() }
```

There is no `NODE_ENV` check anywhere in `packages/copilot/**` or in
`plugins.ts` — verified by grep.

**Why it is wrong.** Three separate paths reach the fake in a deployed system,
and none of them is guarded:

1. **The default.** An operator who sets `COPILOT_ENABLED=true` and
   `ANTHROPIC_API_KEY` but forgets `COPILOT_PROVIDER` gets a copilot that boots
   cleanly, passes every health check, appears in the UI, and answers every
   question with the same sentence. `CopilotPlugin`'s eager validation
   (`copilot-plugin.ts:53-90`) is thorough about *misconfiguration* — no
   providers, no models, a `defaultProvider` naming nothing, a non-positive
   `maxOutputTokens` — and cannot catch this one, because `fake` **is**
   registered and **does** declare a model. The one check that would have caught
   it is the one nobody wrote.
2. **The catalogue.** `GET /api/copilot/models` serves
   `ModelRegistry.catalogue()` verbatim (`list-models.controller.ts:48-55`), so
   every user holding `copilot:use` sees **Fake** in the model picker as an
   ordinary choice, indistinguishable from a real backend.
3. **Per-run selection.** `CreateRunDto.provider` lets any caller name it
   (`create-run.dto.ts:169-173`), and an explicitly requested provider
   deliberately **wins over the host's resolver**
   (`run-engine.service.ts:243-248`). The reasoning there is sound — "the worst a
   caller can do is choose a backend the operator already configured" — and it is
   exactly why registering the fake unconditionally matters: the operator did not
   really choose it, the default did.

The AGENTS.md states the situation plainly ("it is the `COPILOT_PROVIDER`
default so a fresh clone boots without configuration") without treating it as a
production hazard. The developer-experience argument is genuinely good; the
missing half is a guard for the case where it is wrong.

**Repro:**
1. Build for production. Set `COPILOT_ENABLED=true`, `ANTHROPIC_API_KEY=<real>`,
   `NODE_ENV=production`. Leave `COPILOT_PROVIDER` unset.
2. Start the server; note it boots with no warning.
3. Ask the copilot anything in the admin.
→ Observed: "The fake copilot provider is active, so no model was called…"
/ Expected: either a boot refusal, or a real provider, or at minimum a loud
startup warning.
4. On a *correctly* configured production deployment, as any user with
   `copilot:use`, open the model picker.
→ Observed: **Fake** is offered.

**Blast radius.** Not a security escalation — the fake calls no tools in dev mode,
so it cannot write anything, and the audit trail records `provider: 'fake'` on
every message. The damage is a silently useless assistant on a real deployment,
and a catalogue entry every user can select. The subtler risk is the reverse
direction: an operator debugging "why is the AI giving the same answer?" has
nothing in the logs pointing at the cause.

**Suggested fix:** register the fake conditionally (`NODE_ENV !== 'production'`,
or an explicit `COPILOT_ALLOW_FAKE=true`), and log a startup warning whenever
`defaultProvider === 'fake'`. Keep the default for development — the DX argument
holds — but make production say something.

---

### 🐞 BUG-copilot-provider-fake-02 — `calls` records a live reference to the engine's mutable `messages` array, so a recorded request is not a snapshot · Severity: Medium

**Location:** `packages/copilot/provider-fake/src/lib/fake-provider.ts:54`, in
combination with
`packages/copilot/server/src/lib/chat/application/run-engine.service.ts:353,392-441,474-483`
**Category:** correctness (test integrity)

**What the code does.** The fake stores the request object by reference:

```typescript
const callIndex = calls.push(request) - 1;
```

The engine builds **one** `messages` array per run and passes it to every call:

```typescript
const messages = [...ctx.history];            // :353
…
const turn = yield* this.streamTurn(ctx, messages, tools);   // :374
…
messages.push({ role: 'assistant', content: [ … ] });        // :392
…
messages.push({ role: 'user', content: results });           // :441
```

and `streamTurn` hands that same array straight through:

```typescript
const stream = ctx.provider.provider.stream(
    { model: ctx.model, system: ctx.system, messages, … },     // :474-482
```

So `calls[0].messages`, `calls[1].messages` and `calls[2].messages` are **the
same array object**, and after the run it holds the *final* conversation — not
what was in front of the model on call 0.

**Why it is wrong.** The package's whole reason for exposing `calls` is
after-the-fact inspection: AGENTS.md calls it "the assertion target for the
negative path ADR-0005 makes mandatory", `config.ts:56-58` says "`calls` is the
assertion target for 'a viewer's run was never offered a write tool'", and
`config.ts:62` declares it "Every request served so far, in order". For `tools`
and `system` that holds (the engine allocates `tools` once and never mutates it,
and `system` is a string). For `messages` it does not, and `messages` is exactly
what a test asserting on prompt assembly — "was the attachment manifest in the
first call?", "did the tool result reach the second?" — would reach for.

**Repro:**
1. Script two turns: `[{ toolCalls: [{ name: 'fixture.readThing', input: { q: 'a' } }] }, { text: 'done' }]`.
2. Drive a run through the engine.
3. Assert `provider.calls[0].messages.length === 1` (the user turn only).
→ Observed: 3 — the assistant turn and the tool results the engine pushed *after*
call 0 returned are visible in call 0's record.
/ Expected: a snapshot of what was sent.

A test written the obvious way (`expect(calls[0].messages).toEqual([userTurn])`)
fails confusingly; a test written the *other* obvious way
(`expect(calls[0].messages.at(-1).content[0].text).toContain('…')`) **passes for
the wrong reason** — it is reading a later turn.

**Blast radius.** Test integrity only; no production behaviour depends on it.
But this is the package whose single job is to make downstream assertions
trustworthy, and this is the one field where an assertion can silently mean
something other than what it says. Note that no current spec asserts on
`calls[n].messages`, which is why nobody has hit it.

**Suggested fix:** shallow-copy on record —
`calls.push({ ...request, messages: [...request.messages] })` — or freeze it. A
deep copy is not needed; only `messages` is mutated by the engine.

---

### 🐞 BUG-copilot-provider-fake-03 — a mid-stream abort reports the usage of the whole reply, not the part that streamed · Severity: Low

**Location:** `packages/copilot/provider-fake/src/lib/fake-provider.ts:64-77`
**Category:** correctness

```typescript
const text = turn.text ?? '';
for (const piece of chunkText(text, chunkSize)) {
    if (signal?.aborted) {
        yield {
            type: 'done',
            stopReason: 'aborted',
            // Unlike a pre-flight abort, tokens were "produced" here,
            // so the partial usage is the honest number to report.
            usage: estimateUsage(request, text)
        };
        return;
    }
    yield { type: 'text-delta', text: piece };
}
```

The comment says "the partial usage is the honest number to report" and the code
passes `text` — the **complete** reply — to `estimateUsage`. An abort after one
of a hundred chunks reports the token count of all hundred.

**Why it is wrong.** It contradicts its own stated intent, and it makes the fake
*more* generous about usage than a real provider on the one path where usage
matters most. The run engine accumulates this into `ctx.usage` and persists it on
`copilot_messages.input_tokens` / `output_tokens`
(`run-engine.service.ts:376-377, 320-323`), which is what cost accounting reads.
It also feeds the `maxTotalTokens` ceiling, so a cancelled turn inflates the
budget consumed by the rest of the run.

**Repro:**
1. `const p = createFakeProvider({ script: [{ text: 'x'.repeat(400) }], chunkSize: 1 })`.
2. Start draining; abort the controller after the third `text-delta`.
→ Observed: `done.usage.outputTokens === 100` (400/4).
/ Expected: ≈ 1 — three characters were produced.

**Blast radius.** Small: the fake is not billed, and the divergence only shows up
in tests that assert on usage after a cancel — of which there are none. It is
reported because the comment asserts a property the code does not have, which is
the shape of thing that gets copied.

**Suggested fix:** track the emitted prefix and pass that:
`estimateUsage(request, text.slice(0, emitted))`.

---

### 🐞 BUG-copilot-provider-fake-04 — the tool-call loop has no abort check, so calls are emitted after cancellation · Severity: Low

**Location:** `packages/copilot/provider-fake/src/lib/fake-provider.ts:79-87`
**Category:** correctness / divergence

```typescript
const toolCalls = turn.toolCalls ?? [];
for (const [index, call] of toolCalls.entries()) {
    yield { type: 'tool-call', id: call.id ?? `fake-tool-${callIndex}-${index}`, name: call.name, input: call.input };
}
```

The text loop checks `signal?.aborted` on every iteration (`:66`); this one does
not check at all. A signal that aborts after the last text delta and before the
tool calls is not observed, and every scripted call is still emitted.

**Why it matters.** Neither real adapter can do this: Anthropic reads tool calls
from `finalMessage()` inside the `try`, so an abort rejects before any are
emitted (`anthropic-provider.ts:70-95`); OpenAI drains its accumulator after a
loop over a `fetch` body that the abort tears down
(`openai-provider.ts:99,104-108`). So the fake produces a stream shape production
cannot, and the engine's `loop` — which checks `signal.aborted` only at step
boundaries (`run-engine.service.ts:360`) — will happily execute those tool calls,
including a write, after the user pressed Stop.

**Repro:** script `{ text: 'ok', toolCalls: [{ name: 'fixture.readThing', input: {} }] }`, abort between the last text delta and the tool call, and drain. The `tool-call` event still arrives.

**Blast radius.** Test-only today, because reaching this window requires an abort
landing inside one microtask boundary. It becomes a real divergence the moment
anyone writes a "Stop cancels an in-flight write" test against the fake and
concludes the engine is safe.

**Suggested fix:** check `signal?.aborted` at the top of the tool-call loop too,
and yield `abortedEvent()`.

---

### Checked and cleared

Specifically hunted, specifically not a defect:

- **Does it import a vendor SDK?** No. `package.json:20-22` lists exactly one
  dependency, `@ortha-cms/copilot-domain`; grepping every import in `src/` finds
  five statements, all resolving to that package or a sibling file. No `fetch`,
  no `http`, no `Date`, no `Math.random`, no timers. **ADR-0004 §1 holds.**
- **Do the scripted responses cover the tool-call path?** Yes, and thoroughly at
  the *consumer* end: `apps/server-e2e/src/support/copilot-fixture-tools.ts`
  ships four fixture tools (read, propose, apply, thrower) and the copilot specs
  script single calls, two calls in one turn, repeated identical calls, a
  hallucinated name, bad arguments, and nine consecutive turns. Everything the
  run engine does with a tool call is reachable through this provider.
- **Stream-event ordering vs the real adapters.** All three emit text before tool
  calls before exactly one `done`, so the engine's assumption that `streamTurn`'s
  return value is complete holds on every provider. The *reason* differs
  (Anthropic reads `finalMessage()`, OpenAI drains an accumulator, the fake reads
  a script), but the contract is the same.
- **Does an unlisted model corrupt state?** No — `resolveModel` runs before
  `calls.push` and before `script.next()` (`fake-provider.ts:53-57`), so a
  rejected model neither records a call nor consumes a turn. Anthropic
  (`:47`) and OpenAI (`:57`) resolve at the same point, for the stated reason
  ("a run naming a model this provider doesn't offer is the caller's error, not
  an abort to be swallowed").
- **Does the script advance on a pre-flight abort?** Yes, deliberately and with
  a comment explaining why (`fake-provider.ts:55-57`) — "the run happened, it just
  didn't finish". Correct: a test asserting "two model calls were made" should not
  be defeated by one of them being cancelled.
- **`models` array aliasing.** Spread at construction (`fake-provider.ts:43`), so
  mutating the caller's array afterwards cannot change what the provider offers —
  the same defence `buildModelRegistry` applies at the registry level.
- **`chunkSize` guard.** `Math.max(1, …)` (`:42`) makes 0 and negatives safe;
  no infinite loop is reachable.
- **Exhaustion is a throw, not an invented turn.** The right call, and the
  message names both the script length and the call index, which is what makes a
  CI failure diagnosable. `script.ts:29-34`.
- **Determinism.** No clock, no randomness, no I/O; `estimateUsage` is a pure
  function of the request and the reply. Two identical drains are deep-equal
  (`fake-provider.spec.ts:32`).

---

## 7. Recommended E2E Tests

Almost everything belongs in the package's own jest suite — this unit has no
route to drive and no page to render. The two exceptions are marked.

| Priority | Harness | Proposed spec | Asserts | Closes |
| --- | --- | --- | --- | --- |
| 1 | `apps/server-e2e` testcontainer + supertest, **or** a boot-time unit test on `apps/server` | `server/copilot/copilot-provider-guard.spec.ts` (new) | With `NODE_ENV=production` and `COPILOT_PROVIDER` unset, the host either refuses to register `fake` or logs a startup warning; `GET /api/copilot/models` does not offer `fake` in production | 🐞 BUG-copilot-provider-fake-01, F21 |
| 2 | 🧪 `packages/copilot/provider-fake` | `fake-provider.spec.ts` (extend) | `calls[n]` is a **snapshot**: mutate `request.messages` after the drain and assert the recorded call is unchanged | 🐞 BUG-copilot-provider-fake-02, F17 |
| 3 | 🧪 same | `fake-provider.spec.ts` (extend) | A mid-stream abort ends the stream after the emitted prefix, reports usage proportional to **what streamed**, and emits no further events | 🐞 BUG-copilot-provider-fake-03, F13 |
| 4 | 🧪 same | `fake-provider.spec.ts` (extend) | An abort landing between the text and the tool calls suppresses the tool calls | 🐞 BUG-copilot-provider-fake-04, EC-17 |
| 5 | 🧪 same | `fake-provider.spec.ts` (extend) | The exhaustion message names the script length **and** the call index; `script: []` throws on the first call rather than serving the dev reply | F4, EC-02, EC-16 |
| 6 | 🧪 same | `usage.spec.ts` (new) | `estimateUsage` over a request carrying `text`, `tool_use` and `tool_result` blocks plus `system` and `tools`; a per-turn `usage` override wins; the numbers are stable across runs | F10, F11, EC-06 |
| 7 | 🧪 same | `fake-provider.spec.ts` (extend) | An explicit `stopReason` overrides the `tool_use` inference; `toolCalls: []` infers `end`; a `{}` turn emits only `done` | F9, EC-03, EC-04 |
| 8 | 🧪 same | `text.spec.ts` (new) | `chunkText` at length ± 1 and at exactly `size`; `chunkSize` 0 and negative floor to 1; the astral-plane split is pinned so a future switch to `Array.from` is a deliberate change | F19, EC-07, EC-08 |
| 9 | 🧪 same | `fake-provider.spec.ts` (extend) | An unlisted model leaves `calls` empty **and** the script unadvanced (so a rejected model does not silently consume a turn) | F15 |
| 10 | 🧪 same | `fake-provider.spec.ts` (extend) | `DEV_MODE_REPLY`'s content — export it first, so a change to the sentence has to be a deliberate one | F2 |
| 11 | Lint / CI rule, not a spec | eslint `no-restricted-imports` or an Nx dependency constraint on `provider-fake` | The package may import only `@ortha-cms/copilot-domain` — ADR-0004 §1 enforced by a machine rather than by review | F20 |
| 12 | 🧪 same | `fake-provider.spec.ts` (extend) | Two overlapping `stream()` calls on one instance are documented as unsupported (assert the interleaving, or add a guard that throws) | EC-14 |
| 13 | `apps/server-e2e` | `server/copilot/copilot-chat.spec.ts` (extend) | Script `stopReason: 'max_tokens'` and `'refusal'` and assert the run's `max-output-tokens` / `refusal` stop reasons — the two provider stop reasons no spec currently produces | F9, and `docs/testing/copilot-server.md` F20 |
| 14 | Documentation, not a test | `packages/copilot/provider-fake/AGENTS.md` | Record the divergence table from §4 — particularly that OpenAI assembles tool calls from fragments and the fake does not, so a CI-green tool-call path proves nothing about the OpenAI adapter | EC-17 |
