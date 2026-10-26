import { pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import type { Database } from '@orthacms/database';
import { EntryCounterService } from './entry-counter.service';
import type { ContentTypeRegistry } from '../../../registry/content-type-registry';

/** Two generated-looking tables, enough for the grouped stats query. */
const articles = pgTable('content_article', {
    id: uuid('id').primaryKey(),
    workspaceId: uuid('workspace_id'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull()
});
const authors = pgTable('content_author', {
    id: uuid('id').primaryKey(),
    workspaceId: uuid('workspace_id'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull()
});

/** A query chain answering each table's `groupBy` with canned rows. */
function fakeDb(rowsByTable: Map<unknown, unknown[]>): {
    db: Database;
    queries: number;
} {
    const state = { queries: 0 };
    const db = {
        select: () => ({
            from: (table: unknown) => ({
                where: () => ({
                    groupBy: () => {
                        state.queries += 1;
                        return Promise.resolve(rowsByTable.get(table) ?? []);
                    }
                })
            })
        })
    } as unknown as Database;
    return {
        db,
        get queries() {
            return state.queries;
        }
    };
}

const registry = {
    all: () => [
        { name: 'article', table: articles },
        { name: 'author', table: authors }
    ],
    get: () => undefined
} as unknown as ContentTypeRegistry;

describe('EntryCounterService.entryStats', () => {
    it('reports one row per (workspace, type) with the newest edit', async () => {
        const edited = new Date('2026-10-20T12:00:00Z');
        const fake = fakeDb(
            new Map<unknown, unknown[]>([
                [
                    articles,
                    [
                        { workspaceId: 'w1', total: 3, lastEditedAt: edited },
                        {
                            workspaceId: 'w2',
                            total: '5',
                            lastEditedAt: '2026-10-01T00:00:00Z'
                        }
                    ]
                ],
                [authors, [{ workspaceId: 'w1', total: 1, lastEditedAt: null }]]
            ])
        );
        const service = new EntryCounterService(fake.db, registry);

        const stats = await service.entryStats(['w1', 'w2']);

        expect(stats).toEqual([
            {
                workspaceId: 'w1',
                slug: 'article',
                count: 3,
                lastEditedAt: edited
            },
            {
                workspaceId: 'w2',
                slug: 'article',
                count: 5,
                lastEditedAt: new Date('2026-10-01T00:00:00Z')
            },
            { workspaceId: 'w1', slug: 'author', count: 1, lastEditedAt: null }
        ]);
        // One grouped query per content type — never one per workspace.
        expect(fake.queries).toBe(2);
    });

    it('asks nothing for an empty id list', async () => {
        const fake = fakeDb(new Map());
        const service = new EntryCounterService(fake.db, registry);
        await expect(service.entryStats([])).resolves.toEqual([]);
        expect(fake.queries).toBe(0);
    });
});
