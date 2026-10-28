import { NOTIFICATION_KINDS } from '@orthacms/mail-domain';
import { INBOX_KINDS } from '@orthacms/inbox-domain';
import { ReviewNotifier, type RequestedReview } from './review-notifier';

const review: RequestedReview = {
    workspaceId: 'ws-1',
    contentType: 'article',
    entryId: 'entry-1',
    requestId: 'request-1',
    revisionId: 'rev-7',
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

    it('puts one item in each newly asked reviewer’s inbox', async () => {
        const delivered: unknown[] = [];
        const notifier = new ReviewNotifier(notices as never, undefined, {
            deliver: async (items) => {
                delivered.push(...items);
            }
        });

        await notifier.reviewRequested(review);

        expect(delivered).toEqual([
            {
                kind: INBOX_KINDS.REVIEW_REQUESTED,
                userId: 'carla',
                workspaceId: 'ws-1',
                payload: {
                    contentType: 'article',
                    contentTypeLabel: 'Articles',
                    entryId: 'entry-1',
                    entryTitle: 'Spring launch',
                    requesterName: 'Anna Ash',
                    required: 2
                },
                link: 'workspaces/ws-1/reviews',
                // The request on this head: asking again on the same version
                // is the same item, a new version a new one.
                dedupeKey: 'review.requested:request-1:rev-7'
            }
        ]);
    });

    it('tells the requester once per head that it is ready', async () => {
        const delivered: { dedupeKey: string; userId: string }[] = [];
        const notifier = new ReviewNotifier(notices as never, undefined, {
            deliver: async (items) => {
                delivered.push(...(items as unknown as typeof delivered));
            }
        });

        await notifier.reviewReady({
            workspaceId: 'ws-1',
            contentType: 'article',
            entryId: 'entry-1',
            requesterId: 'anna',
            revisionId: 'rev-7',
            requiredApprovals: 2
        });

        expect(delivered).toEqual([
            expect.objectContaining({
                kind: INBOX_KINDS.REVIEW_READY,
                userId: 'anna',
                link: 'workspaces/ws-1/content/article/entry-1',
                dedupeKey: 'review.ready:entry-1:rev-7'
            })
        ]);
    });

    // No provider configured and no inbox: neither plugin is registered,
    // nothing is bound, and asking for a review must work exactly as before.
    it('does nothing with neither mail nor an inbox', async () => {
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
