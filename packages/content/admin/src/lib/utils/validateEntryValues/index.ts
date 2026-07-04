import { defineMessages, type IntlShape } from 'react-intl';
import type { ContentField, ContentTypeDetail } from '../../types/contentType';
import { CONTENT_FIELD_TYPE } from '../../constants';

/**
 * Client-side validation messages. The server's `EntryValidationService` is the
 * real authority; these mirror its rules one-for-one so the form catches the
 * same problems before a (future) write request, with localized copy.
 */
const messages = defineMessages({
    required: { id: 'content.form.error.required', defaultMessage: 'Required' },
    string: {
        id: 'content.form.error.string',
        defaultMessage: 'Must be text'
    },
    minLength: {
        id: 'content.form.error.minLength',
        defaultMessage: 'Must be at least {min} characters'
    },
    maxLength: {
        id: 'content.form.error.maxLength',
        defaultMessage: 'Must be at most {max} characters'
    },
    pattern: {
        id: 'content.form.error.pattern',
        defaultMessage: 'Has an invalid format'
    },
    number: {
        id: 'content.form.error.number',
        defaultMessage: 'Must be a number'
    },
    integer: {
        id: 'content.form.error.integer',
        defaultMessage: 'Must be a whole number'
    },
    min: { id: 'content.form.error.min', defaultMessage: 'Must be ≥ {min}' },
    max: { id: 'content.form.error.max', defaultMessage: 'Must be ≤ {max}' },
    date: {
        id: 'content.form.error.date',
        defaultMessage: 'Must be a valid date'
    },
    datetime: {
        id: 'content.form.error.datetime',
        defaultMessage: 'Must be a valid date and time'
    },
    option: {
        id: 'content.form.error.option',
        defaultMessage: 'Choose one of the allowed options'
    },
    options: {
        id: 'content.form.error.options',
        defaultMessage: 'Every value must be an allowed option'
    },
    json: {
        id: 'content.form.error.json',
        defaultMessage: 'Must be valid JSON'
    },
    entryId: {
        id: 'content.form.error.entryId',
        defaultMessage: 'Must be a valid entry id'
    },
    entryIds: {
        id: 'content.form.error.entryIds',
        defaultMessage: 'Must be a list of valid entry ids'
    }
});

const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME_RE =
    /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/;

/** True for a null/undefined/blank/empty-array value (mirrors the server). */
function isEmpty(value: unknown): boolean {
    return (
        value === undefined ||
        value === null ||
        (typeof value === 'string' && value.trim() === '') ||
        (Array.isArray(value) && value.length === 0)
    );
}

/**
 * A many/inverse relation is **link-managed** — staged and sent as a delta, not
 * carried in the form `values` — so it's never a form value to validate. (An
 * owning single relation stays a plain FK id in `values` and is validated.)
 */
function isLinkManaged(field: ContentField): boolean {
    return (
        field.type === CONTENT_FIELD_TYPE.Relation &&
        (!!field.relation?.many || !!field.relation?.inverse)
    );
}

/** Reads `validation` props with the loose wire typing the admin sees. */
function rules(field: ContentField) {
    return field.validation as {
        minLength?: number;
        maxLength?: number;
        pattern?: string;
        min?: number;
        max?: number;
        integer?: boolean;
    };
}

/** The first validation error for one field, or `undefined` if it passes. */
function checkField(
    field: ContentField,
    value: unknown,
    intl: IntlShape,
    requireRequired: boolean
): string | undefined {
    const t = (
        descriptor: Parameters<IntlShape['formatMessage']>[0],
        v?: Record<string, string | number>
    ) => intl.formatMessage(descriptor, v);

    if (isEmpty(value)) {
        // `required` is only an error when we're enforcing it (a publish, or a
        // save of an always-live type) — not while drafting.
        return requireRequired && field.required
            ? t(messages.required)
            : undefined;
    }

    const v = rules(field);
    switch (field.type) {
        case CONTENT_FIELD_TYPE.Text:
        case CONTENT_FIELD_TYPE.RichText: {
            if (typeof value !== 'string') return t(messages.string);
            if (v.minLength !== undefined && value.length < v.minLength)
                return t(messages.minLength, { min: v.minLength });
            if (v.maxLength !== undefined && value.length > v.maxLength)
                return t(messages.maxLength, { max: v.maxLength });
            if (v.pattern && !safeMatch(v.pattern, value))
                return t(messages.pattern);
            return undefined;
        }
        case CONTENT_FIELD_TYPE.Number:
        case CONTENT_FIELD_TYPE.Money: {
            const n = typeof value === 'number' ? value : Number(value);
            if (Number.isNaN(n)) return t(messages.number);
            if (v.integer && !Number.isInteger(n)) return t(messages.integer);
            if (v.min !== undefined && n < v.min)
                return t(messages.min, { min: v.min });
            if (v.max !== undefined && n > v.max)
                return t(messages.max, { max: v.max });
            return undefined;
        }
        case CONTENT_FIELD_TYPE.Boolean:
            return undefined; // a checkbox is always a valid boolean
        case CONTENT_FIELD_TYPE.Date:
            return typeof value === 'string' && DATE_RE.test(value)
                ? undefined
                : t(messages.date);
        case CONTENT_FIELD_TYPE.Datetime:
            return typeof value === 'string' && DATETIME_RE.test(value)
                ? undefined
                : t(messages.datetime);
        case CONTENT_FIELD_TYPE.Select: {
            const allowed = field.options ?? [];
            return typeof value === 'string' && allowed.includes(value)
                ? undefined
                : t(messages.option);
        }
        case CONTENT_FIELD_TYPE.Multiselect: {
            const allowed = field.options ?? [];
            const ok =
                Array.isArray(value) &&
                value.every(
                    (item) => typeof item === 'string' && allowed.includes(item)
                );
            return ok ? undefined : t(messages.options);
        }
        case CONTENT_FIELD_TYPE.Json:
            return isParsableJson(value) ? undefined : t(messages.json);
        case CONTENT_FIELD_TYPE.Relation: {
            if (field.relation?.many) {
                const ok =
                    Array.isArray(value) &&
                    value.every(
                        (id) => typeof id === 'string' && UUID_RE.test(id)
                    );
                return ok ? undefined : t(messages.entryIds);
            }
            return typeof value === 'string' && UUID_RE.test(value)
                ? undefined
                : t(messages.entryId);
        }
        default:
            return undefined;
    }
}

/**
 * Compiled-pattern cache: validation runs on every keystroke across the whole
 * form, so compile each `pattern` once and reuse it (`null` = uncompilable).
 */
const patternCache = new Map<string, RegExp | null>();

/** Tests `value` against `pattern`, treating an unparseable pattern as a pass. */
function safeMatch(pattern: string, value: string): boolean {
    let regex = patternCache.get(pattern);
    if (regex === undefined) {
        try {
            regex = new RegExp(pattern);
        } catch {
            regex = null;
        }
        patternCache.set(pattern, regex);
    }
    return regex ? regex.test(value) : true;
}

/** Whether a value is valid JSON: an already-parsed value, or a parsable string. */
function isParsableJson(value: unknown): boolean {
    if (typeof value !== 'string') return true;
    try {
        JSON.parse(value);
        return true;
    } catch {
        return false;
    }
}

/**
 * Validate a `values` bag against a content type's field schema. Returns a map
 * of field name → first error message (empty when valid). Unknown/hidden fields
 * aren't validated here — the form only renders schema fields.
 *
 * `requireRequired` (default `true`) toggles enforcement of `required`: pass
 * `false` for the "draft" view, where empty fields are allowed and only the
 * *format* of a value that's present is checked. Publishing (or saving an
 * always-live, non-publishable type) validates with it `true`.
 *
 * `ignoreFields` skips fields by name — used for relation fields the editor
 * hides because their target collection isn't granted to the open workspace, so
 * the form doesn't block a save/publish on a field the user can't see or fill.
 */
export function validateEntryValues(
    schema: ContentTypeDetail,
    values: Record<string, unknown>,
    intl: IntlShape,
    options: {
        requireRequired?: boolean;
        ignoreFields?: ReadonlySet<string>;
    } = {}
): Record<string, string> {
    const requireRequired = options.requireRequired ?? true;
    const ignoreFields = options.ignoreFields;
    const errors: Record<string, string> = {};
    for (const field of schema.fields) {
        if (ignoreFields?.has(field.name)) continue;
        // Link-managed relations aren't form values (they live in the staged
        // delta), so there's nothing in `values` to validate — and a required
        // one would otherwise be a permanent, un-fillable "Required" error.
        if (isLinkManaged(field)) continue;
        const error = checkField(
            field,
            values[field.name],
            intl,
            requireRequired
        );
        if (error) errors[field.name] = error;
    }
    return errors;
}
