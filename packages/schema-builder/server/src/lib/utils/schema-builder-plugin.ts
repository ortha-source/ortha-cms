import { isAbsolute } from 'node:path';
import type { ServerPlugin } from '@orthacms/bootstrap-server';
import { SchemaBuilderModule } from '../schema-builder.module';
import type { SchemaBuilderPluginConfig } from '../types/schema-builder-config';

/**
 * `SchemaBuilderPlugin(config)` — the visual content-type builder
 * (ADR-0020). Registered after `ContentPlugin`, whose registry it reads.
 * Refuses, at construction, a configuration it could only misread later.
 */
export function SchemaBuilderPlugin(
    config: SchemaBuilderPluginConfig
): ServerPlugin {
    if (!isAbsolute(config.projectRoot)) {
        throw new Error(
            `SchemaBuilderPlugin: projectRoot must be an absolute path, got "${config.projectRoot}". ` +
                `Resolve it in orthacms.config.ts.`
        );
    }
    if (
        config.contentDir !== undefined &&
        (isAbsolute(config.contentDir) ||
            config.contentDir.split('/').includes('..'))
    ) {
        throw new Error(
            `SchemaBuilderPlugin: contentDir must be a path inside projectRoot, got "${config.contentDir}".`
        );
    }
    return {
        name: 'schema-builder',
        module: SchemaBuilderModule.forRoot(config)
    };
}
