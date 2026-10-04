import type { SchemaDocument } from '../document/schema-document';
import { diffType } from './diff-type';
import type { SchemaChange } from './schema-change';

/** Types matched by name: removed, then changed, then added. */
export function diffDocuments(
    before: SchemaDocument,
    after: SchemaDocument
): SchemaChange[] {
    const left = new Map(before.types.map((type) => [type.name, type]));
    const right = new Map(after.types.map((type) => [type.name, type]));

    const removed = before.types
        .filter((type) => !right.has(type.name))
        .map(
            (type): SchemaChange => ({ kind: 'type.remove', type: type.name })
        );
    const changed = before.types
        .filter((type) => right.has(type.name))
        .flatMap((type) => diffType(type, right.get(type.name) as typeof type));
    const added = after.types
        .filter((type) => !left.has(type.name))
        .map((type): SchemaChange => ({ kind: 'type.add', type: type.name }));

    return [...removed, ...changed, ...added];
}
