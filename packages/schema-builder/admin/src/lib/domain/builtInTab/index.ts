import type {
    FieldDoc,
    FieldEntry,
    TypeDoc
} from '@orthacms/schema-builder-domain';

/**
 * The entry editor's tabs a schema reaches. They are built in — a schema
 * cannot add one — and since the editor became one form (ADR-0022) every
 * field lands on the same one, Content: relations and media included, in the
 * schema's order beside the rest.
 */
export type BuiltInTab = 'general';

/** The tab the entry editor draws this field on — always the one form. */
export function builtInTabOf(_spec: FieldDoc): BuiltInTab {
    return 'general';
}

/** A type's fields on one tab, in declaration order. */
export function fieldsOnTab(type: TypeDoc, tab: BuiltInTab): FieldEntry[] {
    return type.fields.filter((entry) => builtInTabOf(entry.spec) === tab);
}
