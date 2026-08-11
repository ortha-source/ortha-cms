# @ortha-cms/media-provider-s3 — Test Artifact

> **Unit:** `packages/media/provider-s3` · **Package:** `@ortha-cms/media-provider-s3` · **Kind:** adapter (storage provider) — **stub**
> **Source of truth:** `packages/media/provider-s3/AGENTS.md`
> **Findings verified:** 2026-08-11 — 5 confirmed · 0 deleted · 2 corrected · 0 unverified
> **Generated:** 2026-08-11

## 1. Scope & Preconditions

**Owns:** `createS3StorageProvider(config)`, a **stub** `StorageProvider` whose
four methods all raise `S3NotImplementedError`. Its stated purpose is to prove the
routing seam — that the composition root can register a second provider under a
name and a `StorageResolver` can route to it — without pulling in an AWS
dependency.

**Does NOT own:** anything real. There is no AWS SDK dependency, no bucket/key
construction, no signed-URL generation, no retry policy, no credential handling.
The 47-line source file is reproduced almost in full in §6 because it is the whole
unit.

**The single most important fact:** `apps/server/src/plugins.ts:86-90` registers
**only** `local`. This package is never constructed in the shipped host, never
loaded in any e2e run, and never exercised in CI. Consequently **any behaviour
that differs between the two adapters is invisible to every automated check the
repo has** — which is precisely the risk class the brief calls out, and why §6's
findings are about *contract divergence* rather than about S3 itself.

- **Entry points**
  - `createS3StorageProvider(config: S3StorageConfig): StorageProvider` —
    `packages/media/provider-s3/src/lib/s3-storage-provider.ts:27`
  - `S3StorageConfig = { bucket: string; region: string }` — `.../s3-storage-provider.ts:5`
  - `S3NotImplementedError` — `.../s3-storage-provider.ts:11` (**not exported**;
    `packages/media/provider-s3/src/index.ts` re-exports only the factory and the
    config type, so a caller cannot `instanceof`-test the failure)

- **Runtime prerequisites**
  - None. It needs no network, no credentials, and no bucket — every call fails
    before touching anything.
  - To exercise it at all, a host must edit `apps/server/src/plugins.ts` to pass
    `s3: createS3StorageProvider(config.plugins.media.s3)` into
    `MediaServerPlugin({ providers })`, and supply a `resolve` handler or set
    `defaultProvider: 's3'`. The package's AGENTS.md explicitly warns: "Until then,
    don't register it as the `defaultProvider`."

- **How to exercise it manually**
  ```typescript
  // apps/server/src/plugins.ts — temporary, for testing only
  MediaServerPlugin({
      providers: {
          local: createLocalStorageProvider(config.plugins.media.local),
          s3: createS3StorageProvider(config.plugins.media.s3)
      },
      resolve: (ctx) => (ctx.kind === 'video' ? 's3' : 'local'),
      config: config.plugins.media
  });
  ```
  Then `npm run dev` and upload an `.mp4`. Everything in §3 flows from that one
  edit; no step in this artifact requires AWS.

- **Dependencies that must be healthy:** only the `StorageProvider` type from
  `@ortha-cms/media-server` (erased at runtime). The package has no runtime deps.

## 2. Feature Inventory

| # | Feature | Where it lives | Coverage |
| --- | --- | --- | --- |
| F1 | `createS3StorageProvider(config)` returns an object satisfying `StorageProvider` | `packages/media/provider-s3/src/lib/s3-storage-provider.ts:27-47` | ❌ NONE |
| F2 | The registry can hold it under a name and `StorageResolver` can route to it | `packages/media/server/src/lib/infrastructure/storage-registry.ts:11`, `.../media.module.ts:73` | ❌ NONE |
| F3 | `put` raises `S3NotImplementedError` | `.../s3-storage-provider.ts:34-36` | ❌ NONE |
| F4 | `get` raises `S3NotImplementedError` | `.../s3-storage-provider.ts:37-39` | ❌ NONE |
| F5 | `remove` raises `S3NotImplementedError` | `.../s3-storage-provider.ts:40-42` | ❌ NONE |
| F6 | `url` raises `S3NotImplementedError` | `.../s3-storage-provider.ts:43-45` | ❌ NONE |
| F7 | `config` (`bucket`, `region`) is accepted and **ignored** | `.../s3-storage-provider.ts:28-29` (`eslint-disable … no-unused-vars`) | ❌ NONE |
| F8 | Signature parity with `createLocalStorageProvider`, so switching is a config change | both factories | ❌ NONE |

**Not implemented at all** (each is a documented follow-up, and each is where the
brief's S3-specific hunt would go once the adapter is real): signed-URL expiry and
scope; bucket/key construction from user input; region/endpoint configuration;
retry/timeout behaviour; credential handling and redaction in logs; 5xx mid-upload
recovery; multipart upload; server-side encryption. **None of these can be tested
today, and §6 says so rather than inventing findings about code that does not
exist.**

## 3. Manual Test Plan

Every block below assumes the temporary registration from §1.

### F1 — The factory returns a usable object

**Preconditions:** none.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `const p = createS3StorageProvider({ bucket: 'b', region: 'eu-west-1' })` | resolves synchronously; no network, no credential lookup |
| 2 | `typeof p.put === 'function' && typeof p.get === 'function' && typeof p.remove === 'function' && typeof p.url === 'function'` | `true` for all four |
| 3 | `createS3StorageProvider({ bucket: '', region: '' })` | **also succeeds** — the config is never validated (see EC-08) |

**Keyboard-only / screen reader:** Not Applicable — no UI.

### F2 — The routing seam

**Preconditions:** both providers registered, `resolve` routing videos to `s3`.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Boot the server | starts cleanly; `buildRegistry` holds `local` and `s3` |
| 2 | Upload `logo.png` | routed to `local`; `media_asset.storage_provider = 'local'` |
| 3 | Upload `clip.mp4` | routed to `s3`; the upload **fails** (F3) — see the exact failure mode in §4 |
| 4 | Change `resolve` to always return `local`, restart, and download `logo.png` | still served by `local` — routing is recorded at write, never re-run (`download-asset.query.ts:86`) |
| 5 | Point `resolve` at a name that is not registered (`'gcs'`) | `buildRegistry.get` throws `Error("Unknown storage provider: gcs")` → an opaque `500` |

### F3 — `put`

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Upload a video with `s3` routing | `500`; the response body carries a generic message, the log carries `S3NotImplementedError: @ortha-cms/media-provider-s3 is a stub …` |
| 2 | Confirm no row is written | `SELECT * FROM media_asset WHERE name = 'clip.mp4'` → empty |
| 3 | Confirm the reclamation path | `written` is empty, so the `catch` at `upload-asset.use-case.ts:170` has nothing to remove — **but see `🐞 BUG-media-provider-s3-01` for what happens when it is not empty** |

### F4 — `get`

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Insert a row by hand with `storage_provider = 's3'` and `GET /api/media/assets/<id>/raw` | `DownloadAssetQuery.open` calls `provider.get`, which throws **synchronously** inside an `async` method, so it surfaces as a rejection → `500` |
| 2 | Compare with `local`'s missing-file behaviour | `local` returns a `200` with a truncated body (`🐞 BUG-media-provider-local-03`); `s3` returns a `500`. **Two adapters, two different failure shapes for "the bytes are unavailable".** |

### F5 — `remove`

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Bulk-delete an asset whose `storage_provider = 's3'` | the row is deleted (the transaction commits first); `reclaimAssetBlobs` catches the throw and swallows it (`reclaim-asset-blobs.ts:18-23`) → `200 { deleted: 1 }` |
| 2 | Cascade-delete a folder holding such an asset | same — the cascade succeeds, the "blob" is never reclaimed |
| 3 | Trigger the **upload rollback** path with `s3` (see EC-05) | the synchronous throw escapes `Promise.all`'s callback → `🐞 BUG-media-provider-s3-01` |

### F6 — `url`

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `await p.url('any/key')` | rejects with `S3NotImplementedError` |
| 2 | Compare with `local` | `local` **resolves** to `/api/media/blob/any%2Fkey`, a path no route serves (`🐞 BUG-media-provider-local-05`) |
| 3 | Confirm nothing calls it | `grep -rn "\.url(" packages/media` finds no caller — `AssetView.url` comes from `to-asset-view.ts:26` |

### F7 — Config is ignored

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Construct with a deliberately wrong bucket/region | no error, ever — the parameter carries an `eslint-disable` for `no-unused-vars` (`s3-storage-provider.ts:28`) |
| 2 | Grep for `S3StorageConfig` usage | referenced only in the signature and by `MediaS3Config` in `media-config.ts`; nothing reads `bucket` or `region` |

### F8 — Signature parity

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Swap `createLocalStorageProvider(cfg.local)` for `createS3StorageProvider(cfg.s3)` in `plugins.ts` and typecheck | compiles — the "switching providers is a config change" claim holds **at the type level** |
| 2 | Run `npx nx e2e server-e2e` with that swap | every media suite fails on the first upload — the claim does **not** hold at runtime, which is what "stub" means |

## 4. Edge Cases & Negative Paths

### The one behaviour it has: failing

- **EC-01 — All four methods throw synchronously, not asynchronously.** `❌ NONE`
  ```typescript
  put(): Promise<StorageObject> { throw new S3NotImplementedError(); }
  ```
  These are **not** `async` functions (`s3-storage-provider.ts:33-46`). A declared
  `Promise` return type does not make a `throw` into a rejection — the exception
  propagates on the caller's stack at the call site. `local`'s four methods are all
  `async`, so they reject. This is the central divergence →
  `🐞 BUG-media-provider-s3-01`.
- **EC-02 — `await provider.put(...)` inside `try/catch`.** `❌ NONE`
  Works identically for both adapters — the synchronous throw is caught by the same
  `catch`. This is why the divergence hides: the *common* call shape masks it.
- **EC-03 — `provider.remove(key).catch(() => undefined)`.** `❌ NONE`
  `upload-asset.use-case.ts:174-176` and `duplicate-asset.use-case.ts:134` both use
  exactly this shape. With `s3`, `provider.remove(key)` throws **before** `.catch`
  is attached, so the suppression never runs. → `🐞 BUG-media-provider-s3-01`.
- **EC-04 — `Promise.all(keys.map(k => provider.remove(k)))`.** `❌ NONE`
  `reclaim-asset-blobs.ts:20` — but that one is wrapped in an outer `try/catch`
  (`:448`), so it is safe. Only the two upload/duplicate rollback sites are exposed.
- **EC-05 — Upload rollback with `s3` after a successful `put`.** `❌ NONE`
  Unreachable today (`put` never succeeds), and that is exactly why the bug will
  ship undetected the day `put` is implemented: the first real S3 upload that hits
  a transaction rollback will replace the real error with whatever `remove` throws.
- **EC-06 — `S3NotImplementedError` is not exported.** `❌ NONE`
  `packages/media/provider-s3/src/index.ts` exports the factory and the config type
  only. A host wanting to map the failure to a `501` cannot `instanceof` it and
  must match on `error.name === 'S3NotImplementedError'` or the message string.
  → `🐞 BUG-media-provider-s3-02`.
- **EC-07 — The error is a bare `Error`.** `❌ NONE`
  `media-server`'s `toHttp` only recognises its own domain errors and rethrows
  everything else (`http/to-http.ts:15-29`), so this becomes a `500`. `.cursor/BUGBOT.md`
  makes the analogous point for tools ("Bare `Error` in a shared tool's handler …
  returns an opaque 500 with the message withheld"); the same reasoning applies to
  a provider whose failure is a *configuration* mistake, not a server fault. A
  `501 Not Implemented` would name the problem.
- **EC-08 — Empty / malformed `bucket` or `region`.** `❌ NONE`
  Never validated, never read. When the adapter is implemented, this becomes the
  first thing to check: `local`'s config is likewise unvalidated, but a bad
  `rootDir` fails loudly on the first `mkdir`, whereas a bad `bucket` would fail
  per-request against AWS.
- **EC-09 — Registering `s3` as `defaultProvider`.** `❌ NONE`
  Boot **succeeds** — nothing validates that the default provider can actually
  store anything. Every subsequent upload `500`s. AGENTS.md says "don't", and
  nothing enforces it. → `🐞 BUG-media-provider-s3-04`.
- **EC-10 — A `StorageResolver` returning `'s3'` for some uploads only.** `❌ NONE`
  Half the library works and half `500`s, with no signal at boot. Same finding.

### Divergence matrix (the highest-value content in this artifact)

| Behaviour | `provider-local` | `provider-s3` (stub) | Port says (`domain/storage-provider.ts`) | Visible in CI? |
| --- | --- | --- | --- | --- |
| Failure delivery | rejected promise (all `async`) | **synchronous throw** | `Promise<…>` (implies rejection) | ❌ — S3 never runs |
| `remove` of a missing key | no-op, resolves (`{ force: true }`) | **throws** | ":43 Idempotent — a missing key is a no-op" | ❌ |
| `get` of a missing key | **resolves**, then the stream errors | throws | ":41 Rejects if the key is gone" | ❌ |
| `url(key)` | resolves to `/api/media/blob/<%2F-encoded key>` | throws | ":44-49 a direct URL a browser could fetch" | ❌ |
| `contentType` on `PutObject` | **ignored** (no filesystem metadata) | n/a | ":19" passed to both | ❌ |
| `isVariant` namespace | honoured (`variants/` prefix) | n/a | ":22-28" providers must namespace | ❌ |
| Key shape | `<ws>/<asset>[/variants]/<sanitized name>` | n/a | opaque | ❌ |
| Error type | node `Error` (`ENOENT`, `EACCES`, `EISDIR`) | `S3NotImplementedError`, unexported | unspecified | ❌ |
| Config validation | none (bad `rootDir` fails at first write) | none (never read) | unspecified | ❌ |

**Not one row of that table is asserted anywhere.** The port is a four-method
interface with prose contracts and zero conformance tests, which is why the two
implementations disagree on three of them (`remove` idempotency, `get` on a
missing key, `url`) and neither matches the documentation on all three.

### 4A. Accessibility & Section 508 Conformance

This adapter renders no UI and, being a stub, produces no content at all. Every
WCAG 2.1 AA success criterion is **Not Applicable**. The one provision with
anything to say is Section 508 **504.2.1 (preservation of accessibility
information)** — and it applies prospectively, to the adapter that has not been
written yet.

**Baseline:** ❌ — no a11y suite, and none is applicable.

#### ♿ A11Y-media-provider-s3-01 — Prospective: an S3 implementation must not become the authority for accessibility metadata the local adapter cannot hold
**WCAG:** 1.1.1 Non-text Content (A) (indirect) · **508:** 504.2.1 · **Verdict: Not Applicable (today)**
**Location:** `packages/media/provider-s3/src/lib/s3-storage-provider.ts:33-46` (unimplemented), contract at `packages/media/server/src/lib/domain/storage-provider.ts:15-29`
`PutObject` carries `contentType` and `fileName` into both adapters.
`provider-local` drops both (a filesystem holds no metadata beyond the name), while
the natural S3 implementation would set `ContentType` and probably `Metadata` on
the object. Alt text, dimensions and kind live on `media_asset`
(`packages/media/server/src/lib/infrastructure/schema/media-asset.ts:62`), so today
nothing accessibility-bearing is in the object store at all — 504.2.1 is satisfied
by having nothing to preserve.
**The risk to record now:** if the S3 adapter writes object metadata and a future
"rebuild the library from the bucket" path reads it back, then assets restored
from S3 would carry information that assets restored from local disk would not —
an accessibility round-trip that succeeds or fails depending on which backend
happened to be routed to. That is the provider-divergence failure mode applied to
a11y data.
**Remediation:** when implementing, decide explicitly that `media_asset` is the
sole authority for accessibility metadata and that object metadata is decorative;
document it in `packages/media/provider-s3/AGENTS.md` beside the "When implemented"
section, and add the shared conformance suite from §7 so the decision is asserted
rather than remembered.

#### ♿ A11Y-media-provider-s3-02 — Prospective: signed URLs would change how media is delivered to assistive technology
**WCAG:** 1.1.1, 1.2.2 (indirect) · **508:** 502.2 · **Verdict: Not Applicable (today)**
**Location:** `packages/media/provider-s3/AGENTS.md` ("return a **signed URL** from `url` so the browser can fetch S3 directly")
Today every byte flows through `GET /api/media/assets/:id/raw`, which sets
`Content-Type` from the row. If `AssetView.url` starts pointing at S3 for
S3-backed assets, the type served becomes S3's stored `ContentType`, the CMS loses
the one place it could sanitise or force-download it (`🐞 BUG-media-server-01`),
and a URL with an expiry lands in stored rich-text content
(`wysiwyg/admin`'s `mediaSrc` accepts any `https:` URL) — so a published body would
contain image sources that stop resolving, presenting to a screen-reader user as an
image with alt text and no image.
**Remediation:** when signed URLs land, keep stored content pointing at the CMS's
own stable route and use the signed URL only for the immediate response; never
persist a signed URL into a `richtext` body.

## 5. E2E Coverage Map

| Feature | Spec | Asserts | Verdict |
| --- | --- | --- | --- |
| F1 factory | — | — | ❌ NONE |
| F2 routing seam | — | — | ❌ NONE — the seam this package exists to prove is **never proven**; `apps/server/src/plugins.ts:86-90` registers one provider, so no test ever routes between two |
| F3 `put` | — | — | ❌ NONE |
| F4 `get` | — | — | ❌ NONE |
| F5 `remove` | — | — | ❌ NONE |
| F6 `url` | — | — | ❌ NONE |
| F7 config ignored | — | — | ❌ NONE |
| F8 signature parity | `npx nx typecheck @ortha-cms/media-provider-s3` | that the object satisfies `StorageProvider` **structurally** | ⚠️ PARTIAL — a typecheck is the only verification this package has |
| a11y | — | — | ❌ NONE (Not Applicable) |

`grep -rn "media-provider-s3\|createS3StorageProvider" apps packages` matches only
this package's own files, `packages/media/server/src/lib/types/media-config.ts`
(the unused `MediaS3Config`), and documentation. **There is no import of this
package anywhere in the running system.**

**Coverage tally:** `8 features · 0 ✅ · 1 ⚠️ · 7 ❌`

## 6. 🐞 Potential Bugs

### 🐞 BUG-media-provider-s3-01 — Every method throws synchronously instead of rejecting, which breaks two rollback paths that are correct against the local provider · Severity: Medium

**Location:** `packages/media/provider-s3/src/lib/s3-storage-provider.ts:33-46`
**Category:** correctness / behavioural divergence between adapters

**What the code does:**
```typescript
return {
    put(): Promise<StoredObject> {
        throw new S3NotImplementedError();
    },
    get(): Promise<Readable> {
        throw new S3NotImplementedError();
    },
    remove(): Promise<void> {
        throw new S3NotImplementedError();
    },
    url(): Promise<string> {
        throw new S3NotImplementedError();
    }
};
```
None of the four is `async`. A function annotated `Promise<T>` that `throw`s
propagates the exception **on the caller's stack**, before any promise exists.
`createLocalStorageProvider`'s four methods are all `async`
(`packages/media/provider-local/src/lib/local-storage-provider.ts:49, 71, 75, 79`),
so the same failures arrive as rejections there.

**Why it is wrong:** two production call sites attach `.catch` to the returned
promise rather than wrapping the call:
```typescript
// packages/media/server/src/lib/application/use-cases/upload-asset.use-case.ts:173-177
await Promise.all(
    written.map((key) => provider.remove(key).catch(() => undefined))
);
throw error;
```
and the identical shape at `duplicate-asset.use-case.ts:132-136`. With a
synchronously-throwing `remove`, `provider.remove(key)` raises **before**
`.catch(...)` is evaluated, so the "best-effort, never mask the real failure"
suppression does not run. The exception escapes the `map` callback, escapes
`Promise.all`'s argument construction, and escapes the enclosing `catch (error)`
block — **replacing the original error with `S3NotImplementedError` and skipping
`throw error` entirely**. The caller then sees the wrong cause, and any partially
written blobs after the failing key are never reclaimed.

`reclaim-asset-blobs.ts:18-23` gets this right by accident — it wraps the whole
`Promise.all` in a `try/catch` — which is exactly how a divergence like this
survives review: one of three call sites is safe and two are not.

**Repro (does not require AWS):**
1. Register both providers with `resolve: () => 's3'` and give the stub a working
   `put` that returns a fake key (three lines), leaving `remove` as-is.
2. Upload a file into a `folderId` belonging to another workspace, so the
   transaction throws `FolderNotFoundError` after `put` succeeded.
→ Observed: the route returns a `500` whose cause is `S3NotImplementedError`, not
the `404` the `FolderNotFoundError` would have produced; `written` is never drained.
→ Expected: the `404`, with the blob reclaimed (or the reclamation failure
swallowed).
3. Against `local`, the identical sequence returns `404` and cleans up — proving
the two adapters are not substitutable.

**Blast radius:** today, latent — verified: `apps/server/src/plugins.ts:84` mentions
`createS3StorageProvider` only inside a comment, so the stub is registered in no
shipped host and `registry.get('s3')` would throw "Unknown storage provider" before
any of this is reached. The moment anyone implements `put` (the stated next step in
AGENTS.md) and keeps this call style, every S3-backed upload rollback reports the
wrong error and leaks blobs. Because CI runs `local` only, no test will catch it.
**Severity corrected from High to Medium** on that basis: there is no reachable
exploit or data-loss path in any shipped configuration.

**Suggested fix:** mark all four methods `async` so a `throw` becomes a rejection —
a one-word change that makes the stub honest — and, independently, harden the two
call sites to `Promise.allSettled(written.map(async (key) => provider.remove(key)))`
so no provider can break them again.

---

### 🐞 BUG-media-provider-s3-02 — `remove` throws for a key it does not hold, violating the port's explicit idempotency contract · Severity: Medium

**Location:** `packages/media/provider-s3/src/lib/s3-storage-provider.ts:40-42`, contract at `packages/media/server/src/lib/domain/storage-provider.ts:42-43`
**Category:** correctness / behavioural divergence

**What the code does:** `remove(): Promise<void> { throw new S3NotImplementedError(); }`
— unconditionally, for every key.

**Why it is wrong:** the port states, in as many words:
```typescript
/** Removes a stored object. Idempotent — a missing key is a no-op. */
remove(storageKey: string): Promise<void>;
```
`provider-local` honours it with `rm(path, { force: true })`
(`local-storage-provider.ts:76`). The stub does not, and — more importantly — the
*eventual* S3 implementation is at real risk of not honouring it either: S3's
`DeleteObject` is idempotent, but a `HeadObject`-then-`DeleteObject` implementation,
or one that surfaces a `403` from a bucket policy, would throw where local
no-ops. The contract is stated once in a comment and asserted nowhere.

**Repro:** with `s3` registered, delete an asset whose `storage_provider = 's3'`.
→ Observed: the row is deleted and the throw is swallowed by
`reclaimAssetBlobs`'s outer `catch` — so the operation *appears* to succeed while
the contract is violated silently. Deleting the same asset's derivative keys
individually would surface the throw.
→ Expected: `remove` resolves for a key the provider does not hold.

**Blast radius:** silent divergence; the only observable symptom is the wrong error
in the two rollback paths of `🐞 BUG-media-provider-s3-01`.

**Suggested fix:** when implementing, make `remove` swallow `NoSuchKey` /
`404` explicitly, and add the shared conformance suite in §7 so this is asserted
for every registered provider rather than remembered per adapter.

---

### 🐞 BUG-media-provider-s3-03 — `url` throws where the local adapter resolves, so the two "implementations" of one port disagree on whether the operation exists · Severity: Low

**Location:** `packages/media/provider-s3/src/lib/s3-storage-provider.ts:43-45` vs `packages/media/provider-local/src/lib/local-storage-provider.ts:79-83`
**Category:** correctness / behavioural divergence

**What the code does:** `s3.url()` throws; `local.url()` resolves to
`${publicBasePath}/blob/${encodeURIComponent(storageKey)}` — a path **no route
serves** (see `🐞 BUG-media-provider-local-05`).

**Why it is wrong:** the port documents `url` as returning a fetchable URL
(`domain/storage-provider.ts:44-49`). One adapter returns an unfetchable string,
the other refuses. A consumer added tomorrow — say, an `AssetView.url` that prefers
a direct URL when the provider offers one — would have to special-case both, and
would silently emit dead links for local-backed assets.

**Repro:** `await local.url('k')` → `"/api/media/blob/k"` (`404` when fetched);
`await s3.url('k')` → rejects/throws.
→ Expected: one consistent behaviour, documented.

**Blast radius:** none today — nothing calls `url` (`grep -rn "\.url(" packages/media`
finds no caller). Purely a trap for the next implementer.

**Suggested fix:** until direct serving exists, have **both** adapters throw the
same documented `NotImplemented` error from `url`, and delete the misleading
`/blob/` string.

---

### 🐞 BUG-media-provider-s3-04 — Nothing prevents registering the stub as `defaultProvider`; boot succeeds and every upload 500s · Severity: Low

**Location:** `packages/media/server/src/lib/media.module.ts:73-74`, `packages/media/server/src/lib/infrastructure/storage-registry.ts:11-28`, `packages/media/provider-s3/AGENTS.md` ("don't register it as the `defaultProvider`")
**Category:** correctness (fail-late configuration)

**What the code does:**
```typescript
const resolver: StorageResolver = options.resolve ?? (() => options.defaultProvider);
```
`MediaModule.forRoot` never checks that `defaultProvider` names a registered
provider, let alone a working one. `buildRegistry` only throws on `get` — i.e. at
the first upload, per request.

**Why it is wrong:** the plugin conventions elsewhere validate eagerly and fail
boot rather than the first request — `I18nServerPlugin` validates its locale set at
construction, `ContentPlugin` builds its registry eagerly "failing boot rather than
the first request" (content-server AGENTS.md, _Architecture_). Media's storage seam
is the one configuration surface that defers. The consequence with a typo'd name
is identical to the consequence with the stub: uploads `500` and reads of existing
assets keep working, so the deployment looks healthy.

**Repro:**
1. Set `defaultProvider: 's3'` with only `{ local }` registered.
2. Boot → **succeeds**.
3. `POST /api/media/assets` → `500 "Unknown storage provider: s3"`.
→ Expected: boot fails with that message.

**Blast radius:** a misconfiguration that ships and is discovered by an author, not
by CI.

**Suggested fix:** in `MediaModule.forRoot`, assert
`options.resolve || registry.has(options.defaultProvider)` and throw at
construction; optionally let a provider declare `readonly implemented: boolean` so
a stub cannot be the default.

---

### 🐞 BUG-media-provider-s3-05 — `S3NotImplementedError` is not exported, so a host cannot map the failure to anything better than a 500 · Severity: Low

**Location:** `packages/media/provider-s3/src/lib/s3-storage-provider.ts:11-18`, `packages/media/provider-s3/src/index.ts`
**Category:** correctness / ux-state

**What the code does:** the error class is declared `class S3NotImplementedError
extends Error` with no `export`, and `src/index.ts` re-exports only
`createS3StorageProvider` and `S3StorageConfig`.

**Why it is wrong:** `media-server`'s `toHttp` maps only its own domain errors and
rethrows everything else (`packages/media/server/src/lib/http/to-http.ts:15-29`), so
this becomes an opaque `500` with the message withheld from the client. A host that
wants a `501 Not Implemented` — the honest status for "this backend is a stub" —
has no type to test against and must string-match `error.name`. `.cursor/BUGBOT.md`
makes the same argument for tool handlers: "Throw `NotFoundException` /
`BadRequestException` / etc. so the failure is legible."

**Repro:** register `s3`, upload, and read the response body.
→ Observed: `{"statusCode":500,"message":"Internal server error"}`; the real cause
appears only in the server log.
→ Expected: a status and message that name the misconfiguration.

**Blast radius:** debugging friction only.

**Suggested fix:** export the class from `src/index.ts`, or reuse a shared
`StorageNotImplementedError` from `media-server`'s `domain/errors/` and add it to
`toHttp` as a `501`.

---

**Tally:** 5 🐞 — 0 Critical, 0 High, 2 Medium, 3 Low. **All five are divergence
or fail-late findings; none is about S3 itself, because no S3 code exists.**
**♿ tally:** 2 — 0 Supports · 0 Partially Supports · 0 Does Not Support · 2 Not Applicable.

**Checked and cleared:** the object genuinely satisfies `StorageProvider`
structurally (the typecheck target passes); the factory has no side effects and
touches no network or credentials at construction; there are **no credentials, no
logging, and no error message anywhere in the package that could leak a secret**
(the only string is the fixed stub message) — so the brief's "credentials in logs
or error messages" hunt returns clean, necessarily; and `reclaimAssetBlobs`'s outer
`try/catch` does correctly contain the synchronous throw, unlike the two rollback
sites named in `🐞 BUG-media-provider-s3-01`.

**Explicitly not assessed, because the code does not exist:** signed-URL expiry and
scope, bucket/key construction from user input, region/endpoint configuration,
retry and timeout behaviour, 5xx-mid-upload recovery, multipart upload,
server-side encryption, and credential redaction. §7 proposes the harness that
should exist **before** any of that is written.

## 7. Recommended E2E Tests

| Priority | Harness | Proposed spec | Asserts | Closes |
| --- | --- | --- | --- | --- |
| 1 | package unit, shared and parameterised | `packages/media/server/src/lib/domain/storage-provider.conformance.ts` (a helper) + `packages/media/provider-{local,s3}/src/lib/*.conformance.spec.ts` | the port's prose contract, run against **every** adapter: all four methods return promises and never throw synchronously; `remove` of an absent key resolves; `get` of an absent key rejects; `url` either returns a fetchable string or throws a documented error; `isVariant` keys are namespaced away from originals | 🐞 BUG-media-provider-s3-01, -02, -03; 🐞 BUG-media-provider-local-03; EC-21…EC-25 |
| 2 | package unit | `packages/media/provider-s3/src/lib/s3-storage-provider.spec.ts` | the factory returns all four methods; each **rejects** (not throws) with an error whose `name` is `S3NotImplementedError`; the config is accepted without validation (pinning today's behaviour so a future implementation must change the test deliberately) | F1 ❌, F3–F7 ❌ |
| 3 | `apps/server-e2e` testcontainer + supertest | `src/server/media/media-storage-routing.spec.ts` | with **two** providers registered in the test host and a `resolve` handler, an upload lands on the routed provider, `media_asset.storage_provider` records it, and a later download routes by the **stored** name after the resolver is changed — the seam this package exists to prove | F2 ❌ |
| 4 | `apps/server-e2e` | same spec, boot case | `MediaServerPlugin({ defaultProvider: 'nope' })` fails **at boot**, not at the first upload | 🐞 BUG-media-provider-s3-04 |
| 5 | package unit (media-server) | `src/lib/application/use-cases/upload-asset.use-case.spec.ts` | with a fake provider whose `remove` throws synchronously, a rolled-back upload still surfaces the **original** error and still attempts every key | 🐞 BUG-media-provider-s3-01 |
| 6 | — (process, not a test) | before implementing the adapter | write the S3 test plan first: signed-URL expiry/scope, key construction from a hostile `fileName`, region/endpoint config, retry/timeout, 5xx mid-`put`, and a redaction assertion that no credential appears in any thrown message or log line | the "not assessed" list above |
