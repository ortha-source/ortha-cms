import type { FieldDocType } from '@orthacms/schema-builder-domain';

/** One editor on the Validation tab. */
export type ValidationEditor =
    | 'length'
    | 'pattern'
    | 'structure'
    | 'range'
    | 'integer'
    | 'options'
    | 'mediaAccept';

/** What the field sheet offers for one field type. */
export type FieldCapability = {
    /** Editors on the Validation tab, in order. Empty → the tab is not shown. */
    readonly validation: readonly ValidationEditor[];
    /** Group, width and row — moot for a field drawn on its own built-in tab. */
    readonly layout: boolean;
    /** A placeholder means something for this control. */
    readonly placeholder: boolean;
};

/**
 * The field sheet, type by type, mirroring the DSL's `*FieldOptions` one to
 * one (ADR-0020 §5): the builder offers nothing the DSL cannot express.
 */
export const FIELD_CAPABILITIES: Readonly<
    Record<FieldDocType, FieldCapability>
> = {
    text: {
        validation: ['length', 'pattern'],
        layout: true,
        placeholder: true
    },
    richtext: {
        validation: ['length', 'structure'],
        layout: true,
        placeholder: true
    },
    number: {
        validation: ['range', 'integer'],
        layout: true,
        placeholder: true
    },
    money: {
        validation: ['range'],
        layout: true,
        placeholder: true
    },
    boolean: { validation: [], layout: true, placeholder: false },
    date: { validation: [], layout: true, placeholder: false },
    datetime: { validation: [], layout: true, placeholder: false },
    select: {
        validation: ['options'],
        layout: true,
        placeholder: false
    },
    multiselect: {
        validation: ['options'],
        layout: true,
        placeholder: false
    },
    json: { validation: [], layout: true, placeholder: false },
    relation: {
        validation: [],
        layout: false,
        placeholder: false
    },
    media: {
        validation: ['mediaAccept'],
        layout: false,
        placeholder: false
    }
};
