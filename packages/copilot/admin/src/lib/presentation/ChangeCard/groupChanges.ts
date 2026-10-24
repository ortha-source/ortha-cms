import { changeRecordKey } from '@orthacms/copilot-domain';

/** One field's before/after, as both the receipt and the preview carry it. */
export interface ChangeRow {
    field: string;
    label?: string;
    /** The record the field belongs to, when the binder named it. */
    record?: string;
    before?: unknown;
    after: unknown;
}

/** The rows of one record, under the name the card shows for it. */
export interface ChangeGroup {
    /** Stable key — the record's grouping key. */
    key: string;
    /** The record's name, when the binder gave one. */
    record?: string;
    /** Its changed fields, in the order the tool produced them. */
    changes: ChangeRow[];
}

/**
 * Groups a change's rows **under the record they belong to**, in first-seen
 * order — "Spring launch — Summary: … → …" rather than a column of `#3
 * Summary` labels.
 *
 * Keyed by `changeRecordKey` (shared with the server's record count, so the
 * header's "23 changes" and the rows always agree): the binder's `record`
 * first, then a batch's `items[n]` position, otherwise one group for the lot.
 * Pure, so the grouping is a unit test.
 */
export function groupChanges(changes: readonly ChangeRow[]): ChangeGroup[] {
    const groups = new Map<string, ChangeGroup>();
    for (const change of changes) {
        const key = changeRecordKey(change);
        const group = groups.get(key);
        if (group) {
            group.changes.push(change);
        } else {
            groups.set(key, {
                key,
                ...(change.record ? { record: change.record } : {}),
                changes: [change]
            });
        }
    }
    return [...groups.values()];
}
