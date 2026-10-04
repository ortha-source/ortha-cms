import type { BuilderCapabilities } from '@orthacms/schema-builder-domain';
import type { SourceTree } from '../../domain/ports/source-tree.port';
import type { SchemaBuilderPluginConfig } from '../../types/schema-builder-config';

/**
 * Whether this process may edit, and why not. Production wins over the flag;
 * a missing manifest means there is no source tree to write to (a deployed
 * bundle, or an app run from somewhere other than its root).
 */
export async function readCapabilities(
    tree: SourceTree,
    config: SchemaBuilderPluginConfig,
    contentDir: string
): Promise<BuilderCapabilities> {
    const restart = config.restart ?? 'watch';
    if (config.production)
        return { editable: false, reason: 'production', restart };
    if (!config.enabled)
        return { editable: false, reason: 'disabled', restart };
    if (!(await tree.exists(`${contentDir}/index.ts`)))
        return { editable: false, reason: 'no-source-tree', restart };
    return { editable: true, restart };
}
