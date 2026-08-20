import {
    ENTRY_STATUS,
    assertTransition,
    canTransition,
    EntryStatusTransitionError
} from './entry-status';

describe('entry-status state machine', () => {
    it('allows draft → published (publish)', () => {
        expect(canTransition(ENTRY_STATUS.Draft, ENTRY_STATUS.Published)).toBe(
            true
        );
    });

    it('allows published → draft (unpublish)', () => {
        expect(canTransition(ENTRY_STATUS.Published, ENTRY_STATUS.Draft)).toBe(
            true
        );
    });

    it('treats a same-state pair as a non-transition (idempotent no-op)', () => {
        expect(canTransition(ENTRY_STATUS.Draft, ENTRY_STATUS.Draft)).toBe(
            false
        );
        expect(
            canTransition(ENTRY_STATUS.Published, ENTRY_STATUS.Published)
        ).toBe(false);
    });

    it('assertTransition passes for a legal transition', () => {
        expect(() =>
            assertTransition(ENTRY_STATUS.Draft, ENTRY_STATUS.Published)
        ).not.toThrow();
    });

    it('assertTransition throws EntryStatusTransitionError for a non-transition', () => {
        expect(() =>
            assertTransition(ENTRY_STATUS.Published, ENTRY_STATUS.Published)
        ).toThrow(EntryStatusTransitionError);
    });

    it('carries the from/to on the error', () => {
        try {
            assertTransition(ENTRY_STATUS.Draft, ENTRY_STATUS.Draft);
            throw new Error('expected a throw');
        } catch (error) {
            expect(error).toBeInstanceOf(EntryStatusTransitionError);
            const e = error as EntryStatusTransitionError;
            expect(e.from).toBe(ENTRY_STATUS.Draft);
            expect(e.to).toBe(ENTRY_STATUS.Draft);
        }
    });
});
