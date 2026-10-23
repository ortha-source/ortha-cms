import { describe, expect, it } from 'vitest';
import {
    COMBINATOR,
    OP,
    type Combinator,
    type FilterGroup
} from '@orthacms/query-builder-admin';
import { QUICK_STATUS, activeQuickStatus, withQuickStatus } from './index';

let n = 0;
const id = () => `n${++n}`;

const tree = (
    children: FilterGroup['children'],
    combinator: Combinator = COMBINATOR.And
) => ({ id: 'root', combinator, children }) as FilterGroup;

describe('status quick filters', () => {
    it('adds a chip beside the conditions already applied', () => {
        const before = tree([
            { id: 'r1', fieldId: 'category', op: OP.Equals, value: 'news' }
        ]);
        const after = withQuickStatus(before, QUICK_STATUS.Modified, id);

        expect(after?.children).toHaveLength(3);
        expect(after?.children[0]).toMatchObject({ fieldId: 'category' });
        expect(activeQuickStatus(after)).toBe(QUICK_STATUS.Modified);
    });

    it('swaps one chip for another instead of stacking them', () => {
        const draft = withQuickStatus(null, QUICK_STATUS.Draft, id);
        const published = withQuickStatus(draft, QUICK_STATUS.Published, id);

        expect(published?.children).toHaveLength(1);
        expect(activeQuickStatus(published)).toBe(QUICK_STATUS.Published);
    });

    it('clears back to no filter at all', () => {
        const draft = withQuickStatus(null, QUICK_STATUS.Draft, id);
        expect(withQuickStatus(draft, null, id)).toBeNull();
    });

    it('reads no chip from a status condition it did not write', () => {
        const hand = tree([
            { id: 'r1', fieldId: 'status', op: OP.Equals, value: 'draft' }
        ]);
        // Draft *and* Modified both start with `status = draft`; a bare one
        // is neither chip.
        expect(activeQuickStatus(hand)).toBeNull();
    });

    it('keeps an OR tree whole, under a new AND', () => {
        const or = tree(
            [
                { id: 'a', fieldId: 'status', op: OP.Equals, value: 'draft' },
                { id: 'b', fieldId: 'category', op: OP.Equals, value: 'x' }
            ],
            COMBINATOR.Or
        );
        const after = withQuickStatus(or, QUICK_STATUS.Published, id);

        expect(after?.combinator).toBe(COMBINATOR.And);
        expect(after?.children[0]).toBe(or);
        expect(activeQuickStatus(after)).toBe(QUICK_STATUS.Published);
    });
});
