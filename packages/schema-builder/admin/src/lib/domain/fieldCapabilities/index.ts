import type { FieldDoc, FieldDocType } from '@orthacms/schema-builder-domain';
import { kindOf } from '../fieldCatalog';

/** One editor on the Validation tab. */
export type ValidationEditor =
    | 'length'
    | 'pattern'
    | 'structure'
    | 'range'
    | 'integer'
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
    // A select's options are a basic, not a rule: the default is picked
    // from them, so they sit above it on the General tab.
    select: { validation: [], layout: true, placeholder: false },
    multiselect: { validation: [], layout: true, placeholder: false },
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

/**
 * The Validation editors for one field, by its **kind**: long text checks
 * no structure — it is a plain box, not a document, and its preset turns
 * the check off — so its switch is not offered.
 */
export function validationEditors(spec: FieldDoc): readonly ValidationEditor[] {
    const editors = FIELD_CAPABILITIES[spec.type].validation;
    return kindOf(spec) === 'longtext'
        ? editors.filter((editor) => editor !== 'structure')
        : editors;
}
