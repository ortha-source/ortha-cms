import { resolve } from 'node:path';
import type { SchemaBuilderPluginConfig } from '@orthacms/schema-builder-server';
import { isProduction, readEnv, readFlag } from '@orthacms/utils-server';

/**
 * The schema builder — the admin's Content model page.
 *
 * Reading the content model is always on. **Editing** needs
 * `SCHEMA_BUILDER=true` and is refused in production whatever the flag says:
 * an edit writes TypeScript under `apps/server/src/content/` and a drizzle-kit
 * migration under `apps/server/migrations/`, which is a code change made in
 * development, committed, and deployed like any other.
 *
 * The builder edits this app's own source, so it needs the app's folder on
 * disk. `orthacms dev` starts the server from the app root, where that is
 * `apps/server`; `SCHEMA_BUILDER_ROOT` overrides it for anything else.
 */
export function schemaBuilderConfig(): SchemaBuilderPluginConfig {
    const restart = readEnv('SCHEMA_BUILDER_RESTART');
    return {
        enabled: readFlag('SCHEMA_BUILDER', false),
        production: isProduction(),
        projectRoot: resolve(readEnv('SCHEMA_BUILDER_ROOT') ?? 'apps/server'),
        // `orthacms dev` runs `tsc --watch` and `node --watch`, so a change to
        // `src/content/` restarts the server on its own. `manual` is for a
        // server started some other way: the page asks you to restart it.
        restart: restart === 'manual' ? 'manual' : 'watch'
    };
}
