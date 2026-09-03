import {
    isOpen,
    sameAccess,
    stateOf,
    withState,
    withStates,
    OPEN_ACCESS,
    SEGMENT_STATE
} from './types';

describe('stateOf', () => {
    it('reads an unmentioned segment as unset, not as denied', () => {
        expect(stateOf(OPEN_ACCESS, 's1')).toBe(SEGMENT_STATE.Unset);
    });

    it('reads each list', () => {
        const access = { allow: ['s1'], deny: ['s2'] };
        expect(stateOf(access, 's1')).toBe(SEGMENT_STATE.Allow);
        expect(stateOf(access, 's2')).toBe(SEGMENT_STATE.Deny);
    });
});

describe('withState', () => {
    it('moves a segment between the lists rather than adding to both', () => {
        let access = withState(OPEN_ACCESS, 's1', SEGMENT_STATE.Allow);
        expect(access).toEqual({ allow: ['s1'], deny: [] });

        access = withState(access, 's1', SEGMENT_STATE.Deny);
        expect(access).toEqual({ allow: [], deny: ['s1'] });
    });

    /**
     * A segment in both lists is a state the server accepts and the reader
     * resolves as denied — while the editor's screen says allowed. Removing
     * before adding is what makes it unreachable.
     */
    it('never leaves a segment in both lists [segments:I-24]', () => {
        const messy = { allow: ['s1'], deny: ['s1'] };
        const fixed = withState(messy, 's1', SEGMENT_STATE.Allow);
        expect(fixed.allow).toEqual(['s1']);
        expect(fixed.deny).toEqual([]);
    });

    it('clears a segment back to unset', () => {
        const access = withState(
            { allow: ['s1', 's2'], deny: [] },
            's1',
            SEGMENT_STATE.Unset
        );
        expect(access).toEqual({ allow: ['s2'], deny: [] });
    });

    it('leaves the other segments alone', () => {
        const access = withState(
            { allow: ['s1'], deny: ['s2'] },
            's3',
            SEGMENT_STATE.Allow
        );
        expect(access.allow.sort()).toEqual(['s1', 's3']);
        expect(access.deny).toEqual(['s2']);
    });
});

describe('isOpen', () => {
    it('is true only when neither list holds anything', () => {
        expect(isOpen(OPEN_ACCESS)).toBe(true);
        expect(isOpen({ allow: [], deny: ['s1'] })).toBe(false);
    });
});

describe('sameAccess', () => {
    it('ignores order, so a reordered list is not a pending change [segments:I-25]', () => {
        expect(
            sameAccess(
                { allow: ['a', 'b'], deny: [] },
                { allow: ['b', 'a'], deny: [] }
            )
        ).toBe(true);
    });

    it('tells a real difference apart', () => {
        expect(
            sameAccess({ allow: ['a'], deny: [] }, { allow: [], deny: ['a'] })
        ).toBe(false);
    });
});

describe('withStates', () => {
    const base = { allow: ['a'], deny: ['b'] };

    it('moves every named segment to one state in one pass', () => {
        expect(withStates(base, ['a', 'b', 'c'], SEGMENT_STATE.Allow)).toEqual({
            allow: ['a', 'b', 'c'],
            deny: []
        });
    });

    it('leaves segments it was not given alone', () => {
        // What makes the control safe beside a search: setting everything
        // matching "acme" must not touch the rest of the entry's decisions.
        expect(withStates(base, ['c'], SEGMENT_STATE.Deny)).toEqual({
            allow: ['a'],
            deny: ['b', 'c']
        });
    });

    it('removes before it adds, so nothing lands in both lists', () => {
        // The same invariant `withState` carries, and the reason it has a test:
        // a segment in both lists resolves as denied while the screen says
        // allowed.
        const both = withStates(base, ['a'], SEGMENT_STATE.Deny);
        expect(both.allow).not.toContain('a');
        expect(both.deny).toEqual(['b', 'a']);
    });

    it('clears the named segments on Unset', () => {
        expect(withStates(base, ['a', 'b'], SEGMENT_STATE.Unset)).toEqual({
            allow: [],
            deny: []
        });
    });

    it('deduplicates the ids it is handed', () => {
        expect(
            withStates(OPEN_ACCESS, ['a', 'a'], SEGMENT_STATE.Allow).allow
        ).toEqual(['a']);
    });

    it('is a no-op for an empty list', () => {
        expect(withStates(base, [], SEGMENT_STATE.Allow)).toBe(base);
    });
});
