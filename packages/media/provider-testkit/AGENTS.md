# @orthacms/media-provider-testkit

The **`StorageProvider` contract, as a runnable suite**. One export,
`describeStorageProvider(name, harness)`, which any provider package calls from
its own spec.

It exists because the port's invariants used to live only in prose, in
`provider-local/AGENTS.md`. Every one of them is a claim the media core relies
on and cannot check for itself — it reclaims blobs by key, streams `get`
straight into an HTTP response, and stores derivatives beside originals — so a
provider written outside this repo had no way to discover it broke one.

## Using it

```typescript
describeStorageProvider('media-provider-local', {
    create: () => createLocalStorageProvider({ rootDir: mkdtempSync(…) }),
    cleanup: (provider) => rmSync(rootFor(provider), { recursive: true }),
    storedKeys: (provider) => walk(rootFor(provider))
});
```

- **`create`** runs per case, so a provider holding state hands out a fresh one
  and cases cannot leak into each other.
- **`storedKeys`** is optional but wanted: it turns the all-or-nothing check
  from "the promise rejected" into "and it left nothing behind", which is the
  half that matters — a failed `put` never handed its key back, so anything it
  leaves is unreachable garbage no caller can reclaim.

## What it asserts

- **identity** — a non-empty `id`, a complete `capabilities`, and `directUrl()`
  present exactly when `capabilities.directUrl` says so.
- **`put`** — true size and sha256; bytes round-trip through `get`; two assets
  with the same file name get distinct keys; a derivative never collides with an
  original called `thumb.webp`; a body that fails mid-stream leaves nothing.
- **`get`** — rejects for a key that was never written, and for one that was
  removed. Rejecting *before* the stream opens is the point: the download route
  turns a rejection into a 404, and once bytes flow the response is a streaming
  200 that can no longer become one.
- **`remove`** — idempotent, and a no-op for a key that never existed. Reclaim
  is post-commit and best-effort; a provider that threw here would add noise
  nobody can act on.
- **everything rejects rather than throwing synchronously** — a sync throw lands
  outside the `try` that was meant to reclaim the blobs.

## Adding a case

Add one only for something **every** backend must do. A rule that is true of a
filesystem and meaningless for an object store belongs in that package's own
spec — the kit is the shared contract, and a filesystem-shaped kit is how a
remote provider ends up failing for the wrong reason.

## Commands

- `npx nx typecheck @orthacms/media-provider-testkit` /
  `npx nx lint @orthacms/media-provider-testkit`
- `npx nx test @orthacms/media-provider-testkit` — the kit against its own
  reference in-memory provider, so a suite no correct implementation passes
  cannot ship unnoticed. Its real consumers are `@orthacms/media-provider-local`
  and `@orthacms/media-provider-memory`.
