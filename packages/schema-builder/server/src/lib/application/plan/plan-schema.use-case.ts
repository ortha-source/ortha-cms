import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { SchemaPlan } from '@orthacms/schema-builder-domain';
import type { SourceTree } from '../../domain/ports/source-tree.port';
import { SOURCE_TREE } from '../../schema-builder.tokens';
import { WORK_DIR } from '../../types/schema-builder-config';
import { ChangePlanner } from '../change-planner';
import { assertShape } from '../guards/assert-shape';
import { LoadDocumentUseCase } from '../load-document.use-case';
import { StageWriter } from '../stage/stage-writer';
import { PreviewMigration } from './preview-migration';

/**
 * What an apply of the draft would do — the same planner, the files staged
 * in a folder of the plan's own, the SQL generated into a throwaway copy.
 * A blocked draft is answered, not refused: the review lists why.
 */
@Injectable()
export class PlanSchemaUseCase {
    constructor(
        private readonly load: LoadDocumentUseCase,
        private readonly planner: ChangePlanner,
        private readonly stage: StageWriter,
        private readonly preview: PreviewMigration,
        @Inject(SOURCE_TREE) private readonly tree: SourceTree
    ) {}

    async execute(
        draft: unknown,
        baseFingerprint: string
    ): Promise<SchemaPlan> {
        assertShape(draft);
        const current = await this.load.execute();
        const { changes, blocked, needsMigration } = await this.planner.plan(
            current,
            draft,
            baseFingerprint
        );
        if (blocked)
            return { baseFingerprint, changes, blocked, files: [], sql: [] };

        // One folder per plan, so two people planning at once never share one.
        const work = `${WORK_DIR}/plan/${randomUUID()}`;
        try {
            const files = await this.stage.write(
                `${work}/content`,
                current.document,
                draft
            );
            const sql = needsMigration
                ? await this.preview.run(work, current.document, draft)
                : [];
            return { baseFingerprint, changes, blocked, files, sql };
        } finally {
            await this.tree.remove(work);
        }
    }
}
