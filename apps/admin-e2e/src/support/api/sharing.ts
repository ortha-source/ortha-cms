import { type Page } from '@playwright/test';
import { type WorkspaceView } from './workspaces';
import { RELATIONS_WORKSPACE, RELATION_AUTHOR_IDS } from './content';

/**
 * The **shared workspaces** seed layer: a second workspace that shares its
 * published records, the source/`readOnly` wire fields the content API grew
 * for it, the `?source=` candidate scope and the `/usages` read. Built on the
 * relations suite's seed (`RELATIONS_*` in `./content`), since a shared record
 * is only ever reached through a relation.
 */

/** Where a shared record lives, as the content API's `source` field sends it. */
export interface EntrySourceSeed {
    workspaceId: string;
    workspaceName: string;
}

/** The workspace the relations suite works in, never shared. */
export const LOCAL_WORKSPACE: WorkspaceView = RELATIONS_WORKSPACE;

/** The shared workspace — granted the same types, so its records are linkable. */
export const BRAND_HUB_WORKSPACE: WorkspaceView = {
    ...RELATIONS_WORKSPACE,
    id: 'ws_brand',
    name: 'Brand hub',
    slug: 'brand-hub',
    description: 'Shared brand records.',
    color: 'teal',
    isShared: true
};

/** `source` for a record of {@link BRAND_HUB_WORKSPACE}. */
export const BRAND_HUB_SOURCE: EntrySourceSeed = {
    workspaceId: BRAND_HUB_WORKSPACE.id,
    workspaceName: BRAND_HUB_WORKSPACE.name
};

/** A published author that lives in the Brand hub. Canonical UUID, like the rest. */
export const SHARED_AUTHOR = {
    id: '66666666-6666-4666-8666-666666666666',
    name: 'Hedy Lamarr'
} as const;

/** A published article that lives in the Brand hub — the read-only view's record. */
export const FOREIGN_ARTICLE = {
    id: '77777777-7777-4777-8777-777777777777',
    title: 'Brand launch notes'
} as const;

const AT = '2026-01-01T00:00:00.000Z';

const json = (body: unknown, status = 200) => ({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body)
});

/** The `?source=` values the candidate list was asked for, in request order. */
export interface SourceScopeSpy {
    readonly requested: (string | null)[];
}

/**
 * Stub `GET /api/content/author` — the author list the relation picker reads
 * its candidates from — honouring `?source=`: `own` answers the local authors
 * (`source: null`), `shared` the Brand hub's one published author, `all` (or
 * nothing) both. Returns a spy of the scopes asked for. Register **after**
 * `mockContentEntries`, which it overrides for `author` only.
 */
export async function mockSharedAuthorCandidates(
    page: Page
): Promise<SourceScopeSpy> {
    const requested: (string | null)[] = [];
    const own = [
        { id: RELATION_AUTHOR_IDS.ada, name: 'Ada Lovelace' },
        { id: RELATION_AUTHOR_IDS.grace, name: 'Grace Hopper' }
    ].map((row) => ({
        id: row.id,
        createdAt: AT,
        updatedAt: AT,
        values: { name: row.name },
        source: null
    }));
    const shared = [
        {
            id: SHARED_AUTHOR.id,
            createdAt: AT,
            updatedAt: AT,
            values: { name: SHARED_AUTHOR.name },
            source: BRAND_HUB_SOURCE
        }
    ];

    await page.route(/\/api\/content\/author(\?.*)?$/, async (route) => {
        if (route.request().method() !== 'GET') return route.fallback();
        const source = new URL(route.request().url()).searchParams.get(
            'source'
        );
        requested.push(source);
        const items =
            source === 'shared'
                ? shared
                : source === 'own' || source === null
                  ? own
                  : [...own, ...shared];
        await route.fulfill(
            json({ items, total: items.length, page: 1, pageSize: 25 })
        );
    });
    return { requested };
}

/**
 * Stub `GET /api/content/article/:id` for {@link FOREIGN_ARTICLE} as the server
 * reads a shared workspace's record from another workspace: published,
 * `readOnly: true`, and carrying its `source`. Register **after**
 * `mockContentEntryWrites` (whose multi-segment route would otherwise answer).
 */
export async function mockForeignArticle(page: Page): Promise<void> {
    await page.route(
        new RegExp(`/api/content/article/${FOREIGN_ARTICLE.id}(\\?.*)?$`),
        async (route) => {
            if (route.request().method() !== 'GET') return route.fallback();
            await route.fulfill(
                json({
                    id: FOREIGN_ARTICLE.id,
                    status: 'published',
                    publishedAt: AT,
                    createdAt: AT,
                    updatedAt: AT,
                    values: { text: FOREIGN_ARTICLE.title, author: null },
                    source: BRAND_HUB_SOURCE,
                    readOnly: true
                })
            );
        }
    );
}

/** One row of `GET …/:id/usages`. */
export interface EntryUsageSeed {
    workspaceId: string;
    workspaceName: string;
    count: number;
}

/** How often the usages read was requested. */
export interface UsagesSpy {
    readonly calls: number;
}

/**
 * Stub `GET /api/content/:type/:id/usages` — the Used-in block's read. Answers
 * `items`, or `status` when set (the block must hide itself on a failure).
 * Register **after** `mockContentEntryWrites`, whose multi-segment route would
 * otherwise answer it with an entry record.
 */
export async function mockEntryUsages(
    page: Page,
    { items = [], status }: { items?: EntryUsageSeed[]; status?: number } = {}
): Promise<UsagesSpy> {
    const spy = { calls: 0 };
    await page.route(
        /\/api\/content\/[^/?]+\/[^/?]+\/usages(\?.*)?$/,
        async (route) => {
            spy.calls += 1;
            if (status) {
                await route.fulfill(json({ message: 'Server error' }, status));
                return;
            }
            await route.fulfill(json({ items }));
        }
    );
    return spy;
}

/** Every non-GET request the page sent to the content API. */
export interface ContentWriteSpy {
    readonly writes: string[];
}

/**
 * Record every **write** (`POST`/`PATCH`/`DELETE`) to `/api/content/**` —
 * a listener, not a route, so it answers nothing and changes no mock. The
 * read-only view is proved by this staying empty.
 */
export function spyContentWrites(page: Page): ContentWriteSpy {
    const writes: string[] = [];
    page.on('request', (request) => {
        if (request.method() === 'GET') return;
        const { pathname } = new URL(request.url());
        if (pathname.startsWith('/api/content/'))
            writes.push(`${request.method()} ${pathname}`);
    });
    return { writes };
}
