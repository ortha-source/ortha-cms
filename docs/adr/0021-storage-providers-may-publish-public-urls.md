# 0021 — A storage provider may publish public URLs, and the operator decides whether the API reports them

- **Status:** Proposed
- **Date:** 2026-10-09
- **Deciders:** Engineering

## Context

Every URL the media plugin reports is one of the app's own routes:
`/api/media/assets/:id/raw` for the session surface, `/api/v1/media/assets/:id/raw`
in the public content API. Those routes are the security model, and it is a
deliberate one:

- every byte goes through an **authorized** route that re-checks membership, or
  the token's workspace, on each request;
- `download-headers` serves every response with `nosniff`, a sandboxing CSP and
  an `attachment` disposition for anything outside a small inline-safe set, so an
  uploaded `.html` or scripted `.svg` cannot become stored XSS;
- `directServe: 'signed-url'` (ADR-0012's capability model) keeps all of that
  when it redirects: the redirect happens after authorization, the URL expires,
  and the disposition and type are pinned onto it.

That model has one consumer it cannot serve: a **public reader**. A website puts
an asset URL in an `<img src>`; a browser sends no `Authorization` header on that
request, so a token route is useless to it. Rich text authored in the admin
embeds `asset.url`, so a published article body ends up containing
`/api/media/assets/<id>/raw`, which no anonymous reader can fetch. A video player
needs an HLS manifest, which the app has no way to produce.

Deployments that already run a CDN in front of their storage — the case that
prompted this was an app migrating from Strapi, whose images live on Cloudflare
Images, video on Cloudflare Stream and everything else behind Azure CDN — have
URLs for every asset that a reader _can_ fetch. There was no seam to report them:
`toAssetView`, the `MEDIA_ASSET_RESOLVER` binding and the public API's
`?media=preview` each hard-code the route, the last one rewriting whatever the
resolver returns. Such a host's only option was to patch the compiled `dist/` of
two packages.

The tension is that **a permanent public URL is a capability grant**. Whoever
holds it can fetch the bytes with no session, no token, no workspace scope and no
reader entitlement (segments), for as long as the CDN serves it, with whatever
headers the CDN sets. That is precisely what the routes above exist to prevent,
so it cannot become something that happens by default, or by a provider's say-so
alone.

## Decision

We will let a storage provider **describe** where its objects are public, and
let the **operator** decide whether the API reports it.

1. **The port gains an optional method and a declared capability**
   (`@orthacms/media-domain`):

    ```ts
    publicUrls?(storageKey, { mimeType, kind, variant? }):
        PublicAssetUrls | undefined | Promise<PublicAssetUrls | undefined>;
    // PublicAssetUrls = { url, thumbnailUrl?, streams?: { hls?, dash? } }
    // StorageCapabilities.publicUrls: boolean
    ```

    It is called for originals and for derivative keys (`variant` names which), so
    a CDN that fronts derivatives serves a 320px tile rather than the original.
    Declared, like `directUrl`: the plugin refuses a provider that declares the
    capability without the method, and the testkit asserts the method exists
    exactly when the capability says so. Every first-party adapter declares
    `false`.

2. **The operator opts in**: `MediaPluginConfig.publicUrls: 'off' | 'provider'`,
   default `'off'`. With it off the provider is **never called**, so a deployment
   that does not opt in answers every request exactly as before. `'provider'`
   against a provider without the capability fails the boot, in the same words
   and for the same reason as `directServe: 'signed-url'` against one that cannot
   sign: silently reporting the app's routes would leave the operator believing a
   feature is on that is not.

3. **A MIME gate, inline-safe by default**:
   `publicUrlTypes: 'inline-safe' | 'all'`, default `'inline-safe'` — the same
   `isInlineSafe` the download route uses for its disposition (raster images,
   audio, video, PDF, plain text). A CDN applies none of the app's hardening, so
   an SVG or HTML asset keeps the authorized route unless the operator states,
   with `'all'`, that their CDN sets those headers itself. The decision is made
   **per asset**, on the original's stored type, and covers its derivatives too:
   an asset is either published or not.

4. **One place asks.** `PublicAssetUrlsQuery` applies the switch, the gate and
   validation for every surface — the library list and detail, both upload
   responses, the `MEDIA_ASSET_RESOLVER` binding and, through it, the public API
   and GraphQL. A page of assets is one concurrent batch of provider calls. A
   throw, or anything that is not an absolute `http(s)` URL, falls back to the
   app's route for that object with a logged warning.

5. **The decision crosses the package boundary as data.** Content-server must
   not depend on media-server, so `ResolvedMediaAsset` gains an optional
   `public: { url, thumbUrl?, previewUrl?, streams? }`, present only when the
   media plugin decided the asset may be published. The public expansion reports
   those URLs as they are and keeps rewriting everything else to the token route.
   It never infers publication from the shape of a URL.

6. **The admin stops deriving derivative URLs from `url`.** `AssetView` gains
   explicit `thumbUrl` / `previewUrl` (and `streams`), because `${url}?variant=`
   on a CDN URL silently loads the full original into every tile.

## Consequences

Easier: a deployment with a CDN reports URLs a public reader can load — in
`<img src>`, in published rich text, in a video player through `streams` —
without patching the media or content packages. A provider describes its
routing once; the operator flips one setting.

Accepted, knowingly, by an operator who sets `'provider'`:

- **A published asset is reachable by anyone holding its URL.** Workspace
  scoping, the token's scope and reader entitlements (segments, ADR-0019's
  sharing rules) still govern what the API _hands out_, but not who can fetch a
  URL once it has been handed out, copied or embedded. Revoking access to an
  asset no longer revokes access to its bytes. This is the trade the switch
  exists to make visible.
- **The CDN's headers apply, not the app's.** The default MIME gate limits that
  to types a browser renders inertly. `'all'` moves the responsibility for
  `nosniff`, a sandboxing CSP and attachment disposition to the CDN.
- **The admin also receives public URLs**, since it reads the same views. Copy
  link copies the CDN URL; the library's download action on a cross-origin URL
  opens the asset rather than saving it (browsers ignore `download` across
  origins).

Unchanged: the authorized routes keep serving, with the same checks and headers,
whatever the setting. Timed-text tracks stay on those routes in this iteration —
`text/vtt` is outside the default gate, and resolving them would cost a second
lookup per page. Signed or expiring CDN URLs remain `directServe`'s job, and
reader entitlements do not extend to CDN URLs; both are out of scope.

Ruled out: a provider that publishes merely by implementing the method. The
capability says what a backend _can_ do; the operator says what the deployment
_will_ do.

## Alternatives considered

**Rebind `MEDIA_ASSET_RESOLVER` from a host plugin.** Nest gives no reliable way
to replace one global module's binding from another, and it would not have been
enough: the public expansion overwrites the resolver's URLs with its own token
routes and builds items from a fixed field list, so `streams` and any public URL
would be dropped anyway. The library's own `AssetView` would be untouched.

**Reuse `directUrl` and `directServe`.** Its contract is the opposite — a
short-lived URL, minted after authorization, with a pinned disposition and type
— and it still reports the `/raw` route in every response, which is exactly what
an `<img src>` cannot use. Stretching it to "permanent and public" would have
weakened the guarantee it exists to give.

**Let the provider decide alone (no operator switch).** That is what the
patch-package approach did, and it made a security decision invisible in the
deployment's configuration: swapping in a provider would change who can read the
media. The switch keeps that decision where `directServe`'s is.

**No MIME gate, or a gate the provider applies.** The provider knows its CDN's
routing, not the app's threat model; an SVG on a plain blob CDN got a public URL
under the patch this replaces. The gate belongs to the core, defaults to the
same allowlist the download route trusts, and can be widened explicitly.

**Infer "public" in content-server from an absolute URL.** Cheaper to wire, but
it makes a shape of string carry an authorization decision. An explicit `public`
block means a resolver that ever returned an absolute URL for another reason
could not publish by accident.
