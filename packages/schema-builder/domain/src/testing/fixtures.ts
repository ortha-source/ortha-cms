import type { FieldDoc } from '../lib/document/field-doc';
import type { FieldEntry } from '../lib/document/field-entry';
import type { SchemaDocument } from '../lib/document/schema-document';
import type { TypeDoc } from '../lib/document/type-doc';

/** Test-only builders. Excluded from the library build (`tsconfig.lib.json`). */
export const fieldOf = (
    type: string,
    name: string,
    spec: FieldDoc
): FieldEntry => ({ key: `${type}.${name}`, name, spec });

export function typeOf(
    name: string,
    fields: Record<string, FieldDoc>,
    over: Partial<TypeDoc> = {}
): TypeDoc {
    return {
        name,
        kind: 'collection',
        publishable: false,
        paranoid: false,
        i18n: false,
        groups: [],
        fields: Object.entries(fields).map(([field, spec]) =>
            fieldOf(name, field, spec)
        ),
        origin: 'builder',
        ...over
    };
}

export const documentOf = (...types: TypeDoc[]): SchemaDocument => ({
    version: 1,
    types
});
