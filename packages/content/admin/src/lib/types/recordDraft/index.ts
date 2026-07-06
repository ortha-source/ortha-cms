/**
 * Types for the **dynamic record editor** — the schema-driven editor for a
 * single record of a collection whose field list arrives at runtime (never
 * hardcoded). Deliberately self-contained and decoupled from the live
 * `ContentTypeDetail` wire shape so the editor's design can be iterated against
 * a fixture before the content API grows a matching endpoint.
 */

/** Every field kind the editor can render. */
export type FieldType =
    | 'text'
    | 'number'
    | 'money'
    | 'date'
    | 'datetime'
    | 'boolean'
    | 'select'
    | 'multiselect'
    | 'richtext'
    | 'textarea'
    | 'json'
    | 'url';

/**
 * A single field's definition. `label`/`description`/`placeholder` are already
 * localized by the backend (or resolved from a message id) — the editor renders
 * them verbatim, so it stays agnostic to any one collection's schema.
 */
export interface FieldDef {
    /** Machine name, unique within the collection. */
    key: string;
    /** Display label. */
    label: string;
    type: FieldType;
    required?: boolean;
    /** Helper text under the input. */
    description?: string;
    /** Choices for `select` / `multiselect`. */
    options?: string[];
    /** Bounds for `number` (also used for `money` in minor units). */
    min?: number;
    max?: number;
    placeholder?: string;
}

/** Publish state of a record (per locale). */
export type RecordStatus = 'draft' | 'published';

/** A translation slot on the record: an existing locale or one not started. */
export interface RecordLocale {
    /** BCP-47-ish code used as the route param (`en`, `de`, `fr`). */
    code: string;
    /** Human label (`English`, `Deutsch`). */
    label: string;
    /** Publish state of this locale, or `null` when not yet translated. */
    status: RecordStatus | null;
}

/** The collection this record belongs to. */
export interface CollectionMeta {
    /** Machine name (route param). */
    name: string;
    /** Display name shown in the breadcrumb + card header. */
    label: string;
    /** One-line description under the card header. */
    description: string;
    /** Key of the field whose value is the record's live display name. */
    titleField: string;
}

/** A record draft: its schema, current values, and metadata. */
export interface RecordDraft {
    /** Stable entry id (UUID). */
    id: string;
    collection: CollectionMeta;
    status: RecordStatus;
    /** ISO timestamps. */
    createdAt: string;
    updatedAt: string;
    /** The locale currently being edited. */
    locale: string;
    /** Every translation slot, in display order. */
    locales: RecordLocale[];
    /** The field schema, in display order. */
    fields: FieldDef[];
    /** Current values, keyed by field key. */
    values: RecordValues;
}

/** A record's values, keyed by field key. Value shapes are per-{@link FieldType}. */
export type RecordValues = Record<string, unknown>;

/** The long-form field kinds — collapsible, one-per-line, never inline scalars. */
export const LONG_FORM_TYPES: readonly FieldType[] = [
    'richtext',
    'textarea',
    'json'
];

/** Whether a field renders as a collapsible long-form block. */
export function isLongForm(type: FieldType): boolean {
    return LONG_FORM_TYPES.includes(type);
}
