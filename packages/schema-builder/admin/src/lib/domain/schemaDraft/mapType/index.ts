import type { SchemaDocument, TypeDoc } from '@orthacms/schema-builder-domain';

/** `doc` with the type named `name` replaced by `edit(type)`; the rest untouched. */
export function mapType(
    doc: SchemaDocument,
    name: string,
    edit: (type: TypeDoc) => TypeDoc
): SchemaDocument {
    return {
        ...doc,
        types: doc.types.map((type) => (type.name === name ? edit(type) : type))
    };
}
