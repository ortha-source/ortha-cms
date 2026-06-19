/**
 * Field builders — the `f.*` vocabulary used inside `collection()` /
 * `single()` definitions. Each builder normalizes its options into a
 * {@link FieldSpec} and carries the value type as a phantom generic so
 * `InferEntry` can derive row types with correct nullability.
 */

import type {
    BaseFieldOptions,
    FieldSpec,
    FieldType,
    FieldValidation,
    MoneyFieldOptions,
    NumberFieldOptions,
    RelationFieldOptions,
    SelectFieldOptions,
    TextFieldOptions,
    WithRequired
} from '../types/fields';

/** Builds the common part of every spec from the shared base options. */
function base<TType extends FieldType>(
    type: TType,
    options: BaseFieldOptions = {},
    validation: FieldValidation = {}
) {
    return {
        type,
        required: options.required ?? false,
        validation,
        admin: options.admin ?? {}
    };
}

/** Short text. Validation: minLength / maxLength / pattern. */
function text<const O extends TextFieldOptions = TextFieldOptions>(
    options?: O
): FieldSpec<'text', WithRequired<O, string>> {
    const { minLength, maxLength, pattern } = options ?? {};
    if (pattern !== undefined) {
        // Fail at definition time (boot) rather than on the first value that
        // hits validation, if the author wrote an unparseable pattern.
        try {
            new RegExp(pattern);
        } catch (cause) {
            throw new Error(
                `Invalid regex pattern ${JSON.stringify(pattern)} on a text ` +
                    `field: ${(cause as Error).message}`
            );
        }
    }
    return base('text', options, { minLength, maxLength, pattern });
}

/** Long-form rich text (block-based in the admin). Stored as text. */
function richtext<const O extends TextFieldOptions = TextFieldOptions>(
    options?: O
): FieldSpec<'richtext', WithRequired<O, string>> {
    const { minLength, maxLength } = options ?? {};
    return base('richtext', options, { minLength, maxLength });
}

/** Floating-point number (or integer with `integer: true`). */
function number<const O extends NumberFieldOptions = NumberFieldOptions>(
    options?: O
): FieldSpec<'number', WithRequired<O, number>> {
    const { min, max, integer } = options ?? {};
    return base('number', options, { min, max, integer });
}

/** Money in integer minor units (cents) — exact, no float drift. */
function money<const O extends MoneyFieldOptions = MoneyFieldOptions>(
    options?: O
): FieldSpec<'money', WithRequired<O, number>> {
    const { min, max } = options ?? {};
    return base('money', options, { min, max, integer: true });
}

/** True/false. Stored NOT NULL with default false when `required`. */
function boolean<const O extends BaseFieldOptions = BaseFieldOptions>(
    options?: O
): FieldSpec<'boolean', WithRequired<O, boolean>> {
    return base('boolean', options);
}

/** Calendar date (no time of day), ISO `YYYY-MM-DD`. */
function date<const O extends BaseFieldOptions = BaseFieldOptions>(
    options?: O
): FieldSpec<'date', WithRequired<O, string>> {
    return base('date', options);
}

/** Point in time, stored as timestamptz. */
function datetime<const O extends BaseFieldOptions = BaseFieldOptions>(
    options?: O
): FieldSpec<'datetime', WithRequired<O, Date>> {
    return base('datetime', options);
}

/** One of a fixed set of strings. The value type narrows to the options. */
function select<const O extends SelectFieldOptions>(
    options: O
): FieldSpec<'select', WithRequired<O, O['options'][number]>> {
    return { ...base('select', options), options: options.options };
}

/** Arbitrary JSON payload (jsonb). Escape hatch — prefer typed fields. */
function json<const O extends BaseFieldOptions = BaseFieldOptions>(
    options?: O
): FieldSpec<'json', WithRequired<O, unknown>> {
    return base('json', options);
}

/** Reference to a media asset (asset id; the media plugin resolves it). */
function media<const O extends BaseFieldOptions = BaseFieldOptions>(
    options?: O
): FieldSpec<'media', WithRequired<O, string>> {
    return base('media', options);
}

/**
 * Relation to another content type — a real Postgres foreign key.
 * Single (`many: false`) becomes a `<field>_id` uuid FK column;
 * `many: true` becomes a generated join table. `to` is a thunk so
 * mutually-referencing collection files can import each other.
 */
function relation<const O extends RelationFieldOptions>(
    options: O
): FieldSpec<
    'relation',
    O extends { many: true } ? string[] : WithRequired<O, string>
> {
    return {
        ...base('relation', options),
        relation: {
            to: options.to,
            many: options.many ?? false,
            onDelete:
                options.onDelete ?? (options.required ? 'cascade' : 'set null')
        }
    };
}

/** The field-builder vocabulary: `f.text()`, `f.relation()`, … */
export const f = {
    text,
    richtext,
    number,
    money,
    boolean,
    date,
    datetime,
    select,
    json,
    media,
    relation
};
