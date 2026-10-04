import { Inject, Injectable } from '@nestjs/common';
import type { StagedFile } from '@orthacms/schema-builder-domain';
import { builderPaths } from '../../domain/builder-paths';
import type { SourceTree } from '../../domain/ports/source-tree.port';
import {
    SCHEMA_BUILDER_CONFIG,
    SOURCE_TREE
} from '../../schema-builder.tokens';
import type { SchemaBuilderPluginConfig } from '../../types/schema-builder-config';

/**
 * [schema-builder:I-04] The one step that writes `src/content/`, run once,
 * last, after the migration committed. Writes only what changed — the staged
 * files are already the builder's own and the manifest — so the dev watcher
 * sees one burst and restarts once.
 */
@Injectable()
export class StagePublisher {
    constructor(
        @Inject(SOURCE_TREE) private readonly tree: SourceTree,
        @Inject(SCHEMA_BUILDER_CONFIG)
        private readonly config: SchemaBuilderPluginConfig
    ) {}

    async publish(files: readonly StagedFile[]): Promise<void> {
        const { content } = builderPaths(this.config);
        for (const file of files) {
            if (file.after === null)
                await this.tree.remove(`${content}/${file.path}`);
            else await this.tree.write(`${content}/${file.path}`, file.after);
        }
    }
}
