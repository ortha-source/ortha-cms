import { isCompleteLinkToken } from './index';

const TOKEN = 'a1'.repeat(32);

describe('isCompleteLinkToken', () => {
    it('accepts the 64-hex-character shape the server mints', () => {
        expect(isCompleteLinkToken(TOKEN)).toBe(true);
        expect(isCompleteLinkToken(TOKEN.toUpperCase())).toBe(true);
    });

    it('rejects a missing token', () => {
        expect(isCompleteLinkToken('')).toBe(false);
        expect(isCompleteLinkToken(null)).toBe(false);
        expect(isCompleteLinkToken(undefined)).toBe(false);
    });

    it('rejects a token cut short, as a chat app does to a long link', () => {
        expect(isCompleteLinkToken(TOKEN.slice(0, 40))).toBe(false);
    });

    it('rejects a token that picked up extra characters or non-hex ones', () => {
        expect(isCompleteLinkToken(`${TOKEN}.`)).toBe(false);
        expect(isCompleteLinkToken(`${TOKEN.slice(0, 63)}z`)).toBe(false);
    });
});
