import { describe, expect, it } from 'vitest';
import { PASSWORD_MAX_BYTES, PASSWORD_MIN_LENGTH, Password } from './index';

/**
 * The client-side length rule behind the accept-invite form, mirroring
 * identity-server's. Length only — composition rules push people toward
 * predictable substitutions — so the whole contract is the pair of boundaries,
 * which is exactly what this pins.
 *
 * The two bounds are measured in **different units on purpose**: the floor in
 * characters (what a person types), the ceiling in UTF-8 bytes (what bcrypt
 * truncates on).
 */
describe('Password', () => {
    it('mirrors the server rule: 12 characters to 72 bytes', () => {
        expect(PASSWORD_MIN_LENGTH).toBe(12);
        expect(PASSWORD_MAX_BYTES).toBe(72);
    });

    describe('isValid', () => {
        it.each([
            [11, false],
            [12, true],
            [13, true],
            [71, true],
            [72, true],
            [73, false]
        ])('a %i-character password is %s', (length, expected) => {
            expect(Password.isValid('a'.repeat(length))).toBe(expected);
        });

        it('rejects an empty password', () => {
            expect(Password.isValid('')).toBe(false);
        });

        it('accepts a passphrase with spaces — length is the only rule', () => {
            expect(Password.isValid('correct horse battery staple')).toBe(true);
        });

        it('does not require digits, symbols, or mixed case', () => {
            expect(Password.isValid('abcdefghijkl')).toBe(true);
        });

        // The ceiling is measured in UTF-8 bytes because that is the unit
        // bcrypt truncates on. Counting UTF-16 code units instead was
        // BUG-identity-server-03: `'é'.repeat(72)` passed both the client and
        // the server, then lost half its length in the hash, so the account was
        // protected by the first 36 characters only. These cases pin the fix —
        // a passphrase the hash cannot carry whole is rejected, not silently cut.
        it('measures the ceiling in bytes, not UTF-16 code units', () => {
            const passphrase = 'é'.repeat(72);

            expect(passphrase).toHaveLength(72);
            expect(new TextEncoder().encode(passphrase)).toHaveLength(144);
            expect(Password.isValid(passphrase)).toBe(false);
        });

        it('accepts accented text right up to the byte ceiling', () => {
            // 'é' is two bytes: 36 of them are 72 bytes exactly, and 37 are over.
            expect(new TextEncoder().encode('é'.repeat(36))).toHaveLength(72);
            expect(Password.isValid('é'.repeat(36))).toBe(true);
            expect(Password.isValid('é'.repeat(37))).toBe(false);
        });

        it('counts an astral emoji as four bytes', () => {
            // 18 keys = 72 bytes exactly; 19 is over the ceiling.
            expect(new TextEncoder().encode('🔑'.repeat(18))).toHaveLength(72);
            expect(Password.isValid('🔑'.repeat(18))).toBe(true);
            expect(Password.isValid('🔑'.repeat(19))).toBe(false);
            // The floor is still counted in code units, so six emoji (12 units,
            // 24 bytes) clear it even though a person would count six characters.
            expect(Password.isValid('🔑'.repeat(6))).toBe(true);
            expect(Password.isValid('🔑'.repeat(5))).toBe(false);
        });
    });

    describe('create', () => {
        it('wraps a valid password and exposes it unchanged', () => {
            const value = 'correct horse battery staple';

            expect(Password.create(value).value).toBe(value);
        });

        it('throws on one that is too short', () => {
            expect(() => Password.create('a'.repeat(11))).toThrow(
                'Password does not meet the length requirement'
            );
        });

        it('throws on one that is too long', () => {
            expect(() => Password.create('a'.repeat(73))).toThrow(
                'Password does not meet the length requirement'
            );
        });
    });
});
