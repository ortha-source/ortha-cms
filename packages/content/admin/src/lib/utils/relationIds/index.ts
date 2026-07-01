/**
 * Normalize a relation field's stored value to an id array. A single relation
 * holds one id string (or empty), a many-relation a string array. The single
 * definition shared by the {@link RelationField} editor and the
 * {@link RelationFieldSection} header count, so they can't disagree on what
 * "linked" means.
 */
export function toRelationIds(value: unknown, many: boolean): string[] {
    if (many) return Array.isArray(value) ? (value as string[]) : [];
    return typeof value === 'string' && value ? [value] : [];
}
