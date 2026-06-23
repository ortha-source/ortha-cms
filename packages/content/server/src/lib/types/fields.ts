/**
 * Field-spec contracts for code-defined content types. A field spec is a
 * plain, JSON-serializable description (plus a lazy relation thunk) that
 * drives three things at once: the generated Postgres column, server-side
 * validation, and the admin's dynamic form rendering.
 */

import type { AnyContentType } from './content-type';

/**
 * Built-in field type identifiers. The runtime object is the single source of
 * truth; the {@link FieldType} union is derived from it so the two can never
 * drift, and every `switch`/comparison references `CONTENT_FIELD_TYPE.*`
 * instead of a bare string literal.
 */
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
    Relation: 'relation'
} as const;

/** Built-in field type identifiers. */
export type FieldType =
    (typeof CONTENT_FIELD_TYPE)[keyof typeof CONTENT_FIELD_TYPE];

/**
 * Presentation props forwarded verbatim to the admin (and any other
 * frontend) via `GET /api/content-schema`. The known keys are what the
 * stock admin reads; everything else passes through untouched, so a
 * project can attach its own hints. Must stay JSON-serializable.
 */
export interface AdminProps {
    /** Human label; falls back to the field name. */
    label?: string;
    /** Help text rendered under the input. */
    description?: string;
    /** Input placeholder. */
    placeholder?: string;
    /** Render hint, e.g. 'textarea', 'slug', 'color'. */
    widget?: string;
    /** Hide from the default form (still served by the API). */
    hidden?: boolean;
    /** Project-specific extras — passed through untouched. */
    [key: string]: unknown;
}

/**
 * Validation rules, serialized to the admin so the same constraints
 * render client-side. The server's EntryValidationService is the
 * authority; the admin copy is a courtesy.
 */
export interface FieldValidation {
    /** Minimum string length (text/richtext). */
    minLength?: number;
    /** Maximum string length (text/richtext). */
    maxLength?: number;
    /** ECMAScript regex source the value must match (text). */
    pattern?: string;
    /** Minimum numeric value (number/money). */
    min?: number;
    /** Maximum numeric value (number/money). */
    max?: number;
    /** Restrict to whole numbers (number). */
    integer?: boolean;
}

/** Referential action when a related row is deleted. */
export type RelationOnDelete = 'cascade' | 'set null' | 'restrict';

/** Runtime relation config carried by a relation field spec. */
export interface RelationSpec {
    /** Lazy target — a thunk so mutually-referencing files can import each other. */
    to: () => AnyContentType;
    /** Many-to-many (via a generated join table) vs a single FK column. */
    many: boolean;
    /** FK referential action; ignored for `many` (join rows just disappear). */
    onDelete: RelationOnDelete;
}

/** Options shared by every field builder. */
export interface BaseFieldOptions {
    /** Reject empty values; the column becomes NOT NULL. */
    required?: boolean;
    /** Presentation props forwarded to the admin. */
    admin?: AdminProps;
}

export interface TextFieldOptions extends BaseFieldOptions {
    minLength?: number;
    maxLength?: number;
    /** Regex source the value must match. */
    pattern?: string;
}

export interface NumberFieldOptions extends BaseFieldOptions {
    min?: number;
    max?: number;
    /** Restrict to whole numbers. */
    integer?: boolean;
}

/** Money is stored as integer minor units (cents) — exact, no float drift. */
export interface MoneyFieldOptions extends BaseFieldOptions {
    /** Minimum amount in minor units. */
    min?: number;
    /** Maximum amount in minor units. */
    max?: number;
}

export interface SelectFieldOptions<
    TOptions extends readonly string[] = readonly string[]
> extends BaseFieldOptions {
    /** Allowed values. */
    options: TOptions;
}

export interface RelationFieldOptions extends BaseFieldOptions {
    /** Lazy target content type. */
    to: () => AnyContentType;
    /** Many-to-many via a generated join table. Defaults to false. */
    many?: boolean;
    /** FK referential action. Defaults to 'set null' (or 'cascade' when required). */
    onDelete?: RelationOnDelete;
}

/**
 * The normalized field description every builder returns.
 *
 * `TValue` is a phantom type — it exists only so `InferEntry` can derive
 * the row type of a collection; nothing is stored in it at runtime.
 */
export interface FieldSpec<
    TType extends FieldType = FieldType,
    TValue = unknown
> {
    readonly type: TType;
    readonly required: boolean;
    readonly validation: FieldValidation;
    readonly admin: AdminProps;
    /** Allowed values — select fields only. */
    readonly options?: readonly string[];
    /** Relation config — relation fields only. */
    readonly relation?: RelationSpec;
    /** Phantom compile-time value type. Never assigned. */
    readonly _value?: TValue;
}

/** Any field spec, regardless of type/value. */
export type AnyFieldSpec = FieldSpec<FieldType, unknown>;

/** Value type of a field spec (null-aware via `required`). */
export type FieldValue<F> = F extends FieldSpec<FieldType, infer V> ? V : never;

/** Maps an options object to `V` when `required: true`, else `V | null`. */
export type WithRequired<O, V> = O extends { required: true } ? V : V | null;
