import { reviewerRows } from './reviewerRows';
import type { EntryReview, ReviewApproval } from './types';

const approval = (
    userId: string,
    over: Partial<ReviewApproval> = {}
): ReviewApproval => ({
    userId,
    revisionId: 'rev-7',
    revisionNumber: 7,
    isStale: false,
    createdAt: '2026-09-09T10:00:00.000Z',
    ...over
});

const review = (over: Partial<EntryReview> = {}): EntryReview => ({
    protected: true,
    required: 2,
    given: 0,
    stale: 0,
    blocked: true,
    bypassable: false,
    afterSave: { required: 2, given: 0, blocked: true, bypassable: false },
    headRevisionId: 'rev-7',
    headRevisionNumber: 7,
    callerWroteHead: false,
    callerApprovedHead: false,
    approvals: [],
    request: null,
    ...over
});

const asking = (...reviewerIds: string[]) => ({
    id: 'req-1',
    requestedBy: 'boris',
    reviewerIds,
    revisionId: 'rev-7',
    createdAt: '2026-09-09T09:00:00.000Z'
});

describe('reviewerRows', () => {
    it('lists everybody asked as pending until they approve', () => {
        expect(
            reviewerRows(review({ request: asking('anna', 'dmitry') }))
        ).toEqual([
            { userId: 'anna', state: 'pending', requested: true },
            { userId: 'dmitry', state: 'pending', requested: true }
        ]);
    });

    it('marks an approval of the current version as approved', () => {
        const rows = reviewerRows(
            review({
                request: asking('anna', 'dmitry'),
                approvals: [approval('dmitry')]
            })
        );

        expect(rows.map((row) => [row.userId, row.state])).toEqual([
            ['anna', 'pending'],
            ['dmitry', 'approved']
        ]);
    });

    /**
     * Who was asked never changes whose approval counts, so somebody who
     * approved unasked is listed — or the heading's count would disagree with
     * the names under it.
     */
    it('lists an approver nobody asked, after the people who were', () => {
        const rows = reviewerRows(
            review({
                request: asking('anna'),
                approvals: [approval('igor')]
            })
        );

        expect(rows).toEqual([
            { userId: 'anna', state: 'pending', requested: true },
            { userId: 'igor', state: 'approved', requested: false }
        ]);
    });

    /** The stale explanation survives: pending again, and saying why. */
    it('puts somebody whose approval a save left behind back to pending, naming the version', () => {
        const rows = reviewerRows(
            review({
                request: asking('anna'),
                approvals: [
                    approval('anna', { revisionNumber: 3, isStale: true }),
                    approval('anna', { revisionNumber: 5, isStale: true })
                ]
            })
        );

        expect(rows).toEqual([
            {
                userId: 'anna',
                state: 'pending',
                requested: true,
                staleVersion: 5
            }
        ]);
    });

    it('does not call a current approval stale because an older one is', () => {
        const rows = reviewerRows(
            review({
                approvals: [
                    approval('anna', { revisionNumber: 4, isStale: true }),
                    approval('anna')
                ]
            })
        );

        expect(rows).toEqual([
            { userId: 'anna', state: 'approved', requested: false }
        ]);
    });

    it('lists nobody when nobody was asked and nobody approved', () => {
        expect(reviewerRows(review())).toEqual([]);
    });
});
