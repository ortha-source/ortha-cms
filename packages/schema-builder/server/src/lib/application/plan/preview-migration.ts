import { Inject, Injectable } from '@nestjs/common';
import {
    hasRemovals,
    withoutAdditions,
    type SchemaDocument
} from '@orthacms/schema-builder-domain';
import { builderPaths } from '../../domain/builder-paths';
import type { MigrationGenerator } from '../../domain/ports/migration-generator.port';
import type { SourceTree } from '../../domain/ports/source-tree.port';
import {
    MIGRATION_GENERATOR,
    SCHEMA_BUILDER_CONFIG,
    SOURCE_TREE
} from '../../schema-builder.tokens';
import type { SchemaBuilderPluginConfig } from '../../types/schema-builder-config';
import { StageWriter } from '../stage/stage-writer';

/** Migration names inside a preview; never written to the real folder. */
const REMOVALS = 'schema_builder_removals';
const CHANGES = 'schema_builder_changes';

/**
 * The SQL an apply would generate, generated for real into a copy of the
 * migrations folder — so the preview is drizzle-kit's output, not a guess
 * (design invariant 8), and the real snapshots are never touched.
 *
 * Two runs, as apply does them: the removals first, then the rest. A diff
 * holding a drop and a create on one table is the one drizzle-kit stops to
 * ask about; split, it never sees one.
 */
@Injectable()
export class PreviewMigration {
    constructor(
        @Inject(SOURCE_TREE) private readonly tree: SourceTree,
        @Inject(MIGRATION_GENERATOR)
        private readonly generator: MigrationGenerator,
        @Inject(SCHEMA_BUILDER_CONFIG)
        private readonly config: SchemaBuilderPluginConfig,
        private readonly stage: StageWriter
    ) {}

    /** `work/content` must already hold the staged draft. */
    async run(
        work: string,
        current: SchemaDocument,
        draft: SchemaDocument
    ): Promise<string[]> {
        const out = `${work}/migrations`;
        await this.tree.copyDir(builderPaths(this.config).migrations, out);
        const sql: string[] = [];
        if (hasRemovals(current, draft)) {
            await this.stage.write(
                `${work}/removals`,
                current,
                withoutAdditions(current, draft)
            );
            sql.push(
                (
                    await this.generator.generate({
                        schema: `${work}/removals/index.ts`,
                        out,
                        name: REMOVALS
                    })
                ).sql
            );
        }
        sql.push(
            (
                await this.generator.generate({
                    schema: `${work}/content/index.ts`,
                    out,
                    name: CHANGES
                })
            ).sql
        );
        return sql.filter((statements) => statements.length > 0);
    }
}
