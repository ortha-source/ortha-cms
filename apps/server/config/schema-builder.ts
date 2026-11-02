import type { SchemaBuilderPluginConfig } from '@orthacms/schema-builder-server';

import { schemaBuilderFromEnv } from '@orthacms/config';

/**
 * The schema builder (ADR-0020). Reading the content model is always on;
 * **editing** needs `SCHEMA_BUILDER=true` and is refused in production
 * whatever the flag says — a schema change is code and a migration, made in
 * a source tree and reviewed in git, never a runtime edit.
 *
 * `SCHEMA_BUILDER_ROOT` is where this app's source lives, resolved against the
 * working directory: `npm run dev` starts the server from the repository root,
 * where that is `apps/server`. `SCHEMA_BUILDER_RESTART=manual` asks you to
 * restart the server after an edit instead of waiting for the watcher.
 */
export function schemaBuilderConfig(): SchemaBuilderPluginConfig {
    return schemaBuilderFromEnv();
}
