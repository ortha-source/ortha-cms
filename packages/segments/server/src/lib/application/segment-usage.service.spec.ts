import { NotFoundException } from '@nestjs/common';
import { getTableName, type SQL } from 'drizzle-orm';
import { PgDialect, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import type {
    AnyContentType,
    ContentTypeRegistry
} from '@orthacms/content-server';
import type { Database } from '@orthacms/database';
import {
    SEGMENT_USAGE_LIMIT,
    SegmentUsageService,
    USAGE_STATE
} from './segment-usage.service';

const SEGMENT = '11111111-1111-4111-8111-111111111111';
const OTHER = '99999999-9999-4999-8999-999999999999';
const WORKSPACE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PRICING = '22222222-2222-4222-8222-222222222222';
const GUIDE = '33333333-3333-4333-8333-333333333333';
const RIVALS = '44444444-4444-4444-8444-444444444444';
const GHOST = '55555555-5555-4555-8555-555555555555';

/** A localized, paranoid content table, as content's builder produces one. */
const articles = pgTable('content_article', {
    id: uuid('id').primaryKey(),
    workspaceId: uuid('workspace_id').notNull(),
    title: text('title'),
    locale: text('locale'),
    localeGroupId: uuid('locale_group_id'),
    deletedAt: timestamp('deleted_at')
});

const ARTICLE = {
    name: 'article',
    label: 'Article',
    i18n: true,
    paranoid: true,
    fields: { title: { type: 'text' } },
    table: articles
} as unknown as AnyContentType;

/** What each table answers, and every `where` the service narrowed by. */
interface Answers {
    segment?: Record<string, unknown>[];
    count?: number;
    access?: Record<string, unknown>[];
    entries?: Record<string, unknown>[];
}

/**
 * A database answering by table, and recording each `where` so the workspace
 * scoping can be read off the SQL Postgres would receive rather than inferred.
 */
function harness(answers: Answers) {
    const wheres: { table: string; where: SQL }[] = [];
    let limits: number[] = [];
    const db = {
        select: (fields?: Record<string, unknown>) => ({
            from: (table: Parameters<typeof getTableName>[0]) => {
                const name = getTableName(table);
                const rows = (): unknown[] => {
                    if (name === 'segments') return answers.segment ?? [];
                    if (name === 'entry_access') {
                        return fields && 'value' in fields
                            ? [{ value: answers.count ?? 0 }]
                            : (answers.access ?? []);
                    }
                    return answers.entries ?? [];
                };
                return {
                    where: (where: SQL) => {
                        wheres.push({ table: name, where });
                        const pending = Promise.resolve(rows());
                        const chain = {
                            then: pending.then.bind(pending),
                            orderBy: () => chain,
                            limit: (n: number) => {
                                limits = [...limits, n];
                                return pending;
                            }
                        };
                        return chain;
                    }
                };
            }
        })
    };
    const registry = {
        get: (slug: string) => (slug === 'article' ? ARTICLE : undefined)
    } as unknown as ContentTypeRegistry;
    const service = new SegmentUsageService(
        db as unknown as Database,
        registry
    );
    const sqlOf = (table: string) =>
        wheres
            .filter((entry) => entry.table === table)
            .map((entry) => new PgDialect().sqlToQuery(entry.where));
    return { service, sqlOf, limits: () => limits };
}

const access = (
    entryId: string,
    lists: { allow?: string[]; deny?: string[] },
    typeSlug = 'article'
) => ({
    entryId,
    typeSlug,
    allow: lists.allow ?? [],
    deny: lists.deny ?? []
});

const entry = (
    id: string,
    title: string,
    extra: Record<string, unknown> = {}
) => ({
    id,
    workspaceId: WORKSPACE,
    title,
    locale: 'en',
    deletedAt: null,
    ...extra
});

describe('SegmentUsageService', () => {
    it('answers 404 for an audience that does not exist', async () => {
        const { service } = harness({ segment: [] });
        await expect(
            service.forWorkspace(SEGMENT, WORKSPACE)
        ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('names each entry with its title, its type and which side names the audience', async () => {
        const { service } = harness({
            segment: [{ id: SEGMENT }],
            count: 3,
            access: [
                access(PRICING, { allow: [SEGMENT] }),
                access(GUIDE, { allow: [OTHER, SEGMENT] }),
                access(RIVALS, { deny: [SEGMENT] })
            ],
            entries: [
                entry(PRICING, 'Enterprise pricing'),
                entry(GUIDE, 'Acme onboarding guide', { locale: 'de' }),
                entry(RIVALS, 'Competitor comparison')
            ]
        });

        const view = await service.forWorkspace(SEGMENT, WORKSPACE);

        expect(view).toEqual({
            segmentId: SEGMENT,
            total: 3,
            truncated: false,
            // By type, then title.
            items: [
                {
                    entryId: GUIDE,
                    typeSlug: 'article',
                    typeLabel: 'Article',
                    title: 'Acme onboarding guide',
                    locale: 'de',
                    state: USAGE_STATE.Allow,
                    trashed: false
                },
                {
                    entryId: RIVALS,
                    typeSlug: 'article',
                    typeLabel: 'Article',
                    title: 'Competitor comparison',
                    locale: 'en',
                    state: USAGE_STATE.Deny,
                    trashed: false
                },
                {
                    entryId: PRICING,
                    typeSlug: 'article',
                    typeLabel: 'Article',
                    title: 'Enterprise pricing',
                    locale: 'en',
                    state: USAGE_STATE.Allow,
                    trashed: false
                }
            ]
        });
    });

    it('reads both access rows and entry rows by the caller’s workspace only', async () => {
        const { service, sqlOf } = harness({
            segment: [{ id: SEGMENT }],
            count: 1,
            access: [access(PRICING, { allow: [SEGMENT] })],
            entries: [entry(PRICING, 'Enterprise pricing')]
        });

        await service.forWorkspace(SEGMENT, WORKSPACE);

        // The count and the page are both narrowed by the workspace, and the
        // audience id is bound as ONE uuid[] parameter, never inlined.
        const reads = sqlOf('entry_access');
        expect(reads).toHaveLength(2);
        for (const read of reads) {
            expect(read.sql).toContain('"entry_access"."workspace_id" = $1');
            expect(read.sql).toMatch(/"allow" @> \$2::uuid\[\]/);
            expect(read.sql).toMatch(/"deny" @> \$3::uuid\[\]/);
            expect(read.params).toEqual([WORKSPACE, [SEGMENT], [SEGMENT]]);
        }
        // …and so is the read of the entries themselves, so a row carrying a
        // foreign entry id can never name another workspace's entry.
        const [rows] = sqlOf('content_article');
        expect(rows.sql).toContain('"content_article"."workspace_id" = $');
        expect(rows.params).toContain(WORKSPACE);
    });

    it('reads a row naming the audience on both sides as a deny, as canRead does', async () => {
        const { service } = harness({
            segment: [{ id: SEGMENT }],
            count: 1,
            access: [access(PRICING, { allow: [SEGMENT], deny: [SEGMENT] })],
            entries: [entry(PRICING, 'Enterprise pricing')]
        });

        const view = await service.forWorkspace(SEGMENT, WORKSPACE);
        expect(view.items[0].state).toBe(USAGE_STATE.Deny);
    });

    it('marks an entry in the trash, which still names the audience', async () => {
        const { service } = harness({
            segment: [{ id: SEGMENT }],
            count: 1,
            access: [access(PRICING, { allow: [SEGMENT] })],
            entries: [
                entry(PRICING, 'Enterprise pricing', {
                    deletedAt: new Date(0)
                })
            ]
        });

        const view = await service.forWorkspace(SEGMENT, WORKSPACE);
        expect(view.items[0].trashed).toBe(true);
    });

    it('drops an access row whose entry is gone, and does not count it', async () => {
        // Hard deletes are not hooked, so the access row outlives its entry.
        const { service } = harness({
            segment: [{ id: SEGMENT }],
            count: 2,
            access: [
                access(PRICING, { allow: [SEGMENT] }),
                access(GHOST, { deny: [SEGMENT] })
            ],
            entries: [entry(PRICING, 'Enterprise pricing')]
        });

        const view = await service.forWorkspace(SEGMENT, WORKSPACE);
        expect(view.items.map((item) => item.entryId)).toEqual([PRICING]);
        expect(view.total).toBe(1);
        expect(view.truncated).toBe(false);
    });

    it('keeps an entry of a type no longer registered, without a title', async () => {
        const { service } = harness({
            segment: [{ id: SEGMENT }],
            count: 1,
            access: [access(PRICING, { allow: [SEGMENT] }, 'retired')]
        });

        const view = await service.forWorkspace(SEGMENT, WORKSPACE);
        expect(view.items).toEqual([
            expect.objectContaining({
                entryId: PRICING,
                typeSlug: 'retired',
                typeLabel: 'retired',
                title: null
            })
        ]);
    });

    it('caps the page and says the count runs past it', async () => {
        const { service, limits } = harness({
            segment: [{ id: SEGMENT }],
            count: SEGMENT_USAGE_LIMIT + 5,
            access: [access(PRICING, { allow: [SEGMENT] })],
            entries: [entry(PRICING, 'Enterprise pricing')]
        });

        const view = await service.forWorkspace(SEGMENT, WORKSPACE);
        expect(limits()).toContain(SEGMENT_USAGE_LIMIT);
        expect(view.total).toBe(SEGMENT_USAGE_LIMIT + 5);
        expect(view.truncated).toBe(true);
    });

    it('answers an audience nothing names with an empty, untruncated list', async () => {
        const { service } = harness({ segment: [{ id: SEGMENT }], count: 0 });

        await expect(service.forWorkspace(SEGMENT, WORKSPACE)).resolves.toEqual(
            { segmentId: SEGMENT, total: 0, items: [], truncated: false }
        );
    });
});
