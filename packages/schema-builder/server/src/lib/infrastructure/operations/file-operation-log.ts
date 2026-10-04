import type { ApplyOperation } from '@orthacms/schema-builder-domain';
import type { OperationLog } from '../../domain/ports/operation-log.port';
import type { SourceTree } from '../../domain/ports/source-tree.port';
import { WORK_DIR } from '../../types/schema-builder-config';

/** Ids are uuids; anything else is refused before it becomes a path. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * {@link OperationLog} as one JSON file per apply under `.orthacms/operations/`
 * — on disk, because the process that writes the last line is often not the
 * one the admin asks: the apply ends in a restart.
 */
export class FileOperationLog implements OperationLog {
    constructor(private readonly tree: SourceTree) {}

    async save(operation: ApplyOperation): Promise<void> {
        await this.tree.write(
            this.path(operation.id),
            `${JSON.stringify(operation, null, 2)}\n`
        );
    }

    async get(id: string): Promise<ApplyOperation | null> {
        if (!UUID.test(id)) return null;
        const text = await this.tree.read(this.path(id));
        return text === null ? null : (JSON.parse(text) as ApplyOperation);
    }

    private path(id: string): string {
        if (!UUID.test(id)) throw new Error(`Not an operation id: ${id}`);
        return `${WORK_DIR}/operations/${id}.json`;
    }
}
