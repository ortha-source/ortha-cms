import { useMemo } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { z } from 'zod';
import {
    PASSWORD_MAX_BYTES,
    PASSWORD_MIN_LENGTH,
    passwordByteLength
} from '../../../domain/value-objects/password';

/**
 * Intl descriptors for the accept-invite validation copy, co-located with the
 * schema. Each message says what to do, not just what is wrong.
 */
const messages = defineMessages({
    passwordRequired: {
        id: 'identity.acceptInvite.passwordRequired',
        defaultMessage: 'Choose a password to finish setting up your account'
    },
    passwordTooShort: {
        id: 'identity.acceptInvite.passwordTooShort',
        defaultMessage:
            'Use at least {min} characters — length is what keeps a password hard to guess'
    },
    passwordTooLong: {
        id: 'identity.acceptInvite.passwordTooLong',
        defaultMessage:
            'Keep it under {max} bytes — accented letters and emoji each count for more than one'
    },
    confirmRequired: {
        id: 'identity.acceptInvite.confirmRequired',
        defaultMessage: 'Type your password once more to confirm it'
    },
    confirmMismatch: {
        id: 'identity.acceptInvite.confirmMismatch',
        defaultMessage: 'These two passwords don’t match'
    }
});

/**
 * Builds the accept-invite form's Zod schema with localized validation copy.
 * Rebuilt when the active locale changes so messages stay in sync with the UI.
 *
 * Only the password is validated here — the email, name, and role came from the
 * invite and are not editable, so there is nothing else the invitee could get
 * wrong. The mismatch error is attached to the confirm field, which is the one
 * the user should go back and fix.
 */
export function useAcceptInviteSchema() {
    const intl = useIntl();

    return useMemo(
        () =>
            z
                .object({
                    password: z
                        .string()
                        .min(1, {
                            message: intl.formatMessage(
                                messages.passwordRequired
                            )
                        })
                        // Length is judged only once something has been typed:
                        // zod reports every failing check on a field, so a
                        // plain `.min(PASSWORD_MIN_LENGTH)` would stack "Choose
                        // a password…" and "Use at least 12 characters…" in one
                        // `role="alert"` for an empty box.
                        .refine(
                            (value) =>
                                value.length === 0 ||
                                value.length >= PASSWORD_MIN_LENGTH,
                            {
                                message: intl.formatMessage(
                                    messages.passwordTooShort,
                                    { min: PASSWORD_MIN_LENGTH }
                                )
                            }
                        )
                        // Zod's `.max` counts characters; the server's ceiling
                        // is bcrypt's 72-BYTE truncation point, so measure the
                        // way it does or the form green-lights a passphrase the
                        // server will reject. An empty box is already covered by
                        // the required rule above and 0 bytes clears this one,
                        // so the two never stack.
                        .refine(
                            (value) =>
                                passwordByteLength(value) <= PASSWORD_MAX_BYTES,
                            {
                                message: intl.formatMessage(
                                    messages.passwordTooLong,
                                    { max: PASSWORD_MAX_BYTES }
                                )
                            }
                        ),
                    confirmPassword: z.string().min(1, {
                        message: intl.formatMessage(messages.confirmRequired)
                    })
                })
                .refine(
                    (values) => values.password === values.confirmPassword,
                    {
                        message: intl.formatMessage(messages.confirmMismatch),
                        path: ['confirmPassword']
                    }
                ),
        [intl]
    );
}
