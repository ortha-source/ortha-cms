import { type AnyFieldApi } from '@tanstack/react-form';
import { Input, Field, FieldError, FieldLabel } from '@ortha-cms/design-system';

/**
 * Props for {@link LoginField}. The field is presentation-only and domain
 * agnostic — the parent supplies already-localized `label`/`placeholder` and
 * wires the TanStack `field` via its `form.Field` render prop.
 */
type LoginFieldProps = {
    /** The TanStack field API from the parent's `form.Field` render prop. */
    field: AnyFieldApi;
    /** Input element id, also used for the label's `htmlFor`. */
    id: string;
    /** Localized field label. */
    label: string;
    /** Localized input placeholder. */
    placeholder: string;
    /** Input type; defaults to `text`. */
    type?: React.HTMLInputTypeAttribute;
    /** HTML `autocomplete` token (e.g. `email`, `current-password`). */
    autoComplete?: React.HTMLInputAutoCompleteAttribute;
    /** Optional label-row content rendered after the label (e.g. a link). */
    labelAction?: React.ReactNode;
};

/**
 * Form-bound text field: label, input, and validation error wired to a
 * TanStack field. Owns no copy of its own so it can back any login input.
 */
export function LoginField({
    field,
    id,
    label,
    placeholder,
    type = 'text',
    autoComplete,
    labelAction
}: LoginFieldProps) {
    const invalid =
        field.state.meta.isTouched && field.state.meta.errors.length > 0;

    return (
        <Field data-invalid={invalid}>
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
                name={field.name}
                type={type}
                autoComplete={autoComplete}
                placeholder={placeholder}
                value={field.state.value}
                aria-invalid={invalid}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
            />
            {invalid && <FieldError errors={field.state.meta.errors} />}
        </Field>
    );
}
