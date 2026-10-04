import { Inject, Injectable } from '@nestjs/common';
import {
    stageFiles,
    type SchemaDocument,
    type StagedFile
} from '@orthacms/schema-builder-domain';
import { builderPaths } from '../../domain/builder-paths';
import type { CodeFormatter } from '../../domain/ports/code-formatter.port';
import type { SourceTree } from '../../domain/ports/source-tree.port';
import {
    CODE_FORMATTER,
    SCHEMA_BUILDER_CONFIG,
    SOURCE_TREE
} from '../../schema-builder.tokens';
import type { SchemaBuilderPluginConfig } from '../../types/schema-builder-config';

/**
 * Builds what `src/content/` would become, somewhere else: mirrors the real
 * folder into `dir`, then writes and deletes what the builder owns. Never
 * touches `src/` — a write there restarts the dev server mid-operation.
 */
@Injectable()
export class StageWriter {
    constructor(
        @Inject(SOURCE_TREE) private readonly tree: SourceTree,
        @Inject(CODE_FORMATTER) private readonly formatter: CodeFormatter,
        @Inject(SCHEMA_BUILDER_CONFIG)
        private readonly config: SchemaBuilderPluginConfig
    ) {}

    /** Stages `next` into `dir`; answers the files that differ from `src/content/`. */
    async write(
        dir: string,
        current: SchemaDocument,
        next: SchemaDocument
    ): Promise<StagedFile[]> {
        const { content } = builderPaths(this.config);
        const { write, remove } = stageFiles(current, next);
        await this.tree.remove(dir);
        await this.tree.copyDir(content, dir);

        const staged: StagedFile[] = [];
        for (const [path, source] of Object.entries(write)) {
            const before = await this.tree.read(`${content}/${path}`);
            const after = await this.formatter.format(
                source,
                `${content}/${path}`
            );
            await this.tree.write(`${dir}/${path}`, after);
            if (after !== before) staged.push({ path, before, after });
        }
        for (const path of remove) {
            const before = await this.tree.read(`${content}/${path}`);
            await this.tree.remove(`${dir}/${path}`);
            if (before !== null) staged.push({ path, before, after: null });
        }
        return staged.sort((a, b) => a.path.localeCompare(b.path));
    }
}
