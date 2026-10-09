import { describe, expect, it } from 'vitest';
import { createSlot, wireSlotContributions } from '.';
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
    it('does not let a consumer mutate the slot through the returned array [bootstrap:I-23] [shell:I-06] [utils:I-11]', () => {
        const slot = createSlot<Item>('t');
        slot._register([
            { order: 1, id: 'a' },
            { order: 2, id: 'b' }
        ]);

        // Typed `readonly`, and frozen at runtime too: a consumer that casts
        // the type away still cannot write through it.
        const items = slot.getItems() as Item[];
        expect(Object.isFrozen(items)).toBe(true);
        expect(() => items.push({ order: 3, id: 'c' })).toThrow(TypeError);
        expect(() =>
            items.sort((left, right) => right.order - left.order)
        ).toThrow(TypeError);

        expect(slot.getItems().map((item) => item.id)).toEqual(['a', 'b']);
    });

    // A fresh copy per call was a new identity per render, so every
    // `useMemo(…, [SLOT.getItems()])` recomputed and every effect keyed on one
    // re-ran on each render — the records view's toolbar and column memos, and
    // through them its saved-view hydration effect.
    it('hands back the same array until its contents change [utils:I-11]', () => {
        const slot = createSlot<Item>('t');
        const empty = slot.getItems();
        expect(slot.getItems()).toBe(empty);

        slot._register([{ order: 1, id: 'a' }]);
        const one = slot.getItems();
        expect(one).not.toBe(empty);
        expect(slot.getItems()).toBe(one);
        expect(slot.getItems()).toBe(one);

        slot._register([{ order: 2, id: 'b' }]);
        expect(slot.getItems()).not.toBe(one);
        // The snapshot already handed out is not rewritten under its holder.
        expect(one.map((item) => item.id)).toEqual(['a']);

        slot._reset();
        expect(slot.getItems()).toEqual([]);
        expect(slot.getItems()).toBe(slot.getItems());
    });

    it('empties the slot on reset', () => {
        const slot = createSlot<Item>('t');
        slot._register([{ order: 1, id: 'a' }]);

        slot._reset();

        expect(slot.getItems()).toEqual([]);
    });

    it('keeps reading and writing the same slot after a reset', () => {
        // `getItems` and `_register` must both see what `_reset` did — the
        // regression was a reset that left them on an array nobody else saw.
        const slot = createSlot<Item>('t');
        slot._register([{ order: 1, id: 'a' }]);
        slot._reset();
        slot._register([{ order: 2, id: 'b' }]);

        expect(slot.getItems().map((item) => item.id)).toEqual(['b']);
    });

    it('still reflects later registrations through a fresh read', () => {
        const slot = createSlot<Item>('t');
        const before = slot.getItems();
        slot._register([{ order: 1, id: 'a' }]);
        expect(before).toEqual([]);
        expect(slot.getItems()).toHaveLength(1);
    });
});

// BUG-bootstrap-admin `EC-09` — a Vite hot update re-executes the host's entry
// module against the same module-level slot closures instead of reloading the
// page, so the boot wiring ran a second time and `_register`'s bare `push`
// doubled every contribution. Observed in dev: every nav entry and every
// workspace listed twice, compounding with each save until a hard reload.
describe('wireSlotContributions', () => {
    const nav = () => createSlot<Item>('shell.sidebar.nav');

    it('registers every contribution', () => {
        const slot = nav();

        wireSlotContributions([
            { slot, items: [{ order: 1, id: 'home' }] },
            { slot, items: [{ order: 2, id: 'activity' }] }
        ]);

        expect(slot.getItems().map((item) => item.id)).toEqual([
            'home',
            'activity'
        ]);
    });

    it('is idempotent — running it again does not double anything [bootstrap:I-22] [shell:I-05] [utils:I-13]', () => {
        const slot = nav();
        const contributions = [{ slot, items: [{ order: 1, id: 'home' }] }];

        wireSlotContributions(contributions);
        wireSlotContributions(contributions);
        wireSlotContributions(contributions);

        expect(slot.getItems().map((item) => item.id)).toEqual(['home']);
    });

    it('does not drop an earlier contribution to the same slot [shell:I-05] [utils:I-14]', () => {
        // The reset is a separate pass for this reason: several plugins
        // contribute to one slot, so clearing per contribution would wipe what
        // the previous one in the same run had just registered.
        const slot = nav();

        wireSlotContributions([
            { slot, items: [{ order: 1, id: 'home' }] },
            { slot, items: [{ order: 2, id: 'activity' }] },
            { slot, items: [{ order: 3, id: 'workspaces' }] }
        ]);

        expect(slot.getItems()).toHaveLength(3);
    });

    it('leaves a slot nobody contributes to alone', () => {
        // Only the targets named in this run are reset. A slot filled by
        // something other than the boot wiring is not the host's to empty.
        const untouched = createSlot<Item>('other');
        untouched._register([{ order: 1, id: 'kept' }]);

        wireSlotContributions([{ slot: nav(), items: [] }]);

        expect(untouched.getItems().map((item) => item.id)).toEqual(['kept']);
    });

    it('accepts no contributions at all', () => {
        expect(() => wireSlotContributions([])).not.toThrow();
    });
});
