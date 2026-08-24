import { FINDING_STATE, nextFindingState } from './finding-state';

describe('nextFindingState', () => {
    it('opens a finding for an entry that matches', () => {
        expect(nextFindingState(true, false)).toBe(FINDING_STATE.Open);
    });

    it('resolves a finding for an entry that no longer matches', () => {
        expect(nextFindingState(false, false)).toBe(FINDING_STATE.Resolved);
    });

    it('keeps a muted finding muted while it still matches', () => {
        expect(nextFindingState(true, true)).toBe(FINDING_STATE.Muted);
    });

    it('resolves a muted finding whose entry stopped matching', () => {
        // Mute is a property of the pair, not of the occurrence — so a muted
        // finding resolves like any other rather than lingering as muted.
        expect(nextFindingState(false, true)).toBe(FINDING_STATE.Resolved);
    });

    it('brings a re-matching muted finding back muted, not open', () => {
        // The regression this whole three-state design exists to prevent: if a
        // resolution erased the mute, every deliberate exception would shout
        // again the next time its entry was touched, and the feature would be
        // switched off within a fortnight.
        const afterResolve = nextFindingState(false, true);
        expect(afterResolve).toBe(FINDING_STATE.Resolved);
        expect(nextFindingState(true, true)).toBe(FINDING_STATE.Muted);
    });
});
