import { useMemo } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { z } from 'zod';

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
                    .pipe(
                        z.email({
                            message: intl.formatMessage(messages.emailInvalid)
                        })
                    ),
                password: z.string().min(1, {
                    message: intl.formatMessage(messages.passwordRequired)
                })
            }),
        [intl]
    );
}
