import type { FieldEntry, TypeDoc } from '@orthacms/schema-builder-domain';

/**
 * The entry editor's tabs a schema reaches. They are built in — a schema
 * cannot add one — and since the editor became one form (ADR-0022) every
 * field lands on the same one, Content: relations and media included, in the
 * schema's order beside the rest. It used to be decided by a field's type
 * (relations and media had tabs of their own).
 */
export type BuiltInTab = 'general';

/** A type's fields on the one form, in declaration order. */
export function fieldsOnTab(type: TypeDoc, tab: BuiltInTab): FieldEntry[] {
    return tab === 'general' ? type.fields : [];
}
