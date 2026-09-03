import { describe, expect, it } from 'vitest';
import { byOrder } from '.';

describe('byOrder', () => {
    it('sorts ascending into a new array, leaving the source untouched [utils:I-15]', () => {
        const source = [
            { order: 3, id: 'c' },
            { order: 1, id: 'a' },
            { order: 2, id: 'b' }
        ];
        const sorted = byOrder(source);

        expect(sorted.map((item) => item.id)).toEqual(['a', 'b', 'c']);
        expect(source.map((item) => item.id)).toEqual(['c', 'a', 'b']);
        expect(sorted).not.toBe(source);
    });

    it('keeps registration order for ties, so slot order is stable [shell:I-07]', () => {
        const sorted = byOrder([
            { order: 1, id: 'first' },
            { order: 1, id: 'second' },
            { order: 0, id: 'zero' },
            { order: 1, id: 'third' }
        ]);
        expect(sorted.map((item) => item.id)).toEqual([
            'zero',
            'first',
            'second',
            'third'
        ]);
    });

    it('handles the empty and single-item cases', () => {
        expect(byOrder([])).toEqual([]);
        expect(byOrder([{ order: 9, id: 'only' }])).toEqual([
            { order: 9, id: 'only' }
        ]);
    });

    it('accepts negative orders', () => {
        expect(
            byOrder([
                { order: 1, id: 'a' },
                { order: -5, id: 'b' }
            ]).map((item) => item.id)
        ).toEqual(['b', 'a']);
    });
});
