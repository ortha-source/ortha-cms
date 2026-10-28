import type { SchemaBuilderPluginConfig } from '@orthacms/schema-builder-server';
import { schemaBuilderFromEnv } from '@orthacms/config';

/**
 * The Content model page. Reading is always on; **editing** writes TypeScript
 * and a migration into this app's source tree, so it needs
 * `SCHEMA_BUILDER=true` and is refused in production whatever the flag says
 * (ADR-0020). `SCHEMA_BUILDER_ROOT` defaults to `apps/server`, resolved against
 * the directory `orthacms dev` starts the server in.
 */
export function schemaBuilderConfig(): SchemaBuilderPluginConfig {
    return schemaBuilderFromEnv();
}
