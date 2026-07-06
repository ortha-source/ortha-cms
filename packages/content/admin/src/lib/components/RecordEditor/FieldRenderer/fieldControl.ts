import type { ComponentType } from 'react';
import type { FieldDef } from '../../../types/recordDraft';

/**
 * Props every field control receives. The control owns only the *input*; its
 * label, helper text, error, and (for long-form) collapse chrome are the
 * wrapper's job — so a control stays a pure editor for one value.
 */
export type FieldControlProps = {
    field: FieldDef;
    value: unknown;
    /** Whether the field currently fails validation (drives the red border). */
    invalid: boolean;
    /** Id the label's `htmlFor` targets — set on the focusable input/trigger. */
    inputId: string;
    /** Id(s) of the helper/error text describing the input, for `aria-describedby`. */
    describedById?: string;
    onChange: (value: unknown) => void;
    onBlur: () => void;
};

/** A registered control component for one field type. */
export type FieldControl = ComponentType<FieldControlProps>;

/** Coerce any value to a text string for a controlled input. */
export function asText(value: unknown): string {
    if (value === null || value === undefined) return '';
    return typeof value === 'string' ? value : String(value);
}
