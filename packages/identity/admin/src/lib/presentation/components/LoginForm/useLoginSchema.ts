import { useMemo } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { z } from 'zod';
import { Email } from '../../../domain/value-objects/email';

/** Intl descriptors for the login validation messages, co-located with the schema. */
const messages = defineMessages({
    emailRequired: {
        id: 'identity.login.emailRequired',
        defaultMessage: 'Email is required'
    },
    emailInvalid: {
        id: 'identity.login.emailInvalid',
        defaultMessage: 'Enter a valid email address'
    },
    passwordRequired: {
        id: 'identity.login.passwordRequired',
        defaultMessage: 'Password is required'
    }
});

/**
 * Builds the login form's Zod schema with localized validation copy. Rebuilt
 * when the active locale changes so messages stay in sync with the UI.
 */
export function useLoginSchema() {
    const intl = useIntl();

    return useMemo(
        () =>
            z.object({
                email: z
                    .string()
                    .min(1, {
                        message: intl.formatMessage(messages.emailRequired)
                    })
                    // Delegate the format rule to the `Email` value object, the
                    // single client-side email rule, rather than an inline
                    // `z.email()` — the server stays the authority.
                    //
                    // Skipped for an empty value: zod reports every failing
                    // check on a field, so an empty box would answer "Email is
                    // required" *and* "Enter a valid email address" — two
                    // messages stacked in one `role="alert"`, telling the user
                    // to fix a format they haven't typed yet.
                    .refine(
                        (value) => value.length === 0 || Email.isValid(value),
                        {
                            message: intl.formatMessage(messages.emailInvalid)
                        }
                    ),
                password: z.string().min(1, {
                    message: intl.formatMessage(messages.passwordRequired)
                })
            }),
        [intl]
    );
}
