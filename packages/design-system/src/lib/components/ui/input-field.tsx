import * as React from 'react';

import { Field, FieldLabel, FieldDescription, FieldError } from './field';
import { Input } from './input';

/**
 * Props for the {@link InputField} component. Extends the native `<input>`
 * props (which pass straight through to the control) with the surrounding
 * label, hint, and error pieces.
 */
type InputFieldProps = Omit<React.ComponentProps<'input'>, 'id'> & {
    /** Input id; also wires the label's `htmlFor`. Required. */
    id: string;
    /** Field label. */
    label: React.ReactNode;
    /** Optional hint rendered beneath the input. */
    description?: React.ReactNode;
    /** Single validation message; takes precedence over `errors`. */
    error?: React.ReactNode;
    /** List of validation errors (e.g. from a form library). */
    errors?: Array<{ message?: string } | undefined>;
    /**
     * Whether the field is invalid. When omitted, it is derived from the
     * presence of `error`/`errors`.
     */
    invalid?: boolean;
    /** Optional content on the label row (e.g. a "Forgot password?" link). */
    labelAction?: React.ReactNode;
    /** Classes for the field wrapper (the input keeps `className`). */
    fieldClassName?: string;
};

/**
 * Composite form field: label (with optional action), input, optional hint,
 * and validation error — assembled from the design-system `Field` primitives.
 * Presentation-only and form-library agnostic; native `<input>` props pass
 * straight through to the control, so any form library can bind it by wiring
 * `value`/`onChange`/`onBlur` and feeding `invalid`/`errors`.
 */
const InputField = React.forwardRef<HTMLInputElement, InputFieldProps>(
    (
        {
            id,
            label,
            description,
            error,
            errors,
            invalid,
            labelAction,
            fieldClassName,
            ...inputProps
        },
        ref
    ) => {
        const hasError = !!error || (errors?.some((e) => e?.message) ?? false);
        const isInvalid = invalid ?? hasError;
        const showError = isInvalid && (error || errors);
        const errorId = `${id}-error`;
        const descriptionId = `${id}-description`;
        // Associate the hint and/or error with the control so a screen reader
        // announces them on focus (not just when the error first appears).
        const describedBy =
            [
                description ? descriptionId : null,
                showError ? errorId : null,
                inputProps['aria-describedby']
            ]
                .filter(Boolean)
                .join(' ') || undefined;

        return (
            <Field data-invalid={isInvalid} className={fieldClassName}>
                {labelAction ? (
                    <div className="flex items-center">
                        <FieldLabel htmlFor={id}>{label}</FieldLabel>
                        {labelAction}
                    </div>
                ) : (
                    <FieldLabel htmlFor={id}>{label}</FieldLabel>
                )}
                <Input
                    id={id}
                    ref={ref}
                    aria-invalid={isInvalid}
                    {...inputProps}
                    aria-describedby={describedBy}
                />
                {description && (
                    <FieldDescription id={descriptionId}>
                        {description}
                    </FieldDescription>
                )}
                {showError && (
                    <FieldError id={errorId} errors={errors}>
                        {error}
                    </FieldError>
                )}
            </Field>
        );
    }
);
InputField.displayName = 'InputField';

export { InputField };
export type { InputFieldProps };
