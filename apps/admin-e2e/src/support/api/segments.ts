import { type Page } from '@playwright/test';

/** JSON response helper, mirroring the other mock modules. */
const json = (body: unknown) => ({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(body)
});

/** One audience as `GET /api/segments` returns it. */
export interface SegmentSeed {
    id: string;
    key: string;
    label: string;
    tags: string[];
    workspaceIds: string[];
    usageCount: number;
}

/** One entry's two lists, as `GET /api/segments/entries/:id` returns them. */
export interface EntryAccessSeed {
    allow: string[];
    deny: string[];
}

/** The default vocabulary: three audiences, so a page of two has a second page. */
export const SEGMENT_SEED: SegmentSeed[] = [
    {
        id: 'seg-acme',
        key: 'acme',
        label: 'Acme Corp',
        tags: ['acme', 'acme-legacy'],
        workspaceIds: [],
        usageCount: 3
    },
    {
        id: 'seg-globex',
        key: 'globex',
        label: 'Globex',
        tags: ['globex'],
        workspaceIds: [],
        usageCount: 0
    },
    {
        id: 'seg-initech',
        key: 'initech',
        label: 'Initech',
        tags: ['initech'],
        workspaceIds: [],
        usageCount: 1
    }
];

/**
 * A vocabulary **larger than one page of the Access tab**, which paginates at
 * `DEFAULT_PAGE_SIZE = 10`.
 *
 * This exists for one assertion: "every match" and "this page" have to be
 * different sets, or a bulk action folded over the rendered rows is
 * indistinguishable from one folded over the matched ids. Fourteen leaves four
 * audiences that the browser never draws, so their ids can only reach the save
 * body by way of the list response.
 *
 * Labels are zero-padded so `Audience 01` is a `getByRole` name that cannot
 * also match `Audience 11`.
 */
export const PAGED_SEGMENT_SEED: SegmentSeed[] = Array.from(
    { length: 14 },
    (_unused, index) => {
        const n = String(index + 1).padStart(2, '0');
        return {
            id: `seg-${n}`,
            key: `audience-${n}`,
            label: `Audience ${n}`,
            tags: [`audience-${n}`],
            workspaceIds: [],
            usageCount: 0
        };
    }
);

/** What the directory and the Access tab were asked for, and what they wrote. */
export interface SegmentsApiSpy {
    /** Bodies of every `POST /api/segments`. */
    readonly created: Record<string, unknown>[];
    /** `[id, body]` of every `PATCH /api/segments/:id`. */
    readonly updated: [string, Record<string, unknown>][];
    /** Ids of every `DELETE /api/segments/:id`. */
    readonly deleted: string[];
    /** The `workspace` query param each list read carried, in order. */
    readonly listedWorkspaces: (string | null)[];
}

/**
 * Stub the segments API — the audience directory, the by-id lookup, one
 * segment, and one entry's access.
 *
 * **The list is genuinely paged here**, rather than answering the whole seed to
 * every request. The pager and the "set every audience" control are the two
 * things this feature got wrong most easily, and both are only testable against
 * a server that actually respects `page` / `pageSize` — a mock that returns
 * everything makes a broken pager look fine.
 *
 * `ids` carries **every** match, not the page's, exactly as the server does:
 * that is what the bulk control acts on, so a mock that scoped it to the page
 * would let a bulk action that only ever set the visible rows pass.
 */
export async function mockSegmentsApi(
    page: Page,
    options: {
        segments?: SegmentSeed[];
        /** One entry's stored access, keyed by entry id. Absent = unrestricted. */
        access?: Record<string, EntryAccessSeed>;
        /** Fail the directory read, for the error state. */
        listStatus?: number;
        /** Fail a create with this status — 409 drives the taken-key message. */
        createStatus?: number;
        /**
         * The server's `MATCHED_IDS_CAP`, in miniature. `ids` is cut to this
         * many and `idsTruncated` says so, exactly as the real service does at
         * 200 — which is how the bulk controls learn that the matched set is
         * larger than an entry may name, and disable themselves.
         */
        matchedIdsCap?: number;
        /**
         * Hold the directory read open this long, so a spec can observe the
         * loading state. Without it the mock answers in the same tick and the
         * skeleton is never on screen to assert against.
         */
        listDelayMs?: number;
    } = {}
): Promise<SegmentsApiSpy> {
    const all = options.segments ?? SEGMENT_SEED;
    const access = options.access ?? {};
    const spy: SegmentsApiSpy = {
        created: [],
        updated: [],
        deleted: [],
        listedWorkspaces: []
    };

    // One entry's access. Registered FIRST but matched by the more specific
    // pattern — Playwright tries the most recent registration first, so the
    // broad `/segments*` route below would otherwise swallow it.
    await page.route(/\/api\/segments\/entries\/[^/?]+/, async (route) => {
        const id = decodeURIComponent(
            new URL(route.request().url()).pathname.split('/').pop() ?? ''
        );
        if (route.request().method() === 'PUT') {
            return route.fulfill(
                json(
                    route.request().postDataJSON?.() ?? { allow: [], deny: [] }
                )
            );
        }
        await route.fulfill(json(access[id] ?? { allow: [], deny: [] }));
    });

    // Resolve by id, for the header chip and a revision's captured access.
    await page.route(/\/api\/segments\/lookup(\?.*)?$/, async (route) => {
        const raw =
            new URL(route.request().url()).searchParams.get('ids') ?? '';
        const wanted = new Set(raw.split(',').filter(Boolean));
        await route.fulfill(
            json(all.filter((segment) => wanted.has(segment.id)))
        );
    });

    // The directory list, and create.
    await page.route(/\/api\/segments(\?.*)?$/, async (route) => {
        const request = route.request();
        if (request.method() === 'POST') {
            const body = (request.postDataJSON?.() ?? {}) as Record<
                string,
                unknown
            >;
            spy.created.push(body);
            if (options.createStatus) {
                return route.fulfill({
                    status: options.createStatus,
                    contentType: 'application/json',
                    body: JSON.stringify({ message: 'Taken' })
                });
            }
            return route.fulfill({
                status: 201,
                contentType: 'application/json',
                body: JSON.stringify({
                    id: 'seg-new',
                    key: body['key'] ?? 'new',
                    label: body['label'] ?? 'New',
                    tags: body['tags'] ?? [body['key']],
                    workspaceIds: body['workspaceIds'] ?? [],
                    usageCount: 0
                })
            });
        }
        if (options.listStatus) {
            return route.fulfill({
                status: options.listStatus,
                contentType: 'application/json',
                body: JSON.stringify({ message: 'Nope' })
            });
        }

        if (options.listDelayMs) {
            await new Promise((resolve) =>
                setTimeout(resolve, options.listDelayMs)
            );
        }
        const params = new URL(request.url()).searchParams;
        spy.listedWorkspaces.push(params.get('workspace'));
        const query = (params.get('q') ?? '').toLowerCase();
        const matched = query
            ? all.filter(
                  (segment) =>
                      segment.label.toLowerCase().includes(query) ||
                      segment.key.toLowerCase().includes(query)
              )
            : all;
        const pageNumber = Number(params.get('page') ?? 1);
        const pageSize = Number(params.get('pageSize') ?? 25);
        const start = (pageNumber - 1) * pageSize;
        const cap = options.matchedIdsCap ?? Number.POSITIVE_INFINITY;
        await route.fulfill(
            json({
                items: matched.slice(start, start + pageSize),
                total: matched.length,
                page: pageNumber,
                pageSize,
                // Every match, not the page's.
                ids: matched.slice(0, cap).map((segment) => segment.id),
                idsTruncated: matched.length > cap
            })
        );
    });

    // One segment, and its edit / delete. Last, so it is tried first and the
    // list route above never sees `/segments/<id>`.
    await page.route(/\/api\/segments\/[^/?]+$/, async (route) => {
        const request = route.request();
        const id = decodeURIComponent(
            new URL(request.url()).pathname.split('/').pop() ?? ''
        );
        if (id === 'lookup' || id === 'entries') return route.fallback();
        const found = all.find((segment) => segment.id === id);

        if (request.method() === 'DELETE') {
            spy.deleted.push(id);
            return route.fulfill({ status: 204, body: '' });
        }
        if (request.method() === 'PATCH') {
            const body = (request.postDataJSON?.() ?? {}) as Record<
                string,
                unknown
            >;
            spy.updated.push([id, body]);
            return route.fulfill(json({ ...found, ...body }));
        }
        if (!found) {
            return route.fulfill({
                status: 404,
                contentType: 'application/json',
                body: JSON.stringify({ message: 'Unknown segment.' })
            });
        }
        await route.fulfill(json(found));
    });

    return spy;
}
