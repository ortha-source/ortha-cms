import { useMemo } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { z } from 'zod';
import {
    PASSWORD_MAX_BYTES,
    PASSWORD_MIN_LENGTH,
    passwordByteLength
} from '../../../domain/value-objects/password';

/**
 * Intl descriptors for the reset-password validation copy, co-located with the
 * schema. Each message says what to do, not just what is wrong.
 */
const messages = defineMessages({
    passwordRequired: {
        id: 'identity.resetPassword.passwordRequired',
        defaultMessage: 'Choose a new password to finish resetting your account'
    },
    passwordTooShort: {
        id: 'identity.resetPassword.passwordTooShort',
        defaultMessage:
            'Use at least {min} characters — length is what keeps a password hard to guess'
    },
    passwordTooLong: {
        id: 'identity.resetPassword.passwordTooLong',
        defaultMessage:
            'Keep it under {max} bytes — accented letters and emoji each count for more than one'
    }
});

/**
 * Builds the reset form's Zod schema with localized validation copy. Rebuilt
 * when the active locale changes so messages stay in sync with the UI.
 *
 * The rules mirror `useAcceptInviteSchema` exactly, because they mirror the
 * same server-side bounds: the two forms set the same column through two
 * different one-time tokens. One field: the show/hide toggle is how the person
 * checks what they typed.
 */
export function useResetPasswordSchema() {
    const intl = useIntl();

    return useMemo(
        () =>
            z.object({
                password: z
                    .string()
                    .min(1, {
                        message: intl.formatMessage(messages.passwordRequired)
                    })
                    // Length is judged only once something has been typed:
                    // zod reports every failing check on a field, so a
                    // plain `.min(PASSWORD_MIN_LENGTH)` would stack two
                    // messages in one `role="alert"` for an empty box.
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
                    // server will reject — and here that costs the user
                    // their single-use link.
                    .refine(
                        (value) =>
                            passwordByteLength(value) <= PASSWORD_MAX_BYTES,
                        {
                            message: intl.formatMessage(
                                messages.passwordTooLong,
                                { max: PASSWORD_MAX_BYTES }
                            )
                        }
                    )
            }),
        // One field since the redesign: the show/hide toggle is how the
        // person checks what they typed, so there is no confirmation
        // to compare it against.
        [intl]
    );
}
