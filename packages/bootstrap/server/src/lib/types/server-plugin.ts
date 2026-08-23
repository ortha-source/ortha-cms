import type { DynamicModule, Type } from '@nestjs/common';
import type { ApiDocsOptions } from './api-docs';
import type { PluginApiDocs } from './plugin-api-docs';

/**
 * Contract every server-side plugin must implement. A plugin is just a
 * named NestJS module that the host imports at bootstrap time.
 */
export interface ServerPlugin {
    /** Unique identifier, used in logging and lookups. */
    name: string;
    /** NestJS module (class or configured dynamic module) the plugin provides. */
    module: Type | DynamicModule;
    /**
     * Optional setup hook run before the Nest app is created. Plugins
     * run in array order — use this for one-time setup that must happen
     * before the app boots, such as opening a database connection.
     */
    onPluginInit?(): void | Promise<void>;
    /**
     * Optional migrations this plugin ships. The host applies them via the
     * `db:migrate` target, tracking each plugin under its own `table` so
     * plugins version independently. `dir` is a thunk so the path resolves
     * only at migrate time (never during normal boot) — and works whether
     * the plugin is consumed from source or installed from npm.
     */
    migrations?: {
        /** Absolute path to the plugin's migrations folder, resolved lazily. */
        dir: () => string;
        /** Tracking table isolating this plugin's migration history. */
        table: string;
    };
    /**
     * Optional contribution to the host's OpenAPI document — the security
     * schemes this plugin's guards accept. The host merges every plugin's
     * contribution before generating the document.
     */
    docs?: PluginApiDocs;
}

/**
 * Express's `trust proxy` setting — how many reverse proxies sit in front of
 * the app, or which ones to believe.
 *
 * It decides what `req.ip` resolves to, and therefore what identity's login
 * `ThrottlerGuard` buckets on. Left unset, Express ignores `X-Forwarded-For`
 * entirely and every request behind a load balancer reports the **proxy's**
 * address — collapsing the whole deployment into one rate-limit bucket, so one
 * attacker's 10 requests a minute deny login to every user. Setting it too
 * loosely is the mirror-image failure: any client could spoof
 * `X-Forwarded-For` and mint itself unlimited buckets.
 *
 * Prefer a **hop count** matching the topology (`1` for a single load
 * balancer): Express reads the address that many hops from the right of
 * `X-Forwarded-For`, which a client cannot forge past. `true` trusts the whole
 * chain, and is only safe when nothing untrusted can reach the app directly. A
 * string is passed to Express verbatim as a subnet/preset list (e.g.
 * `'loopback'`, `'10.0.0.0/8'`).
 */
export type TrustProxySetting = boolean | number | string;

/** Options for {@link createServer}. */
export interface CreateServerOptions {
    /** Plugins to register. */
    plugins: ServerPlugin[];
    /** Port to listen on. Defaults to 3000. */
    port?: number;
    /** Global API prefix. Defaults to "api". */
    globalPrefix?: string;
    /**
     * Express `trust proxy` setting. Omitted (the default), forwarded headers
     * are ignored and `req.ip` is the socket's peer — correct when the app is
     * exposed directly, wrong behind any proxy. See {@link TrustProxySetting}.
     */
    trustProxy?: TrustProxySetting;
    /**
     * Cap on a JSON / urlencoded request body, in the `bytes` syntax Express
     * accepts (`'1mb'`, `'512kb'`) or a raw byte count. Defaults to `'1mb'`.
     *
     * Set explicitly rather than inherited: `express.json()`'s own default is
     * 100 kB, which a long-form entry with embedded rich text exceeds, and a
     * body over the cap is refused with `413` by the parser before any
     * controller or guard runs. Multipart uploads do not pass through here —
     * the media plugin bounds those with its own `maxUploadBytes`.
     */
    bodyLimit?: string | number;
    /**
     * OpenAPI document + Scalar API reference settings. Omitted, the reference
     * is served on `/reference` outside production.
     */
    docs?: ApiDocsOptions;
    /**
     * Directory of built admin assets to serve, with an SPA fallback — so one
     * process answers both the API and the UI, on **one origin**.
     *
     * That single origin is the point, not a convenience. Identity issues its
     * session as an `httpOnly`, `SameSite=lax` cookie, which a UI served from
     * a different origin does not send on API calls at all; the admin's Vite
     * dev server proxies `/api` for exactly this reason
     * (`apps/admin/vite.config.mts`). A deployment that splits the two has to
     * reintroduce that proxy or CORS plus `SameSite=none`, and gets to keep
     * both halves working forever.
     *
     * Omitted (the default), nothing is served and the host is API-only —
     * which is what the monorepo's own `apps/server` wants, since `apps/admin`
     * is served by Vite there.
     */
    staticDir?: string;
}
