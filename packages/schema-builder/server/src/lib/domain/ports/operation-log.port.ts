import type { ApplyOperation } from '@orthacms/schema-builder-domain';

/** Where applies are recorded — somewhere a restarted process can still read. */
export interface OperationLog {
    save(operation: ApplyOperation): Promise<void>;
    /** The operation, or `null` when there is none by that id. */
    get(id: string): Promise<ApplyOperation | null>;
}
