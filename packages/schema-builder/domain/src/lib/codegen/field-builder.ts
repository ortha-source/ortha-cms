import type { FieldDocType } from '../document/field-doc';

/** The DSL builder each field type is declared with. Inverses use `relationInverse`. */
export const FIELD_BUILDER: Readonly<Record<FieldDocType, string>> = {
    text: 'text',
    richtext: 'richtext',
    number: 'number',
    money: 'money',
    boolean: 'boolean',
    date: 'date',
    datetime: 'datetime',
    select: 'select',
    multiselect: 'multiselect',
    json: 'json',
    relation: 'relation',
    media: 'media'
};
