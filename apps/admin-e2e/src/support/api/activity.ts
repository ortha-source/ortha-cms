import { type Page, type Route } from '@playwright/test';

/** An audit event as `GET /api/activity` returns it (server `ActivityEventView`). */
export interface ActivitySeed {
    id: string;
    kind: string;
    subjectType: string;
    subjectId: string;
    actorId: string | null;
    actorEmail: string | null;
    meta: Record<string, unknown> | null;
    at: string;
}

/**
 * The fixed event log `GET /api/activity` returns — the front-end analog of the
 * server suite's seed. One of several kinds and actors, including a
 * system-initiated event (null actor) so the "System" rendering is covered.
 */
export const DEFAULT_ACTIVITY: ActivitySeed[] = [
    {
        id: 'ev_1',
        kind: 'user.signed_in',
        subjectType: 'user',
        subjectId: 'u_ada',
        actorId: 'u_ada',
        actorEmail: 'ada@ortha.dev',
        meta: null,
        at: '2026-06-10T09:00:00.000Z'
    },
    {
        id: 'ev_2',
        kind: 'user.role_changed',
        subjectType: 'user',
        subjectId: 'u_grace',
        actorId: 'u_ada',
        actorEmail: 'ada@ortha.dev',
        meta: { from: 'viewer', to: 'contributor' },
        at: '2026-06-10T10:00:00.000Z'
    },
    {
        id: 'ev_3',
        kind: 'user.suspended',
        subjectType: 'user',
        subjectId: 'u_katherine',
        actorId: 'u_grace',
        actorEmail: 'grace@ortha.dev',
        meta: null,
        at: '2026-06-11T08:30:00.000Z'
    },
    {
        id: 'ev_4',
        kind: 'user.invited',
        subjectType: 'user',
        subjectId: 'u_alan',
        actorId: null,
        actorEmail: null,
        meta: { email: 'alan@ortha.dev' },
        at: '2026-06-11T12:00:00.000Z'
    }
];

/**
 * **Every audit kind the server can write**, paired with the `subjectType` and
 * the `meta` shape it carries — a black-box mirror of `FACET_MAPPERS` in
 * `packages/activity/server/src/lib/activity/infrastructure/audit-event-mapping.ts`
 * (its *output* kinds, not its input event kinds).
 *
 * This list is the front-end half of a pin the two sides badly need. An audit
 * kind the admin does not know is **not a type error and not a runtime error**:
 * `toActivityEvent` casts `dto.kind as ActivityKind`, `formatActivityAction`
 * finds no descriptor, and the Action column quietly prints the raw dotted wire
 * token, untranslated. That is how `media.asset.uploaded` and six `workspace.*`
 * kinds ended up rendering literally in a shipped UI. Nothing failed; a reader
 * just saw machine strings.
 *
 * So when a new kind is added server-side, add it here — the specs below then
 * fail until the admin has a label for it.
 */
export const ALL_KINDS_ACTIVITY: ActivitySeed[] = [
    ['user.invited', 'user', { email: 'alan@ortha.dev' }],
    ['user.invite_resent', 'user', { email: 'alan@ortha.dev' }],
    ['user.invite_revoked', 'user', { email: 'alan@ortha.dev' }],
    ['user.activated', 'user', null],
    ['user.profile_updated', 'user', { name: { from: 'Ada L', to: 'Ada B' } }],
    ['user.role_changed', 'user', { from: 'viewer', to: 'contributor' }],
    ['user.suspended', 'user', null],
    ['user.reactivated', 'user', null],
    ['user.password_changed', 'user', { sessionsRevoked: 2 }],
    ['user.signed_in', 'user', null],
    ['user.signed_out', 'user', null],
    ['workspace.created', 'workspace', { name: 'Marketing', slug: 'marketing' }],
    ['workspace.updated', 'workspace', { fields: ['name'] }],
    ['workspace.archived', 'workspace', {}],
    ['workspace.unarchived', 'workspace', {}],
    ['workspace.deleted', 'workspace', { name: 'Old', slug: 'old' }],
    ['workspace.member_added', 'user', { workspaceId: 'w_1', email: 'a@b.c' }],
    ['workspace.member_removed', 'user', { workspaceId: 'w_1', email: 'a@b.c' }],
    ['workspace.content_granted', 'workspace', { slug: 'author', kind: 'collection' }],
    ['workspace.content_revoked', 'workspace', { slug: 'author' }],
    ['entry.published', 'content_entry', { contentType: 'article' }],
    ['entry.unpublished', 'content_entry', { contentType: 'article' }],
    ['token.created', 'api_token', { name: 'CI', scope: 'full' }],
    ['token.revoked', 'api_token', { name: 'CI', scope: 'full' }],
    ['media.asset.uploaded', 'media_asset', { name: 'hero.png', kind: 'image' }],
    ['media.asset.updated', 'media_asset', { alt: 'A hero' }],
    ['media.asset.moved', 'media_asset', { folderId: 'f_1' }],
    ['media.asset.deleted', 'media_asset', { storageKey: 'w/a/hero.png' }],
    ['media.folder.created', 'media_folder', { name: 'Brand', parentId: null }],
    ['media.folder.renamed', 'media_folder', { name: 'Brand assets' }],
    ['media.folder.deleted', 'media_folder', {}]
].map(([kind, subjectType, meta], index) => ({
    id: `ev_kind_${index}`,
    kind: kind as string,
    subjectType: subjectType as string,
    subjectId: `subj_${index}`,
    actorId: 'u_ada',
    actorEmail: 'ada@ortha.dev',
    meta: meta as Record<string, unknown> | null,
    // Descending, so the log reads newest-first like the server's default.
    at: new Date(Date.UTC(2026, 5, 1, 12, 0, 0) - index * 60_000).toISOString()
}));

/** Reads the filter/paging params the page sends from the intercepted URL. */
function paramsOf(route: Route): {
    kinds: string[];
    actorEmail: string;
    filter: string;
    page: number;
    pageSize: number;
} {
    const url = new URL(route.request().url());
    const kind = url.searchParams.get('kind') ?? '';
    return {
        kinds: kind ? kind.split(',').map((part) => part.trim()) : [],
        actorEmail: (url.searchParams.get('actorEmail') ?? '')
            .trim()
            .toLowerCase(),
        filter: url.searchParams.get('filter') ?? '',
        page: Number(url.searchParams.get('page') ?? '1'),
        pageSize: Number(url.searchParams.get('pageSize') ?? '25')
    };
}

/** The leaf/group wire shapes the query builder emits under `?filter=`. */
type FilterNode =
    | { and: FilterNode[] }
    | { or: FilterNode[] }
    | { field: string; op: string; value: unknown };

/** Resolve an event's value for a whitelisted wire field name. */
function eventValue(event: ActivitySeed, field: string): string {
    switch (field) {
        case 'kind':
            return event.kind;
        case 'subjectType':
            return event.subjectType;
        case 'subjectId':
            return event.subjectId;
        case 'actorId':
            return event.actorId ?? '';
        case 'actorEmail':
            return event.actorEmail ?? '';
        case 'at':
            return event.at;
        default:
            return '';
    }
}

/**
 * A minimal evaluator for the query-builder wire tree — enough to make the
 * Activity filter drawer behave for real in a browser test (mirrors the members
 * mock). Supports `eq`/`ne`/`in`/`ilike`/`null`/`gte`/`lte` plus `and`/`or`; an
 * unknown shape matches everything (fail-open, so unrelated tests are
 * unaffected). The wire grammar can't be imported (specs stay black-box), so
 * the shape is re-declared here.
 */
function matchesNode(event: ActivitySeed, node: FilterNode): boolean {
    if ('and' in node) return node.and.every((c) => matchesNode(event, c));
    if ('or' in node) return node.or.some((c) => matchesNode(event, c));
    const actual = eventValue(event, node.field);
    switch (node.op) {
        case 'eq':
            return actual === node.value;
        case 'ne':
            return actual !== node.value;
        case 'in':
            return Array.isArray(node.value) && node.value.includes(actual);
        case 'ilike': {
            const needle = String(node.value)
                .replace(/^%|%$/g, '')
                .toLowerCase();
            return actual.toLowerCase().includes(needle);
        }
        case 'null':
            return actual.length === 0;
        case 'gte':
            return actual >= String(node.value);
        case 'lte':
            return actual <= String(node.value);
        default:
            return true;
    }
}

/** Apply a raw `?filter=` JSON string to the log; no filter → unchanged. */
function applyFilter(events: ActivitySeed[], filter: string): ActivitySeed[] {
    if (!filter) return events;
    let node: FilterNode;
    try {
        node = JSON.parse(filter) as FilterNode;
    } catch {
        return events;
    }
    return events.filter((e) => matchesNode(e, node));
}

/**
 * Stub `GET /api/activity` with a deterministic log, applying the same
 * filtering + pagination the server does (kind IN, actor-email substring,
 * offset paging) so the page's controls behave for real. The page sits behind
 * the shell's gate, so a test also needs `mockSignedIn`. Pass `delayMs` to hold
 * the response open and observe the loading skeleton.
 *
 * Registered per-`page`, so it resets between tests with the browser context.
 */
export async function mockActivity(
    page: Page,
    events: ActivitySeed[] = DEFAULT_ACTIVITY,
    { delayMs }: { delayMs?: number } = {}
): Promise<void> {
    await page.route('**/api/activity?*', async (route) => {
        if (route.request().method() !== 'GET') {
            await route.fallback();
            return;
        }
        if (delayMs) {
            await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
        const {
            kinds,
            actorEmail,
            filter,
            page: pageNum,
            pageSize
        } = paramsOf(route);

        const searched = events.filter((event) => {
            if (kinds.length > 0 && !kinds.includes(event.kind)) {
                return false;
            }
            if (
                actorEmail &&
                !(event.actorEmail ?? '').toLowerCase().includes(actorEmail)
            ) {
                return false;
            }
            return true;
        });
        // The query-builder `?filter=` intersects with the structured params,
        // mirroring the server's AND composition.
        const matched = applyFilter(searched, filter);

        const start = (pageNum - 1) * pageSize;
        const items = matched.slice(start, start + pageSize);

        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                items,
                total: matched.length,
                page: pageNum,
                pageSize
            })
        });
    });
}
