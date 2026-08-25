import {
    FINDING_STATE,
    FINDING_STATES,
    nextFindingState
} from './finding-state';

describe('nextFindingState', () => {
    it('opens a finding for an entry that matches', () => {
        expect(nextFindingState(true)).toBe(FINDING_STATE.Open);
    });

    it('resolves a finding for an entry that no longer matches', () => {
        expect(nextFindingState(false)).toBe(FINDING_STATE.Resolved);
    });
});

describe('FINDING_STATES', () => {
    it('has no muted state', () => {
        // Muting is gone, and this is the assertion that keeps it gone: the
        // list DTO's enum and the query whitelist are both built from this
        // array, so a `muted` sneaking back in would quietly re-open a filter
        // value nothing can produce.
        expect(FINDING_STATES).toEqual(['open', 'resolved']);
    });
});
