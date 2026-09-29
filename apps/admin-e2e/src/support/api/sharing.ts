import { type Page } from '@playwright/test';
import { type WorkspaceView } from './workspaces';
import {
    RELATIONS_SCHEMA_SEED,
    RELATIONS_WORKSPACE,
    RELATION_AUTHOR_IDS,
    type ContentTypeAccessSeed,
    type ContentTypeSummary
} from './content';

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

/**
 * The workspace the relations suite works in, never shared. Granted Articles
 * and Authors from the Brand hub as well as its own (per-source grants), which
 * is what puts the Brand hub's records in its relation picker.
 */
export const LOCAL_WORKSPACE: WorkspaceView = {
    ...RELATIONS_WORKSPACE,
    sharedContent: ['article', 'author'].map((slug) => ({
        slug,
        kind: 'collection' as const,
        sourceWorkspaceId: 'ws_brand',
        sourceWorkspaceName: 'Brand hub',
        available: true
    }))
};

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
    /** The `?sourceWorkspaceId=` of each request (`null` when absent). */
    readonly sourceIds: (string | null)[];
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
    const sourceIds: (string | null)[] = [];
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
        const params = new URL(route.request().url()).searchParams;
        const source = params.get('source');
        const sourceId = params.get('sourceWorkspaceId');
        requested.push(source);
        sourceIds.push(sourceId);
        const all =
            source === 'shared'
                ? shared
                : source === 'own' || source === null
                  ? own
                  : [...own, ...shared];
        // Narrowed server-side to one shared workspace, as the API does.
        const items = sourceId
            ? all.filter((row) => row.source?.workspaceId === sourceId)
            : all;
        await route.fulfill(
            json({ items, total: items.length, page: 1, pageSize: 25 })
        );
    });
    return { requested, sourceIds };
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

// ---------------------------------------------------------------------------
// Per-source grants: a type granted as the workspace's own, from a shared
// workspace, or both — `access` on the schema list, `sharedContent` on the
// workspace, and `?source=shared` on a type's list.
// ---------------------------------------------------------------------------

/** `access` for a type the open workspace holds as its own, nothing shared. */
const OWN_ONLY: ContentTypeAccessSeed = { own: true, sharedSources: [] };

/**
 * The relations catalogue with `access` as the {@link LOCAL_WORKSPACE} sees it
 * — Articles and Authors also granted from the Brand hub — what the relation
 * picker's Source options are built from.
 */
export const SHARED_RELATIONS_SCHEMA_SEED: ContentTypeSummary[] =
    RELATIONS_SCHEMA_SEED.map((type) => ({
        ...type,
        access:
            type.name === 'author' || type.name === 'article'
                ? { own: true, sharedSources: [BRAND_HUB_SOURCE] }
                : OWN_ONLY
    }));

/**
 * A workspace granted Authors **both ways** (its own and the Brand hub's) and
 * Tags **only** from the Brand hub — so it holds no Tags of its own and may not
 * create one.
 */
export const PER_SOURCE_WORKSPACE: WorkspaceView = {
    ...RELATIONS_WORKSPACE,
    id: 'ws_per_source',
    name: 'Per-source demo',
    slug: 'per-source-demo',
    content: ['article', 'author', 'seo_meta'],
    sharedContent: [
        {
            slug: 'author',
            kind: 'collection',
            sourceWorkspaceId: BRAND_HUB_WORKSPACE.id,
            sourceWorkspaceName: BRAND_HUB_WORKSPACE.name,
            available: true
        },
        {
            slug: 'tag',
            kind: 'collection',
            sourceWorkspaceId: BRAND_HUB_WORKSPACE.id,
            sourceWorkspaceName: BRAND_HUB_WORKSPACE.name,
            available: true
        }
    ]
};

/** The relations catalogue as {@link PER_SOURCE_WORKSPACE} sees it. */
export const PER_SOURCE_SCHEMA_SEED: ContentTypeSummary[] =
    RELATIONS_SCHEMA_SEED.map((type) => ({
        ...type,
        access:
            type.name === 'author'
                ? { own: true, sharedSources: [BRAND_HUB_SOURCE] }
                : type.name === 'tag'
                  ? { own: false, sharedSources: [BRAND_HUB_SOURCE] }
                  : OWN_ONLY
    }));

/**
 * Stub `GET /api/content-schema` **per workspace**, by the `X-Workspace-Id`
 * header the admin scopes every request with — `access` is an answer about
 * the open workspace, so one catalogue for all of them would claim a shared
 * workspace reads from itself. A workspace missing from `byWorkspace` gets
 * `fallback`. Register **after** `mockContentSchema`, which it overrides.
 */
export async function mockContentSchemaByWorkspace(
    page: Page,
    byWorkspace: Record<string, ContentTypeSummary[]>,
    fallback: ContentTypeSummary[] = RELATIONS_SCHEMA_SEED
): Promise<void> {
    await page.route(/\/api\/content-schema(\?.*)?$/, async (route) => {
        const workspaceId = route.request().headers()['x-workspace-id'] ?? '';
        await route.fulfill(json(byWorkspace[workspaceId] ?? fallback));
    });
}

/** Two published tags that live in the Brand hub. */
export const SHARED_TAGS = [
    { id: '88888888-8888-4888-8888-888888888881', name: 'Brand voice' },
    { id: '88888888-8888-4888-8888-888888888882', name: 'Launch' }
] as const;

/**
 * Stub `GET /api/content/tag` honouring `?source=`: `shared` (or `all`) answers
 * the Brand hub's published tags, each with its `source`; `own` — or no
 * `source`, which means own — answers none, since {@link PER_SOURCE_WORKSPACE}
 * holds no Tags of its own. Returns a spy of the scopes asked for. Register
 * **after** `mockContentEntries`, which it overrides for `tag` only.
 */
export async function mockSharedTagEntries(
    page: Page
): Promise<SourceScopeSpy> {
    const requested: (string | null)[] = [];
    const sourceIds: (string | null)[] = [];
    const shared = SHARED_TAGS.map((tag) => ({
        id: tag.id,
        createdAt: AT,
        updatedAt: AT,
        values: { name: tag.name, slug: tag.name.toLowerCase() },
        source: BRAND_HUB_SOURCE,
        readOnly: true
    }));

    await page.route(/\/api\/content\/tag(\?.*)?$/, async (route) => {
        if (route.request().method() !== 'GET') return route.fallback();
        const params = new URL(route.request().url()).searchParams;
        const source = params.get('source');
        const sourceId = params.get('sourceWorkspaceId');
        requested.push(source);
        sourceIds.push(sourceId);
        const scoped = source === 'shared' || source === 'all' ? shared : [];
        // Narrowed server-side to one shared workspace, as the API does.
        const items = sourceId
            ? scoped.filter((row) => row.source.workspaceId === sourceId)
            : scoped;
        await route.fulfill(
            json({ items, total: items.length, page: 1, pageSize: 25 })
        );
    });
    return { requested, sourceIds };
}

/**
 * Stub `GET /api/content/tag/:id` for the first of {@link SHARED_TAGS}, read
 * from the Brand hub: `readOnly`, with its `source`. Register **after**
 * `mockContentEntryWrites`.
 */
export async function mockForeignTag(page: Page): Promise<void> {
    const tag = SHARED_TAGS[0];
    await page.route(
        new RegExp(`/api/content/tag/${tag.id}(\\?.*)?$`),
        async (route) => {
            if (route.request().method() !== 'GET') return route.fallback();
            await route.fulfill(
                json({
                    id: tag.id,
                    createdAt: AT,
                    updatedAt: AT,
                    values: { name: tag.name, slug: tag.name.toLowerCase() },
                    source: BRAND_HUB_SOURCE,
                    readOnly: true
                })
            );
        }
    );
}
