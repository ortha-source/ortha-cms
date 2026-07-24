/**
 * Field-type identifiers and the shared empty-value test — the small, stable
 * vocabulary the pure validator switches on. These string values mirror
 * `content-server`'s `CONTENT_FIELD_TYPE` and `isEmptyFieldValue` one-for-one
 * (they are the JSON-serialized wire identifiers a `SerializedField.type`
 * carries), kept here so the kernel stays dependency-free — it imports nothing
 * from `content-server`, so `content-server` may depend on it without a cycle.
 */

/** Built-in field-type identifiers (the wire `type` of a serialized field). */
export const CONTENT_FIELD_TYPE = {
    Text: 'text',
    RichText: 'richtext',
    Number: 'number',
    Money: 'money',
    Boolean: 'boolean',
    Date: 'date',
    Datetime: 'datetime',
    Select: 'select',
    Multiselect: 'multiselect',
    Json: 'json',
    Relation: 'relation',
    Media: 'media'
} as const;

/** Built-in field-type identifiers. */
export type FieldType =
    (typeof CONTENT_FIELD_TYPE)[keyof typeof CONTENT_FIELD_TYPE];

/**
 * The canonical "no value" test for a field value — null/undefined, a blank
 * (whitespace-only) string, or an empty array. The single definition both
 * runtimes share (validation skips an empty value or trips `required`; the
 * server's row mappers collapse it to `null`). One authority so the runtimes
 * can't drift.
 */
export function isEmptyFieldValue(value: unknown): boolean {
    return (
        value === undefined ||
        value === null ||
        (typeof value === 'string' && value.trim() === '') ||
        (Array.isArray(value) && value.length === 0)
    );
}
