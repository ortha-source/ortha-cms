import { passwordStrength } from './index';

describe('passwordStrength', () => {
    it('is 0 for an empty field — nothing to judge yet', () => {
        expect(passwordStrength('')).toBe(0);
    });

    it('is 1 below the 12-character floor, however varied', () => {
        expect(passwordStrength('aB3$aB3$aB3')).toBe(1);
    });

    it('is 1 over the 72-byte ceiling — the server refuses both ends', () => {
        expect(passwordStrength('é'.repeat(37))).toBe(1);
    });

    it('is fair for a plain 12-character word', () => {
        expect(passwordStrength('lighthousesx')).toBe(2);
    });

    it('never rates a repeated character or a counting run above fair', () => {
        expect(passwordStrength('a'.repeat(30))).toBe(2);
        expect(passwordStrength('123456789012')).toBe(2);
        expect(passwordStrength('abcdefghijklmnopqrst')).toBe(2);
    });

    it('rewards length over scrambling', () => {
        expect(passwordStrength('correct horse battery')).toBe(4);
        expect(passwordStrength('lighthousesxyz12')).toBe(3);
    });

    it('nudges a varied password up a step', () => {
        expect(passwordStrength('Lighthouse-12')).toBe(3);
        expect(passwordStrength('Lighthouse-1234')).toBe(3);
        expect(passwordStrength('Lighthouse-12345')).toBe(4);
    });
});
