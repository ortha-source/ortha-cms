import { useCallback, useMemo, useState } from 'react';
import { useIntl } from 'react-intl';
import type { ContentTypeDetail } from '../../types/contentType';
import { validateEntryValues } from '../../utils/validateEntryValues';

/** Controlled form state for a content entry, plus its operations. */
export type EntryFormState = {
    /** Current values, keyed by field name. */
    values: Record<string, unknown>;
    /** The error to show for a field (only once touched or after a submit). */
    errorFor: (name: string) => string | undefined;
    /** Set one field's value. */
    setValue: (name: string, value: unknown) => void;
    /** Mark a field touched (typically on blur) so its error can show. */
    touch: (name: string) => void;
    /**
     * Validate and, if clean, hand the values to `onValid`. Otherwise reveals
     * every field's error. Returns whether it submitted.
     */
    submit: (onValid: (values: Record<string, unknown>) => void) => boolean;
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
    initialValues: Record<string, unknown>
): EntryFormState {
    const intl = useIntl();
    const [values, setValues] = useState(initialValues);
    const [touched, setTouched] = useState<Set<string>>(new Set());
    const [submitted, setSubmitted] = useState(false);

    // Re-seed when a different record's values arrive (identity change).
    const [seededFrom, setSeededFrom] = useState(initialValues);
    if (seededFrom !== initialValues) {
        setSeededFrom(initialValues);
        setValues(initialValues);
        setTouched(new Set());
        setSubmitted(false);
    }

    const errors = useMemo(
        () => validateEntryValues(schema, values, intl),
        [schema, values, intl]
    );

    const setValue = useCallback((name: string, value: unknown) => {
        setValues((current) => ({ ...current, [name]: value }));
    }, []);

    const touch = useCallback((name: string) => {
        setTouched((current) =>
            current.has(name) ? current : new Set(current).add(name)
        );
    }, []);

    const errorFor = useCallback(
        (name: string) =>
            submitted || touched.has(name) ? errors[name] : undefined,
        [submitted, touched, errors]
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

    return { values, errorFor, setValue, touch, submit };
}
