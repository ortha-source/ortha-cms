import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type {
    ApplyAccepted,
    ApplyOperation
} from '@orthacms/schema-builder-domain';
import type { ApplyLock } from '../../domain/ports/apply-lock.port';
import type { OperationLog } from '../../domain/ports/operation-log.port';
import {
    APPLY_LOCK,
    BOOT_ID,
    OPERATION_LOG
} from '../../schema-builder.tokens';
import { ChangePlanner } from '../change-planner';
import { assertConfirmed } from '../guards/assert-confirmed';
import { assertNotBlocked } from '../guards/assert-not-blocked';
import { assertShape } from '../guards/assert-shape';
import { LoadDocumentUseCase } from '../load-document.use-case';
import { ApplyJob } from './apply-job';

/** The body of an apply, after the transport checked its types. */
export interface ApplySchemaInput {
    readonly document: unknown;
    readonly baseFingerprint: string;
    readonly migrationName: string;
    readonly confirmed: readonly string[];
}

/**
 * Decides, under the lock, whether a draft may be applied — the plan's
 * checks, then nothing blocked and every destructive change confirmed — and
 * hands it to {@link ApplyJob}. Answers before the work runs: the work ends in
 * a restart, and the admin follows it through the operation and the boot id.
 */
@Injectable()
export class ApplySchemaUseCase {
    constructor(
        private readonly load: LoadDocumentUseCase,
        private readonly planner: ChangePlanner,
        private readonly job: ApplyJob,
        @Inject(APPLY_LOCK) private readonly lock: ApplyLock,
        @Inject(OPERATION_LOG) private readonly log: OperationLog,
        @Inject(BOOT_ID) private readonly bootId: string
    ) {}

    async execute(
        input: ApplySchemaInput,
        actorId: string | null
    ): Promise<ApplyAccepted> {
        const draft = input.document;
        assertShape(draft);
        const release = await this.lock.acquire();
        try {
            const current = await this.load.execute();
            const plan = await this.planner.plan(
                current,
                draft,
                input.baseFingerprint
            );
            assertNotBlocked(plan.changes);
            assertConfirmed(plan.changes, input.confirmed);

            const operation: ApplyOperation = {
                id: randomUUID(),
                status: 'running',
                step: 'generate',
                migrations: [],
                files: [],
                bootId: this.bootId,
                startedAt: new Date().toISOString()
            };
            await this.log.save(operation);
            void this.job.run({
                operation,
                current: current.document,
                draft,
                plan,
                migrationName: input.migrationName,
                actorId,
                release
            });
            return { operationId: operation.id, bootId: this.bootId };
        } catch (error) {
            await release();
            throw error;
        }
    }
}
