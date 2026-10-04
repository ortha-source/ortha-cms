import type { SchemaChange } from '../diff/schema-change';

/** A stable id per change — what the user ticks to confirm a destructive one. */
export function changeId(change: SchemaChange): string {
    switch (change.kind) {
        case 'type.add':
        case 'type.remove':
        case 'type.meta':
        case 'field.reorder':
            return `${change.kind}:${change.type}`;
        case 'type.flag':
            return `${change.kind}:${change.type}.${change.flag}`;
        case 'field.rename':
            return `${change.kind}:${change.type}.${change.from}`;
        default:
            return `${change.kind}:${change.type}.${change.field}`;
    }
}
