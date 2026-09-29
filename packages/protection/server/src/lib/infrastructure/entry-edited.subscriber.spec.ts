import type { DomainEvent } from '@orthacms/database';
import { EntryEditedSubscriber } from './entry-edited.subscriber';

const ENTRY = '44444444-4444-4444-8444-444444444444';
const WORKSPACE = '55555555-5555-4555-8555-555555555555';
const ANNA = 'anna';
const BORIS = 'boris';
const CHEN = 'chen';

/** A save as the outbox dispatcher hands one over. */
function updated(
    payload: Record<string, unknown> = {
        contentType: 'article',
        workspaceId: WORKSPACE
    }
): DomainEvent {
    return {
        kind: 'entry.updated',
        aggregateType: 'content_entry',
        aggregateId: ENTRY,
        payload
    } as unknown as DomainEvent;
}

type Last = {
    requestedBy: string;
    reviewerIds: string[];
    resolution: 'published' | 'withdrawn' | null;
};

/**
 * The subscriber with every collaborator faked to the narrowest behaviour it
 * reads. Defaults describe the case the subscriber exists for: a protected
 * type, a request closed by a publish, and a head edited since.
 */
function make(
    options: {
        open?: boolean;
        last?: Last | null;
        ruleEnabled?: boolean | null;
        headPublished?: boolean;
        eligible?: string[];
    } = {}
) {
    const opened: Record<string, unknown>[] = [];
    const last =
        options.last === undefined
            ? {
                  requestedBy: ANNA,
                  reviewerIds: [BORIS, CHEN],
                  resolution: 'published' as const
              }
            : options.last;
    const subscriber = new EntryEditedSubscriber(
        {
            findOpenByEntry: async () => (options.open ? { id: 'open' } : null),
            lastResolvedByEntry: async () => last,
            open: async (input: Record<string, unknown>) => {
                opened.push(input);
                return { id: 'reopened' };
            }
        } as never,
        {
            list: async () =>
                options.ruleEnabled === null
                    ? []
                    : [
                          {
                              slug: 'article',
                              enabled: options.ruleEnabled ?? true
                          }
                      ]
        } as never,
        {
            find: async () => ({
                id: 'rev-9',
                number: 9,
                authorId: ANNA,
                isPublished: options.headPublished ?? false
            })
        } as never,
        {
            list: async () =>
                (options.eligible ?? [BORIS, CHEN]).map((userId) => ({
                    userId,
                    email: `${userId}@example.com`
                }))
        } as never,
        { register: () => undefined } as never
    );
    return { subscriber, opened };
}

describe('EntryEditedSubscriber', () => {
    it('subscribes to saves', () => {
        expect(make().subscriber.kinds).toEqual(['entry.updated']);
    });

    /**
     * The bug this exists for: approve → publish → edit left the entry out of
     * the reviewers' queue, because the publish had closed the request and
     * nothing opened the next one.
     */
    it('reopens a request a publish closed, for the same people, on the new head', async () => {
        const { subscriber, opened } = make();

        await subscriber.handle(updated());

        expect(opened).toEqual([
            {
                workspaceId: WORKSPACE,
                contentType: 'article',
                entryId: ENTRY,
                revisionId: 'rev-9',
                requestedBy: ANNA,
                reviewerIds: [BORIS, CHEN]
            }
        ]);
    });

    it('leaves an open request alone', async () => {
        const { subscriber, opened } = make({ open: true });

        await subscriber.handle(updated());

        expect(opened).toEqual([]);
    });

    it('never reopens a withdrawn request', async () => {
        const { subscriber, opened } = make({
            last: {
                requestedBy: ANNA,
                reviewerIds: [BORIS],
                resolution: 'withdrawn'
            }
        });

        await subscriber.handle(updated());

        expect(opened).toEqual([]);
    });

    /** Rows closed before the column existed say nothing about why. */
    it('does not guess about a request closed before resolutions were kept', async () => {
        const { subscriber, opened } = make({
            last: { requestedBy: ANNA, reviewerIds: [BORIS], resolution: null }
        });

        await subscriber.handle(updated());

        expect(opened).toEqual([]);
    });

    it('does nothing for an entry nobody ever asked about', async () => {
        const { subscriber, opened } = make({ last: null });

        await subscriber.handle(updated());

        expect(opened).toEqual([]);
    });

    it('does nothing on a type without an enabled rule', async () => {
        const off = make({ ruleEnabled: false });
        const none = make({ ruleEnabled: null });

        await off.subscriber.handle(updated());
        await none.subscriber.handle(updated());

        expect(off.opened).toEqual([]);
        expect(none.opened).toEqual([]);
    });

    /**
     * Delivery is unordered: a save-and-publish can arrive here after the
     * publish, when the head is the live version and there is nothing to
     * review (`protection:I-23`).
     */
    it('does nothing when the head it reads is already live', async () => {
        const { subscriber, opened } = make({ headPublished: true });

        await subscriber.handle(updated());

        expect(opened).toEqual([]);
    });

    /** `protection:I-22` — nobody is left pending with no way to approve. */
    it('drops reviewers who can no longer approve, and stops when none are left', async () => {
        const some = make({ eligible: [CHEN] });
        const nobody = make({ eligible: [] });

        await some.subscriber.handle(updated());
        await nobody.subscriber.handle(updated());

        expect(some.opened).toEqual([
            expect.objectContaining({ reviewerIds: [CHEN] })
        ]);
        expect(nobody.opened).toEqual([]);
    });

    it('ignores an event without the subject it needs', async () => {
        const { subscriber, opened } = make();

        await subscriber.handle(updated({ contentType: 'article' }));

        expect(opened).toEqual([]);
    });
});
