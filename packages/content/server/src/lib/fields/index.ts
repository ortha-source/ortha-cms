/**
 * Field builders — the `field.*` vocabulary used inside `collection()` /
 * `single()` definitions. Each builder normalizes its options into a
 * {@link FieldSpec} and carries the value type as a phantom generic so
 * `InferEntry` can derive row types with correct nullability.
 */

import { CONTENT_FIELD_TYPE, MEDIA_KIND_VALUES } from '../types/fields';
import type {
    BaseFieldOptions,
    FieldSpec,
    FieldType,
    FieldValidation,
    MediaFieldOptions,
    MoneyFieldOptions,
    NumberFieldOptions,
    RelationFieldOptions,
    RelationInverseFieldOptions,
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
        // Omitted (not `false`) when unset, so serialized specs stay lean and
        // the admin can treat presence as the flag.
        ...(options.localized ? { localized: true as const } : {}),
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
    return base(CONTENT_FIELD_TYPE.Text, options, {
        minLength,
        maxLength,
        pattern
    });
}

/** Long-form rich text (block-based in the admin). Stored as text. */
function richtext<const O extends TextFieldOptions = TextFieldOptions>(
    options?: O
): FieldSpec<'richtext', WithRequired<O, string>> {
    const { minLength, maxLength } = options ?? {};
    return base(CONTENT_FIELD_TYPE.RichText, options, { minLength, maxLength });
}

/** Floating-point number (or integer with `integer: true`). */
function number<const O extends NumberFieldOptions = NumberFieldOptions>(
    options?: O
): FieldSpec<'number', WithRequired<O, number>> {
    const { min, max, integer } = options ?? {};
    return base(CONTENT_FIELD_TYPE.Number, options, { min, max, integer });
}

/** Money in integer minor units (cents) — exact, no float drift. */
function money<const O extends MoneyFieldOptions = MoneyFieldOptions>(
    options?: O
): FieldSpec<'money', WithRequired<O, number>> {
    const { min, max } = options ?? {};
    return base(CONTENT_FIELD_TYPE.Money, options, { min, max, integer: true });
}

/** True/false. Stored NOT NULL with default false when `required`. */
function boolean<const O extends BaseFieldOptions = BaseFieldOptions>(
    options?: O
): FieldSpec<'boolean', WithRequired<O, boolean>> {
    return base(CONTENT_FIELD_TYPE.Boolean, options);
}

/** Calendar date (no time of day), ISO `YYYY-MM-DD`. */
function date<const O extends BaseFieldOptions = BaseFieldOptions>(
    options?: O
): FieldSpec<'date', WithRequired<O, string>> {
    return base(CONTENT_FIELD_TYPE.Date, options);
}

/** Point in time, stored as timestamptz. */
function datetime<const O extends BaseFieldOptions = BaseFieldOptions>(
    options?: O
): FieldSpec<'datetime', WithRequired<O, Date>> {
    return base(CONTENT_FIELD_TYPE.Datetime, options);
}

/** One of a fixed set of strings. The value type narrows to the options. */
function select<const O extends SelectFieldOptions>(
    options: O
): FieldSpec<'select', WithRequired<O, O['options'][number]>> {
    return {
        ...base(CONTENT_FIELD_TYPE.Select, options),
        options: options.options
    };
}

/** Several of a fixed set of strings, stored as a jsonb array of options. */
function multiselect<const O extends SelectFieldOptions>(
    options: O
): FieldSpec<'multiselect', WithRequired<O, O['options'][number][]>> {
    return {
        ...base(CONTENT_FIELD_TYPE.Multiselect, options),
        options: options.options
    };
}

/** Arbitrary JSON payload (jsonb). Escape hatch — prefer typed fields. */
function json<const O extends BaseFieldOptions = BaseFieldOptions>(
    options?: O
): FieldSpec<'json', WithRequired<O, unknown>> {
    return base(CONTENT_FIELD_TYPE.Json, options);
}

/**
 * Relation to another content type — a real Postgres foreign key.
 * Single (`many: false`) becomes a `<field>_id` uuid FK column;
 * `many: true` becomes a generated join table. `unique: true` adds a
 * `UNIQUE` constraint to the single FK column for a one-to-one relation.
 * `to` is a thunk so mutually-referencing collection files can import
 * each other.
 */
function relation<const O extends RelationFieldOptions>(
    options: O
): FieldSpec<
    'relation',
    O extends { many: true } ? string[] : WithRequired<O, string>
> {
    return {
        ...base(CONTENT_FIELD_TYPE.Relation, options),
        relation: {
            to: options.to,
            many: options.many ?? false,
            onDelete:
                options.onDelete ?? (options.required ? 'cascade' : 'set null'),
            unique: options.unique ?? false
        }
    };
}

/**
 * The **inverse** side of a two-way relation — a back-reference to the storage
 * owned by `of`'s `field`. Generates no column/table: it reads and writes the
 * same link the owning relation does (source/target swapped), so editing either
 * side stays in sync. `of` is a thunk so the two files can import each other.
 *
 * @example
 *   // article.ts owns:  tags: field.relation({ to: () => tag, many: true })
 *   // tag.ts mirrors:    articles: field.relationInverse({ of: () => article, field: 'tags' })
 */
function relationInverse<const O extends RelationInverseFieldOptions>(
    options: O
): FieldSpec<'relation', O extends { many: false } ? string : string[]> {
    return {
        ...base(CONTENT_FIELD_TYPE.Relation, options),
        relation: {
            to: options.of,
            many: options.many ?? true,
            onDelete: 'set null', // inert for a virtual (storage-less) field
            unique: false,
            inverse: { field: options.field }
        }
    };
}

/**
 * Attach one or more **Media Library** assets. Stores asset ids in the values
 * bag — a single `uuid` column (`multiple: false`), or a `jsonb` array of ids
 * (`multiple: true`), so media rides revisions and locale-sibling sync like any
 * other field. Asset ids are plain uuids, not a Postgres FK: the assets live in
 * the media plugin's own schema, so existence and the `accept` restriction are
 * enforced by the server on save (via the media-asset resolver), not the DB.
 */
function media<const O extends MediaFieldOptions = MediaFieldOptions>(
    options?: O
): FieldSpec<
    'media',
    O extends { multiple: true } ? string[] : WithRequired<O, string>
> {
    const accept = options?.accept;
    if (accept?.kinds) {
        // Fail at boot on a typo'd kind rather than silently accepting nothing.
        for (const kind of accept.kinds) {
            if (!MEDIA_KIND_VALUES.includes(kind)) {
                throw new Error(
                    `Invalid media kind ${JSON.stringify(kind)} on a media ` +
                        `field: expected one of ${MEDIA_KIND_VALUES.join(', ')}.`
                );
            }
        }
    }
    return {
        ...base(CONTENT_FIELD_TYPE.Media, options),
        multiple: options?.multiple ?? false,
        ...(accept ? { accept } : {})
    };
}

/** The field-builder vocabulary: `field.text()`, `field.relation()`, … */
export const field = {
    text,
    richtext,
    number,
    money,
    boolean,
    date,
    datetime,
    select,
    multiselect,
    json,
    relation,
    relationInverse,
    media
};
