import { countCharacters, isEmptyFieldValue } from './field-type';

describe('isEmptyFieldValue', () => {
    it.each([undefined, null, '', '   ', '\t\n', []])(
        'treats %p as empty',
        (value) => {
            expect(isEmptyFieldValue(value)).toBe(true);
        }
    );

    it.each([0, false, NaN, {}, [0], 'x'])('treats %p as present', (value) => {
        expect(isEmptyFieldValue(value)).toBe(false);
    });
});

describe('countCharacters', () => {
    it('counts plain ASCII one per character', () => {
        expect(countCharacters('')).toBe(0);
        expect(countCharacters('hello')).toBe(5);
    });

    it('counts an astral emoji as one character, not two code units', () => {
        expect('👍'.length).toBe(2);
        expect(countCharacters('👍')).toBe(1);
        expect(countCharacters('👍👍')).toBe(2);
    });

    it('counts a combining sequence as one character', () => {
        const decomposed = 'é'; // "é" as e + U+0301
        expect(decomposed.length).toBe(2);
        expect(countCharacters(decomposed)).toBe(1);
    });

    it('counts a ZWJ emoji sequence as one character', () => {
        const family = '👨‍👩‍👧‍👦';
        expect(family.length).toBe(11);
        expect(countCharacters(family)).toBe(1);
    });
});
