import type {
    FieldDoc,
    FieldEntry,
    TypeDoc
} from '@orthacms/schema-builder-domain';

/**
 * The entry editor's tabs a schema reaches. They are built in — a schema
 * cannot add one — and a field's type alone decides which it lands on:
 * relations and media have tabs of their own, everything else is General.
 */
export type BuiltInTab = 'general' | 'relations' | 'media';

/** The tab the entry editor draws this field on. */
export function builtInTabOf(spec: FieldDoc): BuiltInTab {
    if (spec.type === 'relation') return 'relations';
    if (spec.type === 'media') return 'media';
    return 'general';
}

/** A type's fields on one tab, in declaration order. */
export function fieldsOnTab(type: TypeDoc, tab: BuiltInTab): FieldEntry[] {
    return type.fields.filter((entry) => builtInTabOf(entry.spec) === tab);
}
