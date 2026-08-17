import { describe, expect, it } from 'vitest';
import { createSlot } from '.';
import { byOrder } from '../byOrder';

type Item = { order: number; id: string };

describe('createSlot', () => {
    it('keeps its name and starts empty', () => {
        const slot = createSlot<Item>('shell.navbar.start');
        expect(slot.name).toBe('shell.navbar.start');
        expect(slot.getItems()).toEqual([]);
    });

    it('reads back contributions in registration order, unsorted', () => {
        const slot = createSlot<Item>('t');
        slot._register([{ order: 2, id: 'b' }]);
        slot._register([{ order: 1, id: 'a' }]);
        expect(slot.getItems().map((item) => item.id)).toEqual(['b', 'a']);
    });

    it('leaves ordering to byOrder, which sorts a copy', () => {
        const slot = createSlot<Item>('t');
        slot._register([
            { order: 2, id: 'b' },
            { order: 1, id: 'a' }
        ]);
        expect(byOrder(slot.getItems()).map((item) => item.id)).toEqual([
            'a',
            'b'
        ]);
        expect(slot.getItems().map((item) => item.id)).toEqual(['b', 'a']);
    });

    // BUG-utils-admin-05 — `getItems()` handed back the live internal array, so
    // any consumer (or a stray `.sort()`/`.push()` in a render) could rewrite
    // shared plugin state for every other consumer of the same slot.
    it('does not let a consumer mutate the slot through the returned array', () => {
        const slot = createSlot<Item>('t');
        slot._register([{ order: 1, id: 'a' }]);

        const items = slot.getItems();
        items.push({ order: 3, id: 'c' });
        items.sort((left, right) => right.order - left.order);
        items.length = 0;

        expect(slot.getItems().map((item) => item.id)).toEqual(['a']);
    });

    it('still reflects later registrations through a fresh read', () => {
        const slot = createSlot<Item>('t');
        const before = slot.getItems();
        slot._register([{ order: 1, id: 'a' }]);
        expect(before).toEqual([]);
        expect(slot.getItems()).toHaveLength(1);
    });
});
