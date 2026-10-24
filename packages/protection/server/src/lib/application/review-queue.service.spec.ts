import {
    RECENTLY_APPROVED_DAYS,
    RECENTLY_APPROVED_LIMIT,
    ReviewQueueService
} from './review-queue.service';

const WORKSPACE = '44444444-4444-4444-8444-444444444444';
const ME = 'me';
const ANNA = 'anna';

/** One open request, as the repository returns it. */
const request = (entryId: string, overrides: Record<string, unknown> = {}) => ({
    id: `request-${entryId}`,
    contentType: 'article',
    entryId,
    revisionId: `rev-${entryId}-1`,
    requestedBy: ANNA,
    reviewerIds: [ME],
    createdAt: new Date('2026-10-01T09:00:00.000Z'),
    resolution: null,
    ...overrides
});

type Timeline = {
    head: { id: string; number: number; isPublished: boolean };
    live: { id: string; number: number } | null;
} | null;

/**
 * The service with every collaborator faked at the narrowest behaviour the
 * method reads. `changed` records what the change count was asked, so a test
 * can say *which* versions were compared rather than only the number.
 */
function makeService(
    options: {
        page?: ReturnType<typeof request>[];
        timelines?: Record<string, Timeline>;
        counts?: Record<string, number>;
        fieldsChanged?: (head: number, live: number | null) => number | null;
        recent?: { contentType: string; entryId: string; approvedAt: Date }[];
        latest?: Record<string, ReturnType<typeof request>>;
        votes?: Record<string, { userId: string; revisionId: string }[]>;
        rules?: { slug: string; enabled: boolean; requiredApprovals: number }[];
    } = {}
) {
    const asked: { head: number; live: number | null }[] = [];
    const recentCalls: unknown[][] = [];
    const service = new ReviewQueueService(
        {
            queue: async () => ({
                items: options.page ?? [],
                total: options.page?.length ?? 0
            }),
            latestByEntries: async () =>
                new Map(Object.entries(options.latest ?? {}))
        } as never,
        {
            approvedCountsOnRevisions: async () =>
                new Map(Object.entries(options.counts ?? {})),
            recentByUser: async (...args: unknown[]) => {
                recentCalls.push(args);
                return options.recent ?? [];
            },
            listForEntries: async () =>
                new Map(Object.entries(options.votes ?? {}))
        } as never,
        {
            list: async () =>
                options.rules ?? [
                    { slug: 'article', enabled: true, requiredApprovals: 2 }
                ]
        } as never,
        {
            headAndLive: async (_type: string, entryId: string) =>
                options.timelines?.[entryId] ?? null
        } as never,
        {
            fieldsChanged: async (
                _type: string,
                _entry: string,
                _ws: string,
                head: number,
                live: number | null
            ) => {
                asked.push({ head, live });
                return options.fieldsChanged
                    ? options.fieldsChanged(head, live)
                    : 3;
            }
        } as never,
        {
            getOne: async (_type: unknown, id: string) => ({
                values: { title: `Title ${id}` }
            })
        } as never,
        {
            get: (slug: string) =>
                slug === 'article'
                    ? {
                          name: 'article',
                          label: 'Articles',
                          fields: { title: { type: 'text' } }
                      }
                    : undefined
        } as never
    );
    return { service, asked, recentCalls };
}

describe('ReviewQueueService', () => {
    describe('list', () => {
        it('says how many fields changed since the live version, and which versions those are', async () => {
            const { service, asked } = makeService({
                page: [request('e1')],
                timelines: {
                    e1: {
                        head: { id: 'rev-e1-5', number: 5, isPublished: false },
                        live: { id: 'rev-e1-3', number: 3 }
                    }
                },
                counts: { 'rev-e1-5': 1 }
            });

            const view = await service.list(WORKSPACE, {}, ME);

            expect(view.items[0]).toMatchObject({
                entryId: 'e1',
                contentTypeLabel: 'Articles',
                required: 2,
                given: 1,
                headRevisionNumber: 5,
                liveRevisionNumber: 3,
                fieldsChanged: 3
            });
            // The head against the live version — not against the version the
            // request was opened on.
            expect(asked).toEqual([{ head: 5, live: 3 }]);
        });

        it('compares a never-published entry against nothing', async () => {
            const { service, asked } = makeService({
                page: [request('e1')],
                timelines: {
                    e1: {
                        head: { id: 'rev-e1-1', number: 1, isPublished: false },
                        live: null
                    }
                }
            });

            const view = await service.list(WORKSPACE, {}, ME);

            expect(view.items[0].liveRevisionNumber).toBeNull();
            expect(asked).toEqual([{ head: 1, live: null }]);
        });

        it('keeps a line whose revisions have gone, saying nothing it cannot know', async () => {
            const { service, asked } = makeService({
                page: [request('gone')],
                timelines: { gone: null }
            });

            const view = await service.list(WORKSPACE, {}, ME);

            expect(view.items[0]).toMatchObject({
                given: 0,
                headRevisionNumber: null,
                liveRevisionNumber: null,
                fieldsChanged: null
            });
            expect(asked).toEqual([]);
        });

        it('leaves the count unsaid when it cannot be computed, rather than failing the queue', async () => {
            const { service } = makeService({
                page: [request('e1')],
                timelines: {
                    e1: {
                        head: { id: 'rev-e1-2', number: 2, isPublished: false },
                        live: { id: 'rev-e1-1', number: 1 }
                    }
                },
                fieldsChanged: () => {
                    throw new Error('revision store down');
                }
            });

            const view = await service.list(WORKSPACE, {}, ME);

            expect(view.items[0].fieldsChanged).toBeNull();
        });

        it('carries the overdue threshold on an empty page too', async () => {
            const { service } = makeService();
            expect(await service.list(WORKSPACE, {}, ME)).toEqual({
                items: [],
                total: 0,
                overdueAfterDays: 3
            });
        });
    });

    describe('recentlyApproved', () => {
        const NOW = new Date('2026-10-24T12:00:00.000Z');

        it('asks only for the caller’s votes inside the window', async () => {
            const { service, recentCalls } = makeService();

            const view = await service.recentlyApproved(WORKSPACE, ME, NOW);

            expect(view).toEqual({
                items: [],
                windowDays: RECENTLY_APPROVED_DAYS
            });
            const [workspace, user, since, limit] = recentCalls[0] as [
                string,
                string,
                Date,
                number
            ];
            expect(workspace).toBe(WORKSPACE);
            expect(user).toBe(ME);
            expect(NOW.getTime() - since.getTime()).toBe(
                RECENTLY_APPROVED_DAYS * 86_400_000
            );
            expect(limit).toBe(RECENTLY_APPROVED_LIMIT);
        });

        it('says whether the caller’s approval is still on the current version', async () => {
            const { service } = makeService({
                recent: [
                    {
                        contentType: 'article',
                        entryId: 'kept',
                        approvedAt: new Date('2026-10-23T09:00:00.000Z')
                    },
                    {
                        contentType: 'article',
                        entryId: 'moved',
                        approvedAt: new Date('2026-10-20T09:00:00.000Z')
                    }
                ],
                timelines: {
                    kept: {
                        head: { id: 'kept-3', number: 3, isPublished: true },
                        live: { id: 'kept-3', number: 3 }
                    },
                    moved: {
                        head: { id: 'moved-4', number: 4, isPublished: false },
                        live: null
                    }
                },
                votes: {
                    kept: [
                        { userId: ME, revisionId: 'kept-3' },
                        { userId: ANNA, revisionId: 'kept-3' }
                    ],
                    // Mine sits on version 2; somebody else's on the head
                    // must not make it read as current.
                    moved: [
                        { userId: ME, revisionId: 'moved-2' },
                        { userId: ANNA, revisionId: 'moved-4' }
                    ]
                },
                latest: {
                    kept: request('kept', { requestedBy: ANNA }),
                    moved: request('moved', { requestedBy: 'boris' })
                }
            });

            const view = await service.recentlyApproved(WORKSPACE, ME, NOW);

            expect(view.items.map((item) => item.entryId)).toEqual([
                'kept',
                'moved'
            ]);
            expect(view.items[0]).toMatchObject({
                approvalCurrent: true,
                headPublished: true,
                requestedBy: ANNA,
                approvedAt: '2026-10-23T09:00:00.000Z',
                entryTitle: 'Title kept'
            });
            expect(view.items[1]).toMatchObject({
                approvalCurrent: false,
                headPublished: false,
                requestedBy: 'boris'
            });
        });

        it('lists an entry approved without anybody asking', async () => {
            const { service } = makeService({
                recent: [
                    {
                        contentType: 'article',
                        entryId: 'unasked',
                        approvedAt: new Date('2026-10-23T09:00:00.000Z')
                    }
                ],
                timelines: {
                    unasked: {
                        head: { id: 'u-1', number: 1, isPublished: false },
                        live: null
                    }
                },
                votes: { unasked: [{ userId: ME, revisionId: 'u-1' }] }
            });

            const view = await service.recentlyApproved(WORKSPACE, ME, NOW);

            expect(view.items[0]).toMatchObject({
                requestedBy: null,
                reviewerIds: [],
                approvalCurrent: true
            });
        });
    });
});
