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
        slot._register([{ order: 1, id: 'a' }]);

        const items = slot.getItems();
        items.push({ order: 3, id: 'c' });
        items.sort((left, right) => right.order - left.order);
        items.length = 0;

        expect(slot.getItems().map((item) => item.id)).toEqual(['a']);
    });

    it('empties the slot on reset', () => {
        const slot = createSlot<Item>('t');
        slot._register([{ order: 1, id: 'a' }]);

        slot._reset();

        expect(slot.getItems()).toEqual([]);
    });

    it('keeps reading and writing the same array after a reset', () => {
        // `length = 0`, not a fresh array: rebinding would leave `getItems` and
        // `_register` closed over an array nobody else can see.
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
