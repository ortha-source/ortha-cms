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
}

/** Options for {@link createServer}. */
export interface CreateServerOptions {
    /** Plugins to register. */
    plugins: ServerPlugin[];
    /** Port to listen on. Defaults to 3000. */
    port?: number;
    /** Global API prefix. Defaults to "api". */
    globalPrefix?: string;
}
