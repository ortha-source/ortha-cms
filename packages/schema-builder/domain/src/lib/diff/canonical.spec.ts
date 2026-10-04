import { canonical, canonicalJson } from './canonical';
import { same } from './same';
import { changedKeys } from './changed-keys';

describe('canonical JSON', () => {
    it('sorts keys deeply and drops undefined', () => {
        expect(
            canonicalJson({ b: 1, a: { d: undefined, c: [{ z: 1, y: 2 }] } })
        ).toBe('{"a":{"c":[{"y":2,"z":1}]},"b":1}');
    });

    it('keeps array order — order is meaning', () => {
        expect(canonical([2, 1])).toEqual([2, 1]);
    });

    it('treats key order and undefined keys as the same value', () => {
        expect(same({ a: 1, b: undefined }, { a: 1 })).toBe(true);
        expect(same({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
        expect(same([1, 2], [2, 1])).toBe(false);
    });

    it('lists the keys that differ, sorted', () => {
        expect(
            changedKeys(
                { type: 'text', maxLength: 80, required: true },
                { type: 'text', maxLength: 40, admin: {} }
            )
        ).toEqual(['admin', 'maxLength', 'required']);
    });
});
