import type { DynamicModule, Type } from '@nestjs/common';

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
}

/**
 * API-reference (Scalar) settings. The docs describe the running app's own
 * routes, so they are generated from the live Nest metadata at boot rather than
 * from a checked-in spec that could drift.
 */
export interface ServerDocsConfig {
    /**
     * Whether to mount the reference at all. **Defaults to off in production**
     * and on everywhere else: the page enumerates every route, parameter, and
     * auth scheme, which is a map of the attack surface — publishing it is a
     * deliberate act, not a default.
     */
    enabled?: boolean;
    /**
     * Path the reference is served from, relative to the host root (NOT behind
     * the global API prefix — it is a page, not an API route). Defaults to
     * `/docs`; the external-API reference is mounted at `<path>/public` and the
     * raw OpenAPI documents at `<path>/openapi.json` + `<path>/public/openapi.json`.
     */
    path?: string;
    /** Version string shown on the reference. Defaults to `1.0.0`. */
    version?: string;
}

/** Options for {@link createServer}. */
export interface CreateServerOptions {
    /** Plugins to register. */
    plugins: ServerPlugin[];
    /** Port to listen on. Defaults to 3000. */
    port?: number;
    /** Global API prefix. Defaults to "api". */
    globalPrefix?: string;
    /** API-reference/playground settings. Off in production by default. */
    docs?: ServerDocsConfig;
}
