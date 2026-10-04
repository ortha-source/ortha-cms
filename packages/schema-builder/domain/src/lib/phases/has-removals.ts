import type { SchemaDocument } from '../document/schema-document';

/** Whether going from `before` to `after` removes any type or field. */
export function hasRemovals(
    before: SchemaDocument,
    after: SchemaDocument
): boolean {
    const next = new Map(
        after.types.map((type) => [
            type.name,
            new Set(type.fields.map((field) => field.key))
        ])
    );
    return before.types.some((type) => {
        const keys = next.get(type.name);
        return !keys || type.fields.some((field) => !keys.has(field.key));
    });
}
