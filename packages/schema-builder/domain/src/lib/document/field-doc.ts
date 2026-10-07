import type { FieldValidationRules } from '@orthacms/content-domain';
import type { FieldAdminDoc } from './field-admin-doc';
import type { RelationDoc } from './relation-doc';

interface FieldBase<T extends string> {
    type: T;
    required?: boolean;
    localized?: boolean;
    lang?: string;
    admin?: FieldAdminDoc;
}

type Rules<K extends keyof FieldValidationRules> = Pick<
    FieldValidationRules,
    K
>;

/**
 * The create form's prefill (`defaultValue` in the DSL) — offered on the
 * scalar and choice types only. A date may say `'today'`, a datetime `'now'`.
 */
type Default<V> = { defaultValue?: V };

export interface MediaAcceptDoc {
    kinds?: string[];
    mimeTypes?: string[];
}

export type TextFieldDoc = FieldBase<'text'> &
    Rules<'minLength' | 'maxLength' | 'pattern'> &
    Default<string>;
export type RichTextFieldDoc = FieldBase<'richtext'> &
    Rules<'minLength' | 'maxLength' | 'structure'>;
export type NumberFieldDoc = FieldBase<'number'> &
    Rules<'min' | 'max' | 'integer'> &
    Default<number>;
export type MoneyFieldDoc = FieldBase<'money'> &
    Rules<'min' | 'max'> &
    Default<number>;
export type BooleanFieldDoc = FieldBase<'boolean'> & Default<boolean>;
export type DateFieldDoc = FieldBase<'date' | 'datetime'> & Default<string>;
export type JsonFieldDoc = FieldBase<'json'>;
export type SelectFieldDoc = FieldBase<'select'> & {
    options: string[];
} & Default<string>;
export type MultiselectFieldDoc = FieldBase<'multiselect'> & {
    options: string[];
} & Default<string[]>;
export type MediaFieldDoc = FieldBase<'media'> & {
    multiple?: boolean;
    accept?: MediaAcceptDoc;
};
export type RelationFieldDoc = FieldBase<'relation'> & RelationDoc;

/**
 * One field as the builder edits it: the DSL's options for its type, as plain
 * JSON. Every key maps to one option of a `field.*` builder — the builder
 * offers nothing the DSL cannot express (ADR-0020).
 */
export type FieldDoc =
    | TextFieldDoc
    | RichTextFieldDoc
    | NumberFieldDoc
    | MoneyFieldDoc
    | BooleanFieldDoc
    | DateFieldDoc
    | JsonFieldDoc
    | SelectFieldDoc
    | MultiselectFieldDoc
    | MediaFieldDoc
    | RelationFieldDoc;

export type FieldDocType = FieldDoc['type'];
