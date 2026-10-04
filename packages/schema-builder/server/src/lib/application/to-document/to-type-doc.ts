import type { AnyContentType } from '@orthacms/content-server';
import {
    loadedFieldKey,
    type TypeDoc,
    type TypeOrigin
} from '@orthacms/schema-builder-domain';
import { toFieldDoc } from './to-field-doc';
import { toGroupDocs } from './to-group-docs';

/** One registered type → the document's `TypeDoc`. The label is kept only when it differs from the name. */
export function toTypeDoc(type: AnyContentType, origin: TypeOrigin): TypeDoc {
    return {
        name: type.name,
        kind: type.kind,
        ...(type.path !== undefined ? { path: type.path } : {}),
        ...(type.label && type.label !== type.name
            ? { label: type.label }
            : {}),
        ...(type.description ? { description: type.description } : {}),
        publishable: type.publishable,
        paranoid: type.paranoid,
        i18n: type.i18n,
        groups: toGroupDocs(type),
        fields: Object.entries(type.fields).map(([name, spec]) => ({
            key: loadedFieldKey(type.name, name),
            name,
            spec: toFieldDoc(spec)
        })),
        origin
    };
}
