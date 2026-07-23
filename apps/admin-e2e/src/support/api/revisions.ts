import { type Page, type Route } from '@playwright/test';

/** A revision's lifecycle state — mirrors the server's `REVISION_STATUS`. */
type RevStatus = 'draft' | 'published' | 'superseded';

/** One tracked revision in the mock's in-memory timeline. */
interface MockRevision {
    number: number;
    status: RevStatus;
    values: Record<string, unknown>;
    createdAt: string;
}

interface RevisionFlowOptions {
    /** Content type machine name (must be publishable in the schema seed). */
    name: string;
    /** The entry id the editor opens (`/content/:name/:id`). */
    id: string;
    /** The entry's field values (what the editor renders + edits). */
    values: Record<string, unknown>;
    /** Start already published (v1 = Live) vs. a plain draft. Defaults to published. */
    startPublished?: boolean;
}

/** Observable state the spec can assert on after driving the UI. */
export interface RevisionFlowState {
    /** How many times the admin hit `POST …/unpublish` (the regression signal). */
    readonly unpublishCalls: number;
}

/** Escape a path so it can be embedded verbatim in a `RegExp`. */
function rx(path: string): string {
    return path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * A **stateful** mock of one entry's write + revision lifecycle, faithful to the
 * real server semantics — so a spec can assert the *outcome* of an admin flow,
 * not just that an endpoint was hit. It tracks the entry's status, its field
 * values, and a revision timeline, and mutates them the way the API does:
 *
 * - **PATCH** (save) appends a **draft** revision and moves the entry to draft —
 *   but leaves the currently-published revision **published** (the save never
 *   demotes a live version).
 * - **POST …/publish** promotes the latest revision to `published` and supersedes
 *   any prior published one.
 * - **POST …/unpublish** reverts the published revision to `draft`.
 * - **GET …/revisions** serves the live timeline; **GET …/:id** the record.
 *
 * The regression this exists for: saving a draft over a published entry must NOT
 * unpublish its live version. With the buggy flow the admin fired `unpublish` on
 * a draft-save, which here would demote the published revision — so a spec that
 * saves a draft and then asserts the "Live" badge survives will fail on the bug
 * and pass on the fix. `unpublishCalls` is exposed as a second, direct signal.
 */
export async function mockEntryRevisionFlow(
    page: Page,
    opts: RevisionFlowOptions
): Promise<RevisionFlowState> {
    const at = '2026-01-01T00:00:00.000Z';
    const startPublished = opts.startPublished !== false;
    let entryStatus: 'draft' | 'published' = startPublished
        ? 'published'
        : 'draft';
    let values: Record<string, unknown> = { ...opts.values };
    const revisions: MockRevision[] = [
        {
            number: 1,
            status: startPublished ? 'published' : 'draft',
            values: { ...opts.values },
            createdAt: at
        }
    ];
    let unpublishCalls = 0;

    const latest = () => revisions[revisions.length - 1];

    const record = () => ({
        id: opts.id,
        status: entryStatus,
        createdAt: at,
        updatedAt: at,
        values
    });

    const listBody = () => {
        const latestNumber = latest().number;
        return {
            items: [...revisions].reverse().map((rev) => ({
                id: `${opts.id}-rev-${rev.number}`,
                number: rev.number,
                status: rev.status,
                isPublished: rev.status === 'published',
                isLatest: rev.number === latestNumber,
                createdAt: rev.createdAt
            })),
            total: revisions.length
        };
    };

    const revByNumber = (n: number) => revisions.find((r) => r.number === n);

    const appendDraft = (newValues: Record<string, unknown>) => {
        values = { ...newValues };
        entryStatus = 'draft';
        revisions.push({
            number: latest().number + 1,
            status: 'draft',
            values: { ...newValues },
            createdAt: at
        });
    };

    const publishLatest = () => {
        for (const rev of revisions) {
            if (rev.status === 'published') rev.status = 'superseded';
        }
        latest().status = 'published';
        values = { ...latest().values };
        entryStatus = 'published';
    };

    const json = (route: Route, body: unknown, status = 200) =>
        route.fulfill({
            status,
            contentType: 'application/json',
            body: JSON.stringify(body)
        });

    const base = `/api/content/${opts.name}/${opts.id}`;

    // Deepest routes first isn't required (the patterns are mutually exclusive by
    // structure), but registering them here keeps each concern in one place.

    // POST …/revisions/:number/(publish|restore)
    await page.route(
        new RegExp(`${rx(base)}/revisions/(\\d+)/(publish|restore)(\\?.*)?$`),
        async (route) => {
            const m = new URL(route.request().url()).pathname.match(
                /revisions\/(\d+)\/(publish|restore)$/
            );
            const number = Number(m?.[1] ?? 0);
            const action = m?.[2];
            const target = revByNumber(number);
            if (!target) return json(route, { message: 'Not found' }, 404);
            if (action === 'restore') {
                appendDraft(target.values);
            } else {
                // publish this version: bring its content forward as the latest,
                // then publish that latest (append-only, like the server).
                if (number !== latest().number) appendDraft(target.values);
                publishLatest();
            }
            return json(route, record(), 201);
        }
    );

    // GET …/revisions/:number (detail, for the preview)
    await page.route(
        new RegExp(`${rx(base)}/revisions/(\\d+)(\\?.*)?$`),
        async (route) => {
            const number = Number(
                new URL(route.request().url()).pathname.match(
                    /revisions\/(\d+)$/
                )?.[1] ?? 0
            );
            const rev = revByNumber(number);
            if (!rev) return json(route, { message: 'Not found' }, 404);
            const latestNumber = latest().number;
            return json(route, {
                id: `${opts.id}-rev-${rev.number}`,
                number: rev.number,
                status: rev.status,
                isPublished: rev.status === 'published',
                isLatest: rev.number === latestNumber,
                createdAt: rev.createdAt,
                snapshot: { values: rev.values, relations: {} },
                relationRefs: {},
                relationTotals: {}
            });
        }
    );

    // GET …/revisions (timeline)
    await page.route(
        new RegExp(`${rx(base)}/revisions(\\?.*)?$`),
        async (route) => json(route, listBody())
    );

    // POST …/(publish|unpublish)
    await page.route(
        new RegExp(`${rx(base)}/(publish|unpublish)(\\?.*)?$`),
        async (route) => {
            const action = new URL(route.request().url()).pathname.endsWith(
                '/publish'
            )
                ? 'publish'
                : 'unpublish';
            if (action === 'publish') {
                publishLatest();
            } else {
                unpublishCalls += 1;
                for (const rev of revisions) {
                    if (rev.status === 'published') rev.status = 'draft';
                }
                entryStatus = 'draft';
            }
            return json(route, record(), 201);
        }
    );

    // GET (read-one) / PATCH (save) on the exact entry path.
    await page.route(new RegExp(`${rx(base)}(\\?.*)?$`), async (route) => {
        const req = route.request();
        if (req.method() === 'PATCH') {
            const body = (req.postDataJSON?.() ?? {}) as {
                values?: Record<string, unknown>;
            };
            appendDraft(body.values ?? values);
            return json(route, record());
        }
        return json(route, record());
    });

    return {
        get unpublishCalls() {
            return unpublishCalls;
        }
    };
}
