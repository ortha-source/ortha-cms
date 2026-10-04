import type { FieldDoc, FieldDocType } from '@orthacms/schema-builder-domain';

/** One field type the "Add field" dialog offers. */
export type FieldCatalogEntry = {
    readonly type: FieldDocType;
    /** The spec a new field of this type starts from — the DSL's defaults, nothing more. */
    readonly spec: (types: readonly string[]) => FieldDoc;
};

/** Every field type in the DSL, in the order the dialog shows them. */
export const FIELD_CATALOG: readonly FieldCatalogEntry[] = [
    { type: 'text', spec: () => ({ type: 'text' }) },
    { type: 'richtext', spec: () => ({ type: 'richtext' }) },
    { type: 'number', spec: () => ({ type: 'number' }) },
    { type: 'money', spec: () => ({ type: 'money' }) },
    { type: 'boolean', spec: () => ({ type: 'boolean' }) },
    { type: 'date', spec: () => ({ type: 'date' }) },
    { type: 'datetime', spec: () => ({ type: 'datetime' }) },
    { type: 'select', spec: () => ({ type: 'select', options: ['option_1'] }) },
    {
        type: 'multiselect',
        spec: () => ({ type: 'multiselect', options: ['option_1'] })
    },
    { type: 'json', spec: () => ({ type: 'json' }) },
    // A relation needs a target to compile; the first type is a starting point the sheet changes.
    {
        type: 'relation',
        spec: (types) => ({ type: 'relation', to: types[0] ?? '' })
    },
    { type: 'media', spec: () => ({ type: 'media' }) }
];
