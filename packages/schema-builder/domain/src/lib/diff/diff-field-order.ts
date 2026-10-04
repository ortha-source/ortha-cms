import type { TypeDoc } from '../document/type-doc';
import type { SchemaChange } from './schema-change';
import { same } from './same';

/** Whether the fields both sides share now come in a different order. */
export function diffFieldOrder(a: TypeDoc, b: TypeDoc): SchemaChange[] {
    const shared = new Set(
        a.fields
            .map((field) => field.key)
            .filter((key) => b.fields.some((f) => f.key === key))
    );
    const order = (type: TypeDoc) =>
        type.fields
            .filter((field) => shared.has(field.key))
            .map((field) => field.key);
    return same(order(a), order(b))
        ? []
        : [{ kind: 'field.reorder', type: a.name }];
}
