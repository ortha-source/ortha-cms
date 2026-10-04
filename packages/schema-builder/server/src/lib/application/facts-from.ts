import type {
    ChangeFacts,
    SchemaDocument
} from '@orthacms/schema-builder-domain';

/**
 * {@link ChangeFacts} over numbers read up front. A type the counts do not
 * mention has no rows and no grants — a new type, or one nothing was asked
 * about. References come from the document being applied, not the database.
 */
export function factsFrom(
    rows: ReadonlyMap<string, number>,
    grants: ReadonlyMap<string, number>,
    after: SchemaDocument
): ChangeFacts {
    return {
        rows: (type) => rows.get(type) ?? 0,
        grantedTo: (type) => grants.get(type) ?? 0,
        referencedBy: (type) =>
            after.types
                .filter(
                    (other) =>
                        other.name !== type &&
                        other.fields.some(
                            (field) =>
                                field.spec.type === 'relation' &&
                                field.spec.to === type
                        )
                )
                .map((other) => other.name)
    };
}
