import type { FieldDoc, FieldDocType } from '@orthacms/schema-builder-domain';

/** One choice the "Add a field" page offers: a DSL type, or a preset of one. */
export type FieldCatalogEntry = {
    /** Stable id of the choice — unique, unlike `type`, which a preset shares. */
    readonly id: string;
    readonly type: FieldDocType;
    /** The spec a new field of this kind starts from — the DSL's options, nothing more. */
    readonly spec: (types: readonly string[]) => FieldDoc;
};

/**
 * Every field type in the DSL, in the order the page shows them, plus one
 * preset: **long text** is a `richtext` field with the `textarea` widget —
 * how the DSL says "a plain box of text", which the entry editor draws as one.
 * A preset is a starting spec, not a new type (ADR-0020 §5).
 */
export const FIELD_CATALOG: readonly FieldCatalogEntry[] = [
    { id: 'text', type: 'text', spec: () => ({ type: 'text' }) },
    {
        id: 'longtext',
        type: 'richtext',
        spec: () => ({ type: 'richtext', admin: { widget: 'textarea' } })
    },
    { id: 'richtext', type: 'richtext', spec: () => ({ type: 'richtext' }) },
    { id: 'number', type: 'number', spec: () => ({ type: 'number' }) },
    { id: 'money', type: 'money', spec: () => ({ type: 'money' }) },
    { id: 'boolean', type: 'boolean', spec: () => ({ type: 'boolean' }) },
    { id: 'date', type: 'date', spec: () => ({ type: 'date' }) },
    { id: 'datetime', type: 'datetime', spec: () => ({ type: 'datetime' }) },
    {
        id: 'select',
        type: 'select',
        spec: () => ({ type: 'select', options: ['option_1'] })
    },
    {
        id: 'multiselect',
        type: 'multiselect',
        spec: () => ({ type: 'multiselect', options: ['option_1'] })
    },
    { id: 'json', type: 'json', spec: () => ({ type: 'json' }) },
    // A relation needs a target to compile; the first type is a starting point the next step changes.
    {
        id: 'relation',
        type: 'relation',
        spec: (types) => ({ type: 'relation', to: types[0] ?? '' })
    },
    { id: 'media', type: 'media', spec: () => ({ type: 'media' }) }
];

/**
 * Which catalog choice a field is — its type, or the preset it was made
 * from: a rich-text field with the `textarea` widget is long text. The kind
 * decides the editor, so there is no separate control to pick.
 */
export const kindOf = (spec: FieldDoc): string =>
    spec.type === 'richtext' && spec.admin?.widget === 'textarea'
        ? 'longtext'
        : spec.type;

/** The catalog entry by id; the first one when the id is unknown. */
export const catalogEntry = (id: string): FieldCatalogEntry =>
    FIELD_CATALOG.find((entry) => entry.id === id) ?? FIELD_CATALOG[0];
