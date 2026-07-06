import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import {
    fieldError,
    isFilled,
    type FieldErrorCode
} from '../../utils/recordFieldValue';
import { saveRecordDraft } from '../../api/useRecordDraft';
import type {
    FieldDef,
    RecordDraft,
    RecordStatus,
    RecordValues
} from '../../types/recordDraft';

const messages = defineMessages({
    errRequired: {
        id: 'content.record.err.required',
        defaultMessage: 'This field is required to publish.'
    },
    errRange: {
        id: 'content.record.err.range',
        defaultMessage: 'Must be a whole number between {min} and {max}.'
    },
    errJson: {
        id: 'content.record.err.json',
        defaultMessage: 'Must be valid JSON.'
    },
    errUrl: {
        id: 'content.record.err.url',
        defaultMessage: 'Must be a valid URL.'
    }
});

/** How long after the last keystroke an autosave fires. */
const AUTOSAVE_DEBOUNCE_MS = 600;

/** The autosave indicator's lifecycle, mapped to top-bar copy by the caller. */
export type SaveState = 'saved' | 'saving' | 'published';

/** Derived per-field state — the outline, form, and gate all read from this. */
export interface FieldState {
    field: FieldDef;
    value: unknown;
    filled: boolean;
    /** Whether the user has interacted with the field (blur/change). */
    touched: boolean;
    /** Localized validation message, or `undefined` when the field passes. */
    error?: string;
    /** Required-empty or invalid — blocks publish. */
    blocking: boolean;
}

/** One row of the publish gate. */
export interface GateItem {
    key: string;
    label: string;
    ok: boolean;
    message?: string;
}

/** Localize a {@link FieldErrorCode} to its user-facing message. */
function useErrorFormatter() {
    const intl = useIntl();
    return useCallback(
        (code: FieldErrorCode | null): string | undefined => {
            if (!code) return undefined;
            switch (code.kind) {
                case 'required':
                    return intl.formatMessage(messages.errRequired);
                case 'range':
                    return intl.formatMessage(messages.errRange, {
                        min: code.min ?? 0,
                        max: code.max ?? 0
                    });
                case 'json':
                    return intl.formatMessage(messages.errJson);
                case 'url':
                    return intl.formatMessage(messages.errUrl);
            }
        },
        [intl]
    );
}

/**
 * The editor's single source of truth: values, touched flags, publish status,
 * and everything derived from them (per-field state, filled counts, the publish
 * gate, the live display name). Owns autosave — every {@link setValue} schedules
 * a debounced mock save and flips the indicator — and the publish/unpublish
 * transitions. Nothing else keeps "filled" bookkeeping; it is all recomputed
 * here from the values.
 *
 * Seed once from `draft` (via `useState` initializers): the caller remounts this
 * on collection/record/locale change (a React `key`), so there is no re-seed
 * effect to fight the user's edits.
 */
export function useRecordEditor(draft: RecordDraft) {
    const formatError = useErrorFormatter();

    const [values, setValues] = useState<RecordValues>(() => ({
        ...draft.values
    }));
    const [touched, setTouched] = useState<Record<string, boolean>>({});
    const [status, setStatus] = useState<RecordStatus>(draft.status);
    const [updatedAt, setUpdatedAt] = useState<string>(draft.updatedAt);
    const [saveState, setSaveState] = useState<SaveState>('saved');

    // Autosave plumbing: a pending debounce timer and a liveness guard so a save
    // that resolves after unmount doesn't call setState.
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const alive = useRef(true);
    useEffect(() => {
        alive.current = true;
        return () => {
            alive.current = false;
            if (timer.current) clearTimeout(timer.current);
        };
    }, []);

    const persist = useCallback(
        async (publish: boolean) => {
            const result = await saveRecordDraft({
                id: draft.id,
                collection: draft.collection.name,
                locale: draft.locale,
                values,
                publish
            });
            if (!alive.current) return;
            setUpdatedAt(result.updatedAt);
            setSaveState(publish ? 'published' : 'saved');
        },
        [draft.id, draft.collection.name, draft.locale, values]
    );

    // Debounced autosave, scheduled on every edit. Editing a *published* record
    // flips it straight back to Draft (the badge/gate react immediately), then
    // the mock PATCH runs after the debounce.
    const scheduleSave = useCallback(() => {
        setSaveState('saving');
        setStatus((current) => (current === 'published' ? 'draft' : current));
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => {
            void persist(false);
        }, AUTOSAVE_DEBOUNCE_MS);
    }, [persist]);

    const setValue = useCallback(
        (key: string, value: unknown) => {
            setValues((current) => ({ ...current, [key]: value }));
            setTouched((current) =>
                current[key] ? current : { ...current, [key]: true }
            );
            scheduleSave();
        },
        [scheduleSave]
    );

    const touch = useCallback((key: string) => {
        setTouched((current) =>
            current[key] ? current : { ...current, [key]: true }
        );
    }, []);

    // Per-field derived state, in schema order — the one array the outline,
    // form, and gate all read.
    const fieldStates = useMemo<FieldState[]>(
        () =>
            draft.fields.map((field) => {
                const value = values[field.key];
                const code = fieldError(field, value);
                return {
                    field,
                    value,
                    filled: isFilled(field.type, value),
                    touched: !!touched[field.key],
                    error: formatError(code),
                    blocking: code !== null
                };
            }),
        [draft.fields, values, touched, formatError]
    );

    const filledCount = fieldStates.filter((state) => state.filled).length;
    const requiredCount = draft.fields.filter((field) => field.required).length;
    const requiredRemaining = fieldStates.filter(
        (state) => state.field.required && !state.filled
    ).length;

    // The publish gate: every required field, plus any field whose value is
    // invalid, each with its live pass/fail. Recomputed from `fieldStates`, so
    // it re-runs on every change with zero extra bookkeeping.
    const gate = useMemo(() => {
        const items: GateItem[] = fieldStates
            .filter((state) => state.field.required || state.error)
            .map((state) => ({
                key: state.field.key,
                label: state.field.label,
                ok: !state.blocking,
                message: state.error
            }));
        return { items, blocking: items.some((item) => !item.ok) };
    }, [fieldStates]);

    // The first field that blocks publish, for the "scroll to the problem"
    // affordance when a disabled Publish is clicked.
    const firstBlockingKey = fieldStates.find((state) => state.blocking)?.field
        .key;

    // The record's live display name — the title field's value, or a fallback.
    const displayName = useMemo(() => {
        const raw = values[draft.collection.titleField];
        return typeof raw === 'string' && raw.trim().length > 0
            ? raw.trim()
            : undefined;
    }, [values, draft.collection.titleField]);

    const publish = useCallback(() => {
        if (gate.blocking) return;
        if (timer.current) clearTimeout(timer.current);
        setStatus('published');
        setSaveState('saving');
        void persist(true);
    }, [gate.blocking, persist]);

    const unpublish = useCallback(() => {
        if (timer.current) clearTimeout(timer.current);
        setStatus('draft');
        setSaveState('saving');
        void persist(false);
    }, [persist]);

    return {
        values,
        setValue,
        touch,
        status,
        updatedAt,
        createdAt: draft.createdAt,
        saveState,
        fieldStates,
        filledCount,
        totalCount: draft.fields.length,
        requiredCount,
        requiredRemaining,
        gate,
        firstBlockingKey,
        displayName,
        publish,
        unpublish
    };
}

/** The shape returned by {@link useRecordEditor}, for prop typing downstream. */
export type RecordEditor = ReturnType<typeof useRecordEditor>;
