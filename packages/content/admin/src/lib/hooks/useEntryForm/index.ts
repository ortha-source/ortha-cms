import { useCallback, useMemo, useState } from 'react';
import { useIntl } from 'react-intl';
import type {
    ContentTypeDetail,
    EntryValidationIssue
} from '../../types/contentType';
import { validateEntryValues } from '../../utils/validateEntryValues';

/** Controlled form state for a content entry, plus its operations. */
export type EntryFormState = {
    /** Current values, keyed by field name. */
    values: Record<string, unknown>;
    /**
     * The **strict** validation errors (required enforced), keyed by field name.
     * Exposed so callers (e.g. the editor's publish gate) reuse this single
     * computation rather than re-running validation over the same values.
     */
    errors: Record<string, string>;
    /** The error to show for a field (only once touched or after a submit). */
    errorFor: (name: string) => string | undefined;
    /** Set one field's value. */
    setValue: (name: string, value: unknown) => void;
    /** Mark a field touched (typically on blur) so its error can show. */
    touch: (name: string) => void;
    /**
     * Validate **strictly** (required enforced) and, if clean, hand the values
     * to `onValid`; otherwise reveal every field's error. For publish / saving an
     * always-live type. Returns whether it submitted.
     */
    submit: (onValid: (values: Record<string, unknown>) => void) => boolean;
    /**
     * Validate with **required relaxed** (format only) and, if clean, hand the
     * values to `onValid`; otherwise reveal every field's format error. For
     * saving a publishable **draft** — incomplete is fine, but a malformed value
     * is still gated before it reaches the server. Returns whether it submitted.
     */
    submitDraft: (onValid: (values: Record<string, unknown>) => void) => boolean;
    /**
     * Apply server-side validation issues (a 422 from the write API) onto the
     * form so they show inline on the right fields, even when client validation
     * thought the form was clean. Each clears as soon as its field is edited.
     */
    setServerErrors: (issues: EntryValidationIssue[]) => void;
};

/**
 * Owns a content entry form's state: values seeded from `initialValues`, live
 * validation against the schema (mirroring the server rules via
 * {@link validateEntryValues}), and touched/submitted tracking so an error only
 * appears once the user has interacted with a field or tried to save. Re-seeds
 * when `initialValues` identity changes (a new record loaded).
 */
export function useEntryForm(
    schema: ContentTypeDetail,
    initialValues: Record<string, unknown>,
    options: { ignoreFields?: ReadonlySet<string> } = {}
): EntryFormState {
    const intl = useIntl();
    const { ignoreFields } = options;
    const [values, setValues] = useState(initialValues);
    const [touched, setTouched] = useState<Set<string>>(new Set());
    const [submitted, setSubmitted] = useState(false);
    // A draft submit reveals format errors across all fields without nagging
    // about empty required ones (distinct from the strict `submitted`).
    const [draftSubmitted, setDraftSubmitted] = useState(false);
    // Field-keyed messages the server rejected the last save with.
    const [serverErrors, setServerErrorState] = useState<
        Record<string, string>
    >({});

    // Re-seed when a different record's values arrive (identity change).
    const [seededFrom, setSeededFrom] = useState(initialValues);
    if (seededFrom !== initialValues) {
        setSeededFrom(initialValues);
        setValues(initialValues);
        setTouched(new Set());
        setSubmitted(false);
        setDraftSubmitted(false);
        setServerErrorState({});
    }

    // Full errors (required enforced) gate a strict submit and show after one.
    const errors = useMemo(
        () => validateEntryValues(schema, values, intl, { ignoreFields }),
        [schema, values, intl, ignoreFields]
    );
    // Draft errors (required relaxed) are what a touched field shows live, so
    // drafting never nags about empty required fields — only their format.
    const draftErrors = useMemo(
        () =>
            validateEntryValues(schema, values, intl, {
                requireRequired: false,
                ignoreFields
            }),
        [schema, values, intl, ignoreFields]
    );

    const setValue = useCallback((name: string, value: unknown) => {
        setValues((current) => ({ ...current, [name]: value }));
        // Editing a field clears the stale server error it carried — the next
        // save re-checks it.
        setServerErrorState((current) => {
            if (!(name in current)) return current;
            const next = { ...current };
            delete next[name];
            return next;
        });
    }, []);

    const setServerErrors = useCallback((issues: EntryValidationIssue[]) => {
        setSubmitted(true);
        setServerErrorState(
            issues.reduce<Record<string, string>>((map, issue) => {
                // First message per field wins (matches the inline single-error UI).
                if (!(issue.field in map)) map[issue.field] = issue.message;
                return map;
            }, {})
        );
    }, []);

    const touch = useCallback((name: string) => {
        setTouched((current) =>
            current.has(name) ? current : new Set(current).add(name)
        );
    }, []);

    const errorFor = useCallback(
        (name: string) =>
            // A server-rejected field wins; then a strict submit reveals full
            // errors (incl. required); a draft submit (or a touched field)
            // reveals only the draft (format) error, so required never nags
            // while editing or saving a draft.
            serverErrors[name] ??
            (submitted
                ? errors[name]
                : draftSubmitted || touched.has(name)
                  ? draftErrors[name]
                  : undefined),
        [serverErrors, submitted, draftSubmitted, touched, errors, draftErrors]
    );

    const submit = useCallback(
        (onValid: (values: Record<string, unknown>) => void) => {
            setSubmitted(true);
            if (Object.keys(errors).length > 0) return false;
            onValid(values);
            return true;
        },
        [errors, values]
    );

    const submitDraft = useCallback(
        (onValid: (values: Record<string, unknown>) => void) => {
            setDraftSubmitted(true);
            if (Object.keys(draftErrors).length > 0) return false;
            onValid(values);
            return true;
        },
        [draftErrors, values]
    );

    return {
        values,
        errors,
        errorFor,
        setValue,
        touch,
        submit,
        submitDraft,
        setServerErrors
    };
}
