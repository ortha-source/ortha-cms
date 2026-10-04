import type { AnyFieldSpec } from '@orthacms/content-server';
import type { RelationDoc } from '@orthacms/schema-builder-domain';

type RelationSpec = NonNullable<AnyFieldSpec['relation']>;

/**
 * A relation as the document holds it — the target by name, and only what the
 * declaration would have to spell out (the DSL's defaults are left implicit,
 * so regenerating the file writes the same call).
 */
export function toRelationDoc(
    spec: AnyFieldSpec,
    relation: RelationSpec
): RelationDoc {
    const to = relation.to().name;
    if (relation.inverse) {
        return {
            to,
            inverseOf: relation.inverse.field,
            ...(relation.many ? {} : { many: false })
        };
    }
    const defaultOnDelete = spec.required ? 'cascade' : 'set null';
    return {
        to,
        ...(relation.many ? { many: true } : {}),
        ...(relation.unique ? { unique: true } : {}),
        ...(relation.onDelete !== defaultOnDelete
            ? { onDelete: relation.onDelete }
            : {}),
        ...(relation.syncAcrossLocales !== !spec.localized
            ? { syncAcrossLocales: relation.syncAcrossLocales }
            : {})
    };
}
