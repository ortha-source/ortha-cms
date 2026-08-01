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

/** Options for {@link createServer}. */
export interface CreateServerOptions {
    /** Plugins to register. */
    plugins: ServerPlugin[];
    /** Port to listen on. Defaults to 3000. */
    port?: number;
    /** Global API prefix. Defaults to "api". */
    globalPrefix?: string;
    /**
     * OpenAPI document + Scalar API reference settings. Omitted, the reference
     * is served on `/reference` outside production.
     */
    docs?: ApiDocsOptions;
}
