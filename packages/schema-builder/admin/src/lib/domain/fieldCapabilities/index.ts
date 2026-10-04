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
    /** Render hints the stock admin understands for this type. */
    readonly widgets: readonly string[];
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
        widgets: ['slug'],
        placeholder: true
    },
    richtext: {
        validation: ['length', 'structure'],
        layout: true,
        widgets: ['textarea'],
        placeholder: true
    },
    number: {
        validation: ['range', 'integer'],
        layout: true,
        widgets: [],
        placeholder: true
    },
    money: {
        validation: ['range'],
        layout: true,
        widgets: [],
        placeholder: true
    },
    boolean: { validation: [], layout: true, widgets: [], placeholder: false },
    date: { validation: [], layout: true, widgets: [], placeholder: false },
    datetime: { validation: [], layout: true, widgets: [], placeholder: false },
    select: {
        validation: ['options'],
        layout: true,
        widgets: [],
        placeholder: false
    },
    multiselect: {
        validation: ['options'],
        layout: true,
        widgets: [],
        placeholder: false
    },
    json: { validation: [], layout: true, widgets: [], placeholder: false },
    relation: {
        validation: [],
        layout: false,
        widgets: [],
        placeholder: false
    },
    media: {
        validation: ['mediaAccept'],
        layout: false,
        widgets: [],
        placeholder: false
    }
};
