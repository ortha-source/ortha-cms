import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { IntlProvider } from 'react-intl';
import { describe, expect, it } from 'vitest';
import { useAcceptInviteSchema } from './useAcceptInviteSchema';

/** The schema as the form gets it, with the English default copy resolved. */
function acceptInviteSchema() {
    const { result } = renderHook(() => useAcceptInviteSchema(), {
        wrapper: ({ children }: { children: ReactNode }) => (
            <IntlProvider locale="en" onError={() => undefined}>
                {children}
            </IntlProvider>
        )
    });

    return result.current;
}

/** Every message the schema reports for `field`, in order. */
function messagesFor(
    field: 'password' | 'confirmPassword',
    values: { password: string; confirmPassword: string }
): string[] {
    const result = acceptInviteSchema().safeParse(values);
    if (result.success) {
        return [];
    }

    return result.error.issues
        .filter((issue) => issue.path[0] === field)
        .map((issue) => issue.message);
}

/** A confirm field that always agrees, so only the password rule is in play. */
function bothFields(password: string) {
    return { password, confirmPassword: password };
}

/**
 * The accept-invite form's validation, which is the only place an invitee's
 * first password is judged before it reaches the server.
 *
 * Two things are worth a test here. The first is that each field answers with
 * **one** message: zod v4 runs every check on a field, so a naive
 * `.min(1).min(12)` would stack "Choose a password…" and "Use at least 12
 * characters…" into a single `role="alert"` and read as two complaints about an
 * empty box. The second is the *unit* of the ceiling — bcrypt truncates at 72
 * bytes, not 72 characters, so a form measuring `.length` would green-light a
 * passphrase of accented letters that the server then rejects, with the invitee
 * left staring at a field the browser said was fine.
 */
describe('useAcceptInviteSchema', () => {
    describe('password', () => {
        it('asks for a password once, not once per length rule', () => {
            expect(messagesFor('password', bothFields(''))).toEqual([
                expect.stringContaining('Choose a password')
            ]);
        });

        it('rejects 11 characters as too short', () => {
            expect(messagesFor('password', bothFields('a'.repeat(11)))).toEqual(
                [expect.stringContaining('Use at least 12 characters')]
            );
        });

        it('accepts 12 characters — the floor is inclusive', () => {
            expect(
                acceptInviteSchema().safeParse(bothFields('a'.repeat(12)))
                    .success
            ).toBe(true);
        });

        it('accepts 72 ASCII characters, which is exactly 72 bytes', () => {
            expect(
                acceptInviteSchema().safeParse(bothFields('a'.repeat(72)))
                    .success
            ).toBe(true);
        });

        // 72 characters, 144 bytes. Measured with `.length` this passes; the
        // rule is byte-counted precisely so it does not.
        it('rejects 72 accented characters, because the ceiling counts bytes', () => {
            expect(messagesFor('password', bothFields('é'.repeat(72)))).toEqual(
                [expect.stringContaining('Keep it under 72 bytes')]
            );
        });

        it('rejects 73 ASCII characters', () => {
            expect(messagesFor('password', bothFields('a'.repeat(73)))).toEqual(
                [expect.stringContaining('Keep it under 72 bytes')]
            );
        });

        it('accepts a passphrase whose bytes fit even though it is not ASCII', () => {
            // 36 characters, 72 bytes — long enough, and inside the ceiling.
            const password = 'é'.repeat(36);

            expect(password).toHaveLength(36);
            expect(
                acceptInviteSchema().safeParse(bothFields(password)).success
            ).toBe(true);
        });
    });

    describe('confirmPassword', () => {
        // Only the presence of the ask is asserted. The object-level mismatch
        // check is not skipped for an empty box the way the password field's
        // length checks are, so today this field answers with the ask *and*
        // "these two passwords don't match" — two messages in one alert about a
        // box that has not been typed in yet. Asserting the exact list here
        // would cement that; the test states what the field must say.
        it('asks for the confirmation when it is empty', () => {
            expect(
                messagesFor('confirmPassword', {
                    password: 'a'.repeat(12),
                    confirmPassword: ''
                })
            ).toContain('Type your password once more to confirm it');
        });

        // The mismatch is reported on the confirm field, not the password one:
        // that is the box the invitee should go back and retype, and it is
        // where the form renders the error.
        it('reports a mismatch against the confirm field', () => {
            const result = acceptInviteSchema().safeParse({
                password: 'correct horse battery',
                confirmPassword: 'correct horse batttery'
            });

            expect(result.success).toBe(false);
            expect(result.error?.issues).toEqual([
                expect.objectContaining({
                    path: ['confirmPassword'],
                    message: expect.stringContaining('don’t match')
                })
            ]);
        });

        it('accepts two identical passwords', () => {
            expect(
                acceptInviteSchema().safeParse({
                    password: 'correct horse battery',
                    confirmPassword: 'correct horse battery'
                }).success
            ).toBe(true);
        });
    });
});
