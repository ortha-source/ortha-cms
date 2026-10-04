import type { SchemaDocument } from '../document/schema-document';
import { isInverseRelation } from '../document/relation-doc';
import type { ManifestEntry } from './manifest-entry';

/** The manifest entries a document implies — every type, with its owning many-relations. */
export function toManifest(document: SchemaDocument): ManifestEntry[] {
    return document.types.map((type) => ({
        name: type.name,
        kind: type.kind,
        joinFields: type.fields
            .filter(
                ({ spec }) =>
                    spec.type === 'relation' &&
                    !isInverseRelation(spec) &&
                    spec.many === true
            )
            .map((field) => field.name)
    }));
}
