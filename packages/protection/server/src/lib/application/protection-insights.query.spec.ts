import type { Database } from '@orthacms/database';
import type {
    ContentTypeRegistry,
    EntryWriterService
} from '@orthacms/content-server';
import {
    OVERDUE_AFTER_DAYS,
    ProtectionInsightsQuery,
    waitingDays
} from './protection-insights.query';

/**
 * A Drizzle stand-in: every builder call returns the chain, and awaiting it
 * yields the next queued result — the aggregate row first, then the oldest
 * request. The SQL itself is the server-e2e suite's to pin; this pins what the
 * query does with what comes back.
 */
function fakeDb(results: unknown[][]): Database {
    const queue = [...results];
    const chain: Record<string, unknown> = {};
    for (const method of ['select', 'from', 'where', 'orderBy', 'limit']) {
        chain[method] = () => chain;
    }
    chain['then'] = (resolve: (value: unknown) => unknown) =>
        resolve(queue.shift() ?? []);
    return chain as unknown as Database;
}

const ARTICLE = {
    name: 'article',
    label: 'Article',
    fields: { title: { type: 'text' } }
};

function registry(): ContentTypeRegistry {
    return {
        get: (name: string) => (name === 'article' ? ARTICLE : undefined)
    } as unknown as ContentTypeRegistry;
}

function entries(values: Record<string, unknown> | Error): EntryWriterService {
    return {
        getOne: async () => {
            if (values instanceof Error) throw values;
            return { values };
        }
    } as unknown as EntryWriterService;
}

const WS = '11111111-1111-4111-8111-111111111111';
const ENTRY = '22222222-2222-4222-8222-222222222222';

describe('ProtectionInsightsQuery', () => {
    it('counts whole days, never a negative one', () => {
        const now = new Date('2026-10-24T12:00:00Z');
        expect(waitingDays(new Date('2026-10-19T13:00:00Z'), now)).toBe(4);
        expect(waitingDays(new Date('2026-10-19T12:00:00Z'), now)).toBe(5);
        expect(waitingDays(new Date('2026-10-25T00:00:00Z'), now)).toBe(0);
    });

    it('names the longest-waiting request by its entry’s title', async () => {
        const createdAt = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000 - 1000);
        const query = new ProtectionInsightsQuery(
            fakeDb([
                [{ open: 4, overdue: 1 }],
                [{ contentType: 'article', entryId: ENTRY, createdAt }]
            ]),
            entries({ title: 'Pricing FAQ' }),
            registry()
        );

        await expect(query.summary(WS)).resolves.toEqual({
            open: 4,
            overdue: 1,
            overdueAfterDays: OVERDUE_AFTER_DAYS,
            oldestOpen: {
                contentType: 'article',
                contentTypeLabel: 'Article',
                entryId: ENTRY,
                entryTitle: 'Pricing FAQ',
                waitingDays: 5
            }
        });
    });

    it('still reports the request when its entry has gone', async () => {
        const query = new ProtectionInsightsQuery(
            fakeDb([
                [{ open: 1, overdue: 0 }],
                [
                    {
                        contentType: 'retired_type',
                        entryId: ENTRY,
                        createdAt: new Date()
                    }
                ]
            ]),
            entries(new Error('gone')),
            registry()
        );

        const summary = await query.summary(WS);
        expect(summary.oldestOpen).toEqual({
            contentType: 'retired_type',
            contentTypeLabel: 'retired_type',
            entryId: ENTRY,
            entryTitle: null,
            waitingDays: 0
        });
    });

    it('has no oldest request when nothing is open', async () => {
        const query = new ProtectionInsightsQuery(
            fakeDb([[{ open: 0, overdue: 0 }], []]),
            entries({}),
            registry()
        );

        const summary = await query.summary(WS);
        expect(summary.open).toBe(0);
        expect(summary.oldestOpen).toBeNull();
    });
});
