# @ortha-cms/media-server

The **media** bounded context — folders and assets for the Media Library, and
the provider-agnostic storage seam. It owns its schema (`media_folder`,
`media_asset`) and ships its own migrations. Bytes never live in the database:
each asset row carries a `storage_key` + `storage_provider` pointer, and the
actual blob is held by a `StorageProvider` implementation registered at the
composition root.

> **Layered per ADR-0003 (tactical DDD inside plugins).** New DB-backed context,
> born in the layered shape — reference: `packages/workspaces/server`.

## Layered layout

```
domain/          # framework-free core — the one hard rule below
  asset.ts / folder.ts             # aggregate roots (+ pullEvents)
  value-objects/                   # AssetId, FolderId, FileName, MediaKind, StorageKey
  storage-provider.ts              # StorageProvider PORT + StorageRegistry + StorageResolver + symbols
  asset.repository.ts / folder.repository.ts  # repo PORTs + symbols
  events/media-events.ts           # media.* domain-event factory + kinds
  errors/                          # transport-agnostic domain errors
application/     # orchestration — one use case per state change
  use-cases/                       # upload / update / delete assets; create / rename / delete folders
  dto/                             # class-validator DTOs (shape checks only)
infrastructure/  # adapters — the only layer that knows Drizzle/pg
  schema/  persistence/  queries/  storage-registry.ts
http/            # thin controllers (one per use case) + to-http error mapper
```

## The one hard rule

**`domain/` imports NOTHING from `@nestjs/*`, `drizzle-orm`, `class-validator`,
or `infrastructure/`.** Only `@ortha-cms/database`'s framework-free
`createDomainEvent`/`DomainEvent` and node built-ins. Self-enforce it (the
layer-boundary lint isn't wired yet).

## The storage seam (the whole point)

- **`StorageProvider`** (`domain/storage-provider.ts`) is a NestJS-free port:
  `put` / `get` / `remove` / `url`. Implementations ship as **separate
  packages** (`@ortha-cms/media-provider-local`, `-s3`) and are constructed at
  the host's composition root (`apps/server/src/plugins.ts`) — this package
  never imports a concrete backend.
- **`StorageRegistry`** holds the named providers; **`StorageResolver`** is an
  optional host-supplied handler `(ctx, registry) => name` that picks a provider
  per upload. Omit it and every upload uses `config.defaultProvider`.
- **Route at write, record at read.** The resolver runs only on upload; the
  chosen provider name is persisted on `media_asset.storage_provider`. Downloads
  and deletes route by that stored name — never re-run the resolver — so
  changing the handler never strands existing blobs.

## Use cases + unit-of-work + outbox

Each state change runs inside `UnitOfWork.run` over the repo ports +
`OutboxWriter`, so the row and its `media.*` event commit atomically. Upload
streams to the provider **before** the transaction (it needs a `storage_key`);
an orphan blob left by a rolled-back commit is reclaimed in a `catch`. Delete
removes the row in-transaction and reclaims the blob **post-commit**.

## HTTP surface (`/api/media`)

Every route carries `WorkspaceGuard` (X-Workspace-Id → `@CurrentWorkspace()`)
and a permission-by-constant (`PERMISSIONS.MEDIA_*`); state-changing routes add
`OriginGuard`. Upload uses `FileInterceptor('file')`; download streams via
`StreamableFile`. Folder delete is **409 when non-empty** (no cascade).

- `GET /media/folders` · `POST /media/folders` · `PATCH|DELETE /media/folders/:id`
- `GET /media/assets` (`?folderId=&search=&kind=&sort=&page=&pageSize=`) ·
  `POST /media/assets` (multipart) · `GET /media/assets/:id/raw` ·
  `PATCH /media/assets/:id` · `DELETE /media/assets` (bulk `{ ids }`)

## Register with the host

After `WorkspacesPlugin` (routes use `WorkspaceGuard`) and `IdentityPlugin`
(`PermissionsGuard`). The provider(s) + optional resolver are passed in:

```typescript
MediaServerPlugin({
    providers: { local: createLocalStorageProvider(config.plugins.media.local) },
    config: config.plugins.media
});
```

## Migrations

Owns its schema, ships its migrations:
`npx nx run @ortha-cms/media-server:db:generate --name=<change>` then
`npx nx run server:db:migrate`.

## Not yet (follow-ups)

Admin rewire (the `media-admin` mockup → this API), server-e2e + admin-e2e
suites, image dimension/duration probing, the real S3 adapter, and a
`media.asset.deleted` outbox subscriber for blob GC. See the implementation
plan for the phased rollout.

## Commands

- `npx nx typecheck @ortha-cms/media-server` / `npx nx lint @ortha-cms/media-server`
