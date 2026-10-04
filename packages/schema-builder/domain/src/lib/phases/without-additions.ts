import type { SchemaDocument } from '../document/schema-document';

/**
 * `before` with only the removals of `after` applied: removed types and fields
 * disappear, nothing is added or changed. Generating this first and `after`
 * second means no drizzle-kit diff holds a drop and a create on the same
 * table — the case where it stops to ask whether that was a rename. A type
 * left with no fields is dropped too; the DSL refuses an empty type.
 */
export function withoutAdditions(
    before: SchemaDocument,
    after: SchemaDocument
): SchemaDocument {
    const kept = new Map(
        after.types.map((type) => [
            type.name,
            new Set(type.fields.map((field) => field.key))
        ])
    );
    const types = before.types
        .filter((type) => kept.has(type.name))
        .map((type) => {
            const keys = kept.get(type.name) as Set<string>;
            const fields = type.fields.filter((field) => keys.has(field.key));
            const used = new Set(
                fields.map((field) => field.spec.admin?.group)
            );
            return {
                ...type,
                fields,
                groups: type.groups.filter((group) => used.has(group.key))
            };
        })
        .filter((type) => type.fields.length > 0);
    return { ...before, types };
}
