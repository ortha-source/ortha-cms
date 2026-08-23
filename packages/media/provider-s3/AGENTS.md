# @orthacms/media-provider-s3

A **stub** AWS S3 storage provider for the Media Library. It proves the routing
seam end-to-end — the host can register it under a name and a resolver can route
to it — without pulling in an AWS dependency yet. Every method throws
`S3NotImplementedError` until the real adapter lands.

## What it exports

- `createS3StorageProvider(config): StorageProvider` — same signature as
  `createLocalStorageProvider`, so switching backends is one line in
  `plugins.ts`. `config` is `{ bucket, region }`.

Its `capabilities` describe the **stub**, not S3: all three are `false`, and
`verify()` throws, so a deployment that wires it fails at boot rather than on
the first upload.

## When implemented

Fill in `put`/`get` via the AWS SDK — streaming, all-or-nothing (abort the
multipart upload on failure) — and add `directUrl()` with
`capabilities.directUrl: true`. Write it **S3-compatible**, not AWS-only:
`endpoint` + `forcePathStyle` is the whole difference between AWS S3,
Cloudflare R2, MinIO, DigitalOcean Spaces, Backblaze B2, Wasabi and the rest.

Run `describeStorageProvider` from `@orthacms/media-provider-testkit` against a
MinIO testcontainer — the contract is not optional, and it is what the
filesystem provider is held to.

Note for `directUrl()`: a redirect discards the app's `Content-Disposition`,
`nosniff` and CSP, and `media_asset.mime_type` is the uploader's own claim. The
signed URL must pin disposition and content type (`response-content-disposition`
/ `response-content-type`) or the capability must stay `false`.

## Commands

- `npx nx typecheck @orthacms/media-provider-s3` / `npx nx lint @orthacms/media-provider-s3`
