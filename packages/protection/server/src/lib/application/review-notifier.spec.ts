import { NOTIFICATION_KINDS } from '@orthacms/mail-domain';
import { ReviewNotifier, type RequestedReview } from './review-notifier';

const review: RequestedReview = {
    workspaceId: 'ws-1',
    contentType: 'article',
    entryId: 'entry-1',
    requesterId: 'anna',
    reviewerIds: ['boris', 'carla'],
    newReviewerIds: ['carla'],
    requiredApprovals: 2
};

const notices = {
    people: async () =>
        new Map([
            ['anna', { email: 'anna@example.com', name: 'Anna Ash' }],
            ['boris', { email: 'boris@example.com', name: null }],
            ['carla', { email: 'carla@example.com', name: 'Carla Cruz' }]
        ]),
    subject: async () => ({
        workspaceName: 'Marketing site',
        contentTypeLabel: 'Articles',
        entryTitle: 'Spring launch'
    })
};

describe('ReviewNotifier', () => {
    it('mails each newly asked reviewer, naming the others', async () => {
        const sent: unknown[] = [];
        const notifier = new ReviewNotifier(notices as never, {
            notify: async (notice) => {
                sent.push(notice);
            }
        });

        await notifier.reviewRequested(review);

        expect(sent).toEqual([
            {
                kind: NOTIFICATION_KINDS.REVIEW_REQUESTED,
                to: 'carla@example.com',
                userId: 'carla',
                recipientName: 'Carla Cruz',
                requesterName: 'Anna Ash',
                entryTitle: 'Spring launch',
                contentTypeLabel: 'Articles',
                workspaceName: 'Marketing site',
                requiredApprovals: 2,
                // Somebody with no name yet is named by their address.
                alsoAsked: ['boris@example.com'],
                reviewPath: 'workspaces/ws-1/reviews'
            }
        ]);
    });

    // No provider configured: the mail plugin is not registered, nothing is
    // bound, and asking for a review must work exactly as before.
    it('does nothing without a mail dispatcher', async () => {
        const people = jest.fn(notices.people);
        const notifier = new ReviewNotifier({ ...notices, people } as never);

        await expect(notifier.reviewRequested(review)).resolves.toBeUndefined();
        expect(people).not.toHaveBeenCalled();
    });

    it('reads nothing when the write added nobody', async () => {
        const notify = jest.fn();
        const people = jest.fn(notices.people);
        const notifier = new ReviewNotifier({ ...notices, people } as never, {
            notify
        });

        await notifier.reviewRequested({ ...review, newReviewerIds: [] });

        expect(people).not.toHaveBeenCalled();
        expect(notify).not.toHaveBeenCalled();
    });
});
