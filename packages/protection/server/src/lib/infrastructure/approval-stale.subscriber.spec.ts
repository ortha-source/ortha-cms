import { ApprovalStaleSubscriber } from './approval-stale.subscriber';

const event = (actorId = 'anna') => ({
    eventId: 'e-1',
    kind: 'entry.updated',
    aggregateType: 'content_entry',
    aggregateId: 'entry-1',
    occurredAt: new Date(),
    payload: {
        contentType: 'article',
        workspaceId: 'ws-1',
        actor: { id: actorId }
    }
});

function make(
    options: {
        rule?: Record<string, unknown> | null;
        open?: boolean;
        published?: boolean;
        votes?: { userId: string; revisionId: string }[];
    } = {}
) {
    const told: unknown[] = [];
    const subscriber = new ApprovalStaleSubscriber(
        {
            list: async () =>
                options.rule === null
                    ? []
                    : [
                          {
                              slug: 'article',
                              enabled: true,
                              countStaleApprovals: false,
                              ...options.rule
                          }
                      ]
        } as never,
        {
            findOpenByEntry: async () =>
                options.open === false ? null : { id: 'r' }
        } as never,
        { listForEntry: async () => options.votes ?? [] } as never,
        {
            timeline: async () => [
                { id: 'rev-8', number: 8 },
                { id: 'rev-7', number: 7 }
            ],
            find: async () => ({
                id: 'rev-8',
                isPublished: !!options.published
            })
        } as never,
        { register: () => undefined } as never,
        {
            approvalsStale: async (stale: unknown) => {
                told.push(stale);
            }
        } as never
    );
    return { subscriber, told };
}

describe('ApprovalStaleSubscriber', () => {
    const votes = [
        { userId: 'boris', revisionId: 'rev-7' },
        { userId: 'carla', revisionId: 'rev-6' },
        { userId: 'anna', revisionId: 'rev-7' }
    ];

    it('tells the approvers of the replaced version, never the saver', async () => {
        const { subscriber, told } = make({ votes });

        await subscriber.handle(event('anna'));

        expect(told).toEqual([
            {
                workspaceId: 'ws-1',
                contentType: 'article',
                entryId: 'entry-1',
                // Carla's vote was already stale before this save.
                userIds: ['boris'],
                approvedRevisionNumber: 7,
                headRevisionId: 'rev-8'
            }
        ]);
    });

    it.each([
        [
            'the rule counts stale approvals',
            { rule: { countStaleApprovals: true } }
        ],
        ['nobody protected the type', { rule: null }],
        ['no review is open', { open: false }],
        ['the head is already live', { published: true }]
    ])('stays quiet when %s', async (_why, options) => {
        const { subscriber, told } = make({ votes, ...options });

        await subscriber.handle(event());

        expect(told).toEqual([]);
    });
});
