/**
 * Pure, intl-free helpers for a dynamic record field's value: whether it counts
 * as *filled* (drives the outline dots + progress bar) and what, if anything, is
 * *wrong* with it (drives inline errors + the publish gate). Kept side-effect and
 * message free so both the hook and any tests can reason about a value without a
 * React or intl context.
 */

import type { FieldDef, FieldType } from '../../types/recordDraft';

/** A field's validation failure, as a code the UI localizes. */
export type FieldErrorCode =
    | { kind: 'required' }
    | { kind: 'range'; min?: number; max?: number }
    | { kind: 'json' }
    | { kind: 'url' };

/** Whether a value is present enough to count toward "filled". */
export function isFilled(type: FieldType, value: unknown): boolean {
    switch (type) {
        case 'number':
        case 'money':
            return typeof value === 'number' && Number.isFinite(value);
        case 'boolean':
            return typeof value === 'boolean';
        case 'multiselect':
            return Array.isArray(value) && value.length > 0;
        default:
            return typeof value === 'string' && value.trim().length > 0;
    }
}

/** Whether a string parses as JSON (empty is treated as absent, not invalid). */
function isValidJson(value: string): boolean {
    if (value.trim().length === 0) return true;
    try {
        JSON.parse(value);
        return true;
    } catch {
        return false;
    }
}

/** Whether a string is a parseable absolute URL. */
function isValidUrl(value: string): boolean {
    try {
        void new URL(value);
        return true;
    } catch {
        return false;
    }
}

/**
 * The single validation failure for a field's current value, or `null` when it
 * passes. Order matters: a required-empty field fails as `required` before any
 * format check runs (an empty value can't also be "invalid JSON").
 */
export function fieldError(
    field: FieldDef,
    value: unknown
): FieldErrorCode | null {
    const filled = isFilled(field.type, value);

    if (field.required && !filled) return { kind: 'required' };
    if (!filled) return null;

    if (field.type === 'number' || field.type === 'money') {
        const num = value as number;
        const belowMin = field.min !== undefined && num < field.min;
        const aboveMax = field.max !== undefined && num > field.max;
        const notWhole = field.type === 'number' && !Number.isInteger(num);
        if (belowMin || aboveMax || notWhole)
            return { kind: 'range', min: field.min, max: field.max };
    }

    if (field.type === 'json' && !isValidJson(value as string))
        return { kind: 'json' };

    if (field.type === 'url' && !isValidUrl(value as string))
        return { kind: 'url' };

    return null;
}
