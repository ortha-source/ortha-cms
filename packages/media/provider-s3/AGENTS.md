# @orthacms/media-provider-s3

A **stub** AWS S3 storage provider for the Media Library. It proves the routing
seam end-to-end — the host can register it under a name and a resolver can route
to it — without pulling in an AWS dependency yet. Every method throws
`S3NotImplementedError` until the real adapter lands.

## What it exports

- `createS3StorageProvider(config): StorageProvider` — same signature as
  `createLocalStorageProvider`, so switching providers is a config change.
  `config` is `{ bucket, region }`.

## When implemented

Fill in `put`/`get` via the AWS SDK and return a **signed URL** from `url` so the
browser can fetch S3 directly (the `AssetView.url` can then point at S3 for
S3-backed assets instead of streaming through the app). Until then, don't
register it as the `defaultProvider`.

## Commands

- `npx nx typecheck @orthacms/media-provider-s3` / `npx nx lint @orthacms/media-provider-s3`
