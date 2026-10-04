import type { SchemaChange } from '../diff/schema-change';
import { changeId } from './change-id';
import type { ClassifyReason, Safety } from './safety';

export interface ClassifiedChange {
    readonly id: string;
    readonly change: SchemaChange;
    readonly safety: Safety;
    readonly reason: ClassifyReason;
    /** False when only code changes and no migration is generated. */
    readonly storage: boolean;
}

/** The one constructor every classifier returns through. */
export function verdict(
    change: SchemaChange,
    safety: Safety,
    reason: ClassifyReason,
    storage: boolean
): ClassifiedChange {
    return { id: changeId(change), change, safety, reason, storage };
}
