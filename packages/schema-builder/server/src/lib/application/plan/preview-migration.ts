import { Inject, Injectable } from '@nestjs/common';
import type { SchemaDocument } from '@orthacms/schema-builder-domain';
import { builderPaths } from '../../domain/builder-paths';
import type { SourceTree } from '../../domain/ports/source-tree.port';
import {
    SCHEMA_BUILDER_CONFIG,
    SOURCE_TREE
} from '../../schema-builder.tokens';
import type { SchemaBuilderPluginConfig } from '../../types/schema-builder-config';
import { MigrationPhases } from '../migrations/migration-phases';

/**
 * The SQL an apply would generate, generated for real into a copy of the
 * migrations folder — so the preview is drizzle-kit's output, not a guess
 * (design invariant 8), and the real snapshots are never touched.
 */
@Injectable()
export class PreviewMigration {
    constructor(
        @Inject(SOURCE_TREE) private readonly tree: SourceTree,
        @Inject(SCHEMA_BUILDER_CONFIG)
        private readonly config: SchemaBuilderPluginConfig,
        private readonly phases: MigrationPhases
    ) {}

    /** `work/content` must already hold the staged draft. */
    async run(
        work: string,
        current: SchemaDocument,
        draft: SchemaDocument
    ): Promise<string[]> {
        const out = `${work}/migrations`;
        await this.tree.copyDir(builderPaths(this.config).migrations, out);
        return (
            await this.phases.run({
                work,
                current,
                draft,
                out,
                name: 'schema_builder'
            })
        ).sql;
    }
}
