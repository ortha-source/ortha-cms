import { describe, expect, it } from 'vitest';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, Password } from './index';

/**
 * The client-side length rule behind the accept-invite form, mirroring
 * identity-server's. Length only — composition rules push people toward
 * predictable substitutions — so the whole contract is the pair of boundaries,
 * which is exactly what this pins.
 */
describe('Password', () => {
    it('mirrors the server rule: 12 to 72', () => {
        expect(PASSWORD_MIN_LENGTH).toBe(12);
        expect(PASSWORD_MAX_LENGTH).toBe(72);
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

        // Length is counted in UTF-16 code units, which is what
        // `String.prototype.length` gives and what the server's character check
        // uses — so the two agree. bcrypt, however, truncates at 72 *bytes*, so
        // a multi-byte passphrase that passes both is still cut short when it is
        // hashed. That is BUG-identity-server-03 (a server-side fix); these
        // cases document the client's half of the boundary so a future change
        // to either rule has to face the mismatch deliberately.
        it('counts UTF-16 code units, not bytes, for accented text', () => {
            const passphrase = 'é'.repeat(72);

            expect(passphrase).toHaveLength(72);
            expect(new TextEncoder().encode(passphrase)).toHaveLength(144);
            expect(Password.isValid(passphrase)).toBe(true);
        });

        it('counts an astral emoji as two code units', () => {
            // 36 keys = 72 UTF-16 units = 144 bytes: accepted at exactly the
            // maximum, and one emoji more is over it.
            expect(Password.isValid('🔑'.repeat(36))).toBe(true);
            expect(Password.isValid('🔑'.repeat(37))).toBe(false);
            // Six emoji are 12 code units, so they clear the minimum even
            // though a person would count six characters.
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
