import { clampInt } from '../clamp-int';

describe('clampInt', () => {
    it('falls back when the raw value is missing or non-numeric', () => {
        expect(clampInt(undefined, 20, 1, 100)).toBe(20);
        expect(clampInt('abc', 20, 1, 100)).toBe(20);
    });

    it('parses and truncates a numeric value', () => {
        expect(clampInt('3', 20, 1, 100)).toBe(3);
        expect(clampInt('3.9', 20, 1, 100)).toBe(3);
    });

    it('clamps into the inclusive bounds', () => {
        expect(clampInt('0', 20, 1, 100)).toBe(1);
        expect(clampInt('-5', 20, 1, 100)).toBe(1);
        expect(clampInt('500', 20, 1, 100)).toBe(100);
        expect(clampInt('100', 20, 1, 100)).toBe(100);
    });

    it('treats an empty string as 0 (Number("") === 0), so it clamps to min', () => {
        expect(clampInt('', 20, 1, 100)).toBe(1);
    });
});
