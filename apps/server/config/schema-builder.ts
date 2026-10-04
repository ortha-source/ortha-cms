import { resolve } from 'node:path';
import type { SchemaBuilderPluginConfig } from '@orthacms/schema-builder-server';
import { readEnv, readFlag } from '@orthacms/utils-server';

import { isProduction } from './env';

/**
 * The schema builder (ADR-0020). Reading the content model is always on;
 * **editing** needs `SCHEMA_BUILDER=true` and is refused in production
 * whatever the flag says — a schema change is code and a migration, made in
 * development and deployed.
 *
 * The builder edits this app's own `src/content/`, so it needs the app's
 * folder on disk. Every dev entry point (`npm run dev`, `orthacms dev`) starts
 * the server from the repository root, where that is `apps/server`;
 * `SCHEMA_BUILDER_ROOT` overrides it for anything else.
 */
export function schemaBuilderConfig(): SchemaBuilderPluginConfig {
    const restart = readEnv('SCHEMA_BUILDER_RESTART');
    return {
        enabled: readFlag('SCHEMA_BUILDER', false),
        production: isProduction,
        projectRoot: resolve(readEnv('SCHEMA_BUILDER_ROOT') ?? 'apps/server'),
        restart: restart === 'manual' ? 'manual' : 'watch'
    };
}
