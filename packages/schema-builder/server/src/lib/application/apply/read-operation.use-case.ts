import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { ApplyOperation } from '@orthacms/schema-builder-domain';
import type { OperationLog } from '../../domain/ports/operation-log.port';
import { BOOT_ID, OPERATION_LOG } from '../../schema-builder.tokens';

/**
 * One apply, as recorded. A `running` operation recorded by another process
 * reads as `interrupted`: whatever ran it is gone — a crash, or a restart that
 * came mid-publish — and nothing is going to finish it.
 */
@Injectable()
export class ReadOperationUseCase {
    constructor(
        @Inject(OPERATION_LOG) private readonly log: OperationLog,
        @Inject(BOOT_ID) private readonly bootId: string
    ) {}

    async execute(id: string): Promise<ApplyOperation> {
        const operation = await this.log.get(id);
        if (!operation) throw new NotFoundException(`No apply ${id}.`);
        if (
            operation.status === 'running' &&
            operation.bootId !== this.bootId
        ) {
            return { ...operation, status: 'interrupted' };
        }
        return operation;
    }
}
