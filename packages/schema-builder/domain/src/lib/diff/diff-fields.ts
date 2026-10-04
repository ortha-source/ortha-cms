import type { TypeDoc } from '../document/type-doc';
import { diffField } from './diff-field';
import type { SchemaChange } from './schema-change';

/** Fields matched by key: removed, then changed, then added. */
export function diffFields(a: TypeDoc, b: TypeDoc): SchemaChange[] {
    const before = new Map(a.fields.map((field) => [field.key, field]));
    const after = new Map(b.fields.map((field) => [field.key, field]));
    const type = a.name;

    const removed = a.fields
        .filter((field) => !after.has(field.key))
        .map(
            (field): SchemaChange => ({
                kind: 'field.remove',
                type,
                field: field.name,
                spec: field.spec
            })
        );
    const changed = a.fields
        .filter((field) => after.has(field.key))
        .flatMap((field) =>
            diffField(type, field, after.get(field.key) as typeof field)
        );
    const added = b.fields
        .filter((field) => !before.has(field.key))
        .map(
            (field): SchemaChange => ({
                kind: 'field.add',
                type,
                field: field.name,
                spec: field.spec
            })
        );

    return [...removed, ...changed, ...added];
}
