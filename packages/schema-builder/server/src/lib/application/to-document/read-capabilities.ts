import {
    isGeneratedSource,
    type BuilderCapabilities
} from '@orthacms/schema-builder-domain';
import type { SourceTree } from '../../domain/ports/source-tree.port';
import type { SchemaBuilderPluginConfig } from '../../types/schema-builder-config';

/**
 * Whether this process may edit, and why not. Production wins over the flag;
 * a missing manifest means there is no source tree to write to (a deployed
 * bundle, or an app run from somewhere other than its root); a manifest
 * without the marker was written by hand, and every apply rewrites it.
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
    const manifest = await tree.firstLine(`${contentDir}/index.ts`);
    if (manifest === null)
        return { editable: false, reason: 'no-source-tree', restart };
    if (!isGeneratedSource(manifest))
        return { editable: false, reason: 'hand-written-manifest', restart };
    return { editable: true, restart };
}
