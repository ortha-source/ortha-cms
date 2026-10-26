import { useState, type ReactNode, type Ref } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import {
    Field,
    FieldDescription,
    FieldError,
    FieldLabel,
    InputGroup,
    InputGroupAddon,
    InputGroupButton,
    InputGroupInput,
    cn
} from '@orthacms/design-system';
import {
    PASSWORD_STRENGTH_STEPS,
    passwordStrength,
    type PasswordStrength
} from '../../../domain/value-objects/passwordStrength';
import { PASSWORD_MIN_LENGTH } from '../../../domain/value-objects/password';
import { EyeIcon, EyeOffIcon } from '../AuthIcons';

/** Intl descriptors for {@link PasswordField}, co-located with the component. */
const messages = defineMessages({
    show: {
        id: 'identity.passwordField.show',
        defaultMessage: 'Show password'
    },
    rule: {
        id: 'identity.passwordField.rule',
        defaultMessage: 'At least {min} characters'
    },
    strengthHint: {
        id: 'identity.passwordField.strengthHint',
        defaultMessage: '{strength} · at least {min} characters'
    },
    tooShort: {
        id: 'identity.passwordField.strength.tooShort',
        defaultMessage: 'Too short'
    },
    fair: {
        id: 'identity.passwordField.strength.fair',
        defaultMessage: 'Fair'
    },
    good: {
        id: 'identity.passwordField.strength.good',
        defaultMessage: 'Good'
    },
    strong: {
        id: 'identity.passwordField.strength.strong',
        defaultMessage: 'Strong'
    }
});

/** The word for each non-empty step of the meter. */
const STRENGTH_LABEL = {
    1: messages.tooShort,
    2: messages.fair,
    3: messages.good,
    4: messages.strong
} as const;

/** The filled bars' colour for each step. */
const STRENGTH_BAR = {
    1: 'bg-destructive',
    2: 'bg-warning',
    3: 'bg-success',
    4: 'bg-success'
} as const;

/** Props for {@link PasswordField}. */
type PasswordFieldProps = {
    /** Input id; also wires the label and the description/error ids. */
    id: string;
    /** The form field's name. */
    name?: string;
    /** Localized label. */
    label: string;
    /** The current value. */
    value: string;
    /** Called with the new value on every edit. */
    onChange: (value: string) => void;
    /** Called when the input loses focus. */
    onBlur?: () => void;
    /** `current-password` on sign-in, `new-password` wherever one is chosen. */
    autoComplete: 'current-password' | 'new-password';
    /** Localized placeholder. */
    placeholder?: string;
    /** Content on the label row — the sign-in screen's "Forgot it?" link. */
    labelAction?: ReactNode;
    /**
     * Draw the strength meter and let it own the hint ("Strong · at least 12
     * characters"). For a field where a password is being *chosen*.
     */
    meter?: boolean;
    /** A static hint, for a field without a meter. */
    description?: ReactNode;
    /** Validation errors from the form library. */
    errors?: Array<{ message?: string } | undefined>;
    /** A single error message (the server's answer); wins over `errors`. */
    error?: ReactNode;
    /** Whether to mark the input invalid. Derived from the errors when omitted. */
    invalid?: boolean;
    /** A ref to the input, so a page can move focus to it. */
    inputRef?: Ref<HTMLInputElement>;
};

/**
 * A password input with a **show/hide toggle** and, where a password is being
 * chosen, a **strength meter** — the one field the redesigned auth screens use
 * for every password, replacing the old "type it twice" pair.
 *
 * The toggle is what makes one field enough: being able to read back what you
 * typed is a better check than typing it again blind, and it is the check that
 * still works for someone pasting from a password manager. It is a real
 * `<button>` with a constant name ("Show password") and `aria-pressed`, so a
 * screen reader hears its state rather than a label that changes under it, and
 * it is `type="button"` so Enter in the field still submits the form.
 *
 * The meter is **advice, never a rule** ({@link passwordStrength}): the bars
 * are decorative and the words under them are the field's description, so the
 * same information reaches everyone. Once there is an error the hint moves
 * off-screen (still described, like `InputField`) and the error takes its line.
 */
export function PasswordField({
    id,
    name,
    label,
    value,
    onChange,
    onBlur,
    autoComplete,
    placeholder,
    labelAction,
    meter = false,
    description,
    errors,
    error,
    invalid,
    inputRef
}: PasswordFieldProps) {
    const intl = useIntl();
    const [visible, setVisible] = useState(false);

    const hasError = !!error || (errors?.some((e) => e?.message) ?? false);
    const isInvalid = invalid ?? hasError;
    const strength: PasswordStrength = meter ? passwordStrength(value) : 0;

    const hint = meter
        ? strength === 0
            ? intl.formatMessage(messages.rule, { min: PASSWORD_MIN_LENGTH })
            : intl.formatMessage(messages.strengthHint, {
                  strength: intl.formatMessage(STRENGTH_LABEL[strength]),
                  min: PASSWORD_MIN_LENGTH
              })
        : description;

    const descriptionId = `${id}-description`;
    const errorId = `${id}-error`;
    const describedBy =
        [hint ? descriptionId : null, hasError ? errorId : null]
            .filter(Boolean)
            .join(' ') || undefined;

    return (
        <Field data-invalid={isInvalid}>
            {labelAction ? (
                <div className="flex items-center">
                    <FieldLabel htmlFor={id}>{label}</FieldLabel>
                    {labelAction}
                </div>
            ) : (
                <FieldLabel htmlFor={id}>{label}</FieldLabel>
            )}
            <InputGroup>
                <InputGroupInput
                    id={id}
                    name={name}
                    ref={inputRef}
                    type={visible ? 'text' : 'password'}
                    autoComplete={autoComplete}
                    placeholder={placeholder}
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    onBlur={onBlur}
                    aria-invalid={isInvalid}
                    aria-describedby={describedBy}
                    // A revealed password is still a password: keep it out of
                    // spellcheck dictionaries and autocorrect.
                    spellCheck={false}
                    autoCapitalize="none"
                    autoCorrect="off"
                />
                <InputGroupAddon align="inline-end">
                    <InputGroupButton
                        size="icon-xs"
                        aria-label={intl.formatMessage(messages.show)}
                        aria-pressed={visible}
                        aria-controls={id}
                        onClick={() => setVisible((current) => !current)}
                    >
                        {visible ? <EyeOffIcon /> : <EyeIcon />}
                    </InputGroupButton>
                </InputGroupAddon>
            </InputGroup>
            {meter && (
                <div
                    aria-hidden="true"
                    data-slot="password-strength"
                    data-strength={strength}
                    className="flex gap-1"
                >
                    {Array.from({ length: PASSWORD_STRENGTH_STEPS }, (_, i) => (
                        <i
                            key={i}
                            className={cn(
                                'h-1 flex-1 rounded-full',
                                strength > i
                                    ? STRENGTH_BAR[
                                          strength as Exclude<
                                              PasswordStrength,
                                              0
                                          >
                                      ]
                                    : 'bg-muted'
                            )}
                        />
                    ))}
                </div>
            )}
            {hint && (
                <FieldDescription
                    id={descriptionId}
                    className={hasError ? 'sr-only' : undefined}
                >
                    {hint}
                </FieldDescription>
            )}
            {hasError && (
                <FieldError id={errorId} errors={errors}>
                    {error}
                </FieldError>
            )}
        </Field>
    );
}
