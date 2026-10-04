import {
    fingerprint,
    type FieldDoc,
    type SchemaDocument,
    type SchemaDocumentEnvelope,
    type TypeDoc
} from '@orthacms/schema-builder-domain';

/** A builder-owned collection with defaults for what a spec does not care about. */
export function typeOf(
    name: string,
    fields: Record<string, FieldDoc>,
    over: Partial<TypeDoc> = {}
): TypeDoc {
    return {
        name,
        kind: 'collection',
        publishable: true,
        paranoid: false,
        i18n: false,
        groups: [],
        fields: Object.entries(fields).map(([field, spec]) => ({
            key: `${name}.${field}`,
            name: field,
            spec
        })),
        origin: 'builder',
        ...over
    };
}

/** A document of `types`. */
export const documentOf = (...types: TypeDoc[]): SchemaDocument => ({
    version: 1,
    types
});

/** The envelope the server would serve for `document`, editing on. */
export const envelopeOf = (
    document: SchemaDocument
): SchemaDocumentEnvelope => ({
    document,
    fingerprint: fingerprint(document),
    bootId: 'boot',
    capabilities: { editable: true, restart: 'watch' }
});

/** `type` with one more field, keyed as a new field is keyed (`<type>.<name>`). */
export const withField = (
    type: TypeDoc,
    name: string,
    spec: FieldDoc
): TypeDoc => ({
    ...type,
    fields: [...type.fields, { key: `${type.name}.${name}`, name, spec }]
});
