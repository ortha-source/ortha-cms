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

export interface MediaAcceptDoc {
    kinds?: string[];
    mimeTypes?: string[];
}

export type TextFieldDoc = FieldBase<'text'> &
    Rules<'minLength' | 'maxLength' | 'pattern'>;
export type RichTextFieldDoc = FieldBase<'richtext'> &
    Rules<'minLength' | 'maxLength' | 'structure'>;
export type NumberFieldDoc = FieldBase<'number'> &
    Rules<'min' | 'max' | 'integer'>;
export type MoneyFieldDoc = FieldBase<'money'> & Rules<'min' | 'max'>;
export type PlainFieldDoc = FieldBase<'boolean' | 'date' | 'datetime' | 'json'>;
export type SelectFieldDoc = FieldBase<'select' | 'multiselect'> & {
    options: string[];
};
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
    | PlainFieldDoc
    | SelectFieldDoc
    | MediaFieldDoc
    | RelationFieldDoc;

export type FieldDocType = FieldDoc['type'];
