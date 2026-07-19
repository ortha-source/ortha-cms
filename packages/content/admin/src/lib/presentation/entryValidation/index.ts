import { defineMessages, type IntlShape } from 'react-intl';
import {
    isEmptyFieldValue,
    validateFieldValue,
    type ValidationIssue
} from '@ortha-cms/content-domain';
import type {
    ContentField,
    ContentTypeDetail
} from '../../domain/types/contentType';
import { toFieldSpec } from '../../infrastructure/entryFieldSpec';

/**
 * Client-side validation copy. The **rules** are no longer mirrored here — they
 * live once, in the shared `@ortha-cms/content-domain` kernel that the server also
 * validates against, so the admin and server can't drift. This module is a thin
 * i18n **anti-corruption layer**: it runs the kernel over a field's value and, for
 * a failing field, renders the kernel's (stable, English) issue reason as localized
 * copy. Parameters (`min`/`max`) are read from the field's own rules, never parsed
 * out of the kernel string.
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
    entryId: {
        id: 'content.form.error.entryId',
        defaultMessage: 'Must be a valid entry id'
    },
    entryIds: {
        id: 'content.form.error.entryIds',
        defaultMessage: 'Must be a list of valid entry ids'
    }
});

/** Reads a numeric validation rule off a field, for the localized parameters. */
function rule(field: ContentField, key: string): number | undefined {
    const value = (field.validation as Record<string, unknown>)[key];
    return typeof value === 'number' ? value : undefined;
}

/**
 * Localizes one kernel {@link ValidationIssue} for one field. Maps the kernel's
 * stable issue reason to a co-located message descriptor; an unmapped reason (only
 * types the admin form never renders, e.g. a raw boolean) falls back to the
 * kernel's own English message so nothing is ever shown blank.
 */
function localizeIssue(
    field: ContentField,
    issue: ValidationIssue,
    intl: IntlShape
): string {
    const m = issue.message;
    const t = (
        descriptor: Parameters<IntlShape['formatMessage']>[0],
        values?: Record<string, string | number>
    ) => intl.formatMessage(descriptor, values);

    if (m === 'is required') return t(messages.required);
    if (m === 'must be a string') return t(messages.string);
    if (m.startsWith('must be at least'))
        return t(messages.minLength, { min: rule(field, 'minLength') ?? 0 });
    if (m.startsWith('must be at most'))
        return t(messages.maxLength, { max: rule(field, 'maxLength') ?? 0 });
    if (m.startsWith('must match pattern')) return t(messages.pattern);
    if (m === 'must be a number') return t(messages.number);
    if (m === 'must be a whole number') return t(messages.integer);
    if (m.startsWith('must be ≥'))
        return t(messages.min, { min: rule(field, 'min') ?? 0 });
    if (m.startsWith('must be ≤'))
        return t(messages.max, { max: rule(field, 'max') ?? 0 });
    // date-time is checked before date: its reason is a prefix-superset.
    if (m.includes('date-time')) return t(messages.datetime);
    if (m.startsWith('must be an ISO date')) return t(messages.date);
    if (m.startsWith('must be one of')) return t(messages.option);
    if (m.startsWith('must be a subset')) return t(messages.options);
    if (m === 'must be an array of entry ids') return t(messages.entryIds);
    if (m === 'must be an entry id') return t(messages.entryId);
    return m;
}

/**
 * Validate a `values` bag against a content type's field schema **using the shared
 * kernel** as the sole rule set. Returns a map of field name → first (localized)
 * error message (empty when valid). Unknown/hidden fields aren't validated here —
 * the form only renders schema fields.
 *
 * `requireRequired` (default `true`) toggles enforcement of `required`: pass
 * `false` for the "draft" view, where empty fields are allowed and only the
 * *format* of a value that's present is checked. Publishing (or saving an
 * always-live, non-publishable type) validates with it `true`.
 *
 * `ignoreFields` skips fields by name — used for relation fields the editor hides
 * because their target collection isn't granted to the open workspace, so the form
 * doesn't block a save/publish on a field the user can't see or fill. (Link-managed
 * many/inverse relations are additionally skipped by the kernel itself.)
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
        const value = values[field.name];
        // Draft view: an empty value is allowed (required is relaxed), so only a
        // present-but-malformed value is gated. A non-empty value still runs the
        // full kernel rules below.
        if (!requireRequired && isEmptyFieldValue(value)) continue;
        const issues = validateFieldValue(field.name, toFieldSpec(field), value);
        if (issues.length > 0) errors[field.name] = localizeIssue(field, issues[0], intl);
    }
    return errors;
}
