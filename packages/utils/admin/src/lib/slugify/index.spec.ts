import { describe, expect, it } from 'vitest';
import { slugify } from '.';

describe('slugify', () => {
    it.each([
        ['Hello World', 'hello-world'],
        ['Café Münchén', 'cafe-munchen'],
        ['  --Trim__me--  ', 'trim-me'],
        ['a  b   c', 'a-b-c'],
        ['Already-a-slug', 'already-a-slug'],
        ['2024 Q1 Report', '2024-q1-report']
    ])('maps %j to %j', (input, expected) => {
        expect(slugify(input)).toBe(expected);
    });

    it.each(['日本語', '🎉', '', '   ', '---', '!!!'])(
        'returns an empty slug for %j, which has no usable characters',
        (input) => {
            expect(slugify(input)).toBe('');
        }
    );

    // Characters that do not decompose under NFKD each collapse to a hyphen.
    // Documented here so the behaviour is a decision rather than a surprise.
    it.each([
        ['Straße', 'stra-e'],
        ['Łódź', 'odz'],
        ['Đorđe', 'or-e'],
        ['Søren', 's-ren']
    ])(
        'collapses the non-decomposing characters in %j to %j',
        (input, expected) => {
            expect(slugify(input)).toBe(expected);
        }
    );

    it('always produces a value matching the documented shape', () => {
        for (const input of [
            'Hello World',
            'Café Münchén',
            '  --Trim__me--  ',
            'Straße'
        ]) {
            expect(slugify(input)).toMatch(/^[a-z0-9-]+$/);
        }
    });

    it('applies no length cap', () => {
        expect(slugify('a'.repeat(10_000))).toHaveLength(10_000);
    });
});
