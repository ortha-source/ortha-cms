import type { FieldDoc } from './field-doc';

/** A field in a type's ordered field list. */
export interface FieldEntry {
    /**
     * Stable across edits within one draft, so a rename or a reorder is never
     * read as a remove plus an add. Loaded fields use `<type>.<name>`; fields a
     * draft adds get a fresh id.
     */
    readonly key: string;
    name: string;
    spec: FieldDoc;
}

/** The key a field loaded from the registry gets. */
export const loadedFieldKey = (type: string, field: string): string =>
    `${type}.${field}`;
