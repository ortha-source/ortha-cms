import type { FieldEntry } from '../document/field-entry';
import { changedKeys } from './changed-keys';
import type { SchemaChange } from './schema-change';

/**
 * One field present on both sides → what happened to it. A new type replaces
 * the spec wholesale, so a retype reports nothing else about the field.
 */
export function diffField(
    type: string,
    before: FieldEntry,
    after: FieldEntry
): SchemaChange[] {
    const changes: SchemaChange[] = [];
    if (before.name !== after.name) {
        changes.push({
            kind: 'field.rename',
            type,
            from: before.name,
            to: after.name
        });
    }
    if (before.spec.type !== after.spec.type) {
        changes.push({
            kind: 'field.retype',
            type,
            field: after.name,
            from: before.spec.type,
            to: after.spec.type
        });
        return changes;
    }
    const keys = changedKeys(before.spec, after.spec);
    if (keys.length) {
        changes.push({
            kind: 'field.update',
            type,
            field: after.name,
            keys,
            before: before.spec,
            after: after.spec
        });
    }
    return changes;
}
