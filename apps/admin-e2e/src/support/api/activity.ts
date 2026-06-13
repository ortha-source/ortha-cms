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

/** Reads the filter/paging params the page sends from the intercepted URL. */
function paramsOf(route: Route): {
    kinds: string[];
    actorEmail: string;
    from: string;
    to: string;
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
        from: url.searchParams.get('from') ?? '',
        to: url.searchParams.get('to') ?? '',
        page: Number(url.searchParams.get('page') ?? '1'),
        pageSize: Number(url.searchParams.get('pageSize') ?? '25')
    };
}

/**
 * Stub `GET /api/activity` with a deterministic log, applying the same
 * filtering + pagination the server does (kind IN, actor-email substring,
 * date range, offset paging) so the page's controls behave for real. The page
 * sits behind the shell's gate, so a test also needs `mockSignedIn`.
 *
 * Registered per-`page`, so it resets between tests with the browser context.
 */
export async function mockActivity(
    page: Page,
    events: ActivitySeed[] = DEFAULT_ACTIVITY
): Promise<void> {
    await page.route('**/api/activity?*', async (route) => {
        if (route.request().method() !== 'GET') {
            await route.fallback();
            return;
        }
        const { kinds, actorEmail, from, to, page: pageNum, pageSize } =
            paramsOf(route);

        const matched = events.filter((event) => {
            if (kinds.length > 0 && !kinds.includes(event.kind)) {
                return false;
            }
            if (
                actorEmail &&
                !(event.actorEmail ?? '').toLowerCase().includes(actorEmail)
            ) {
                return false;
            }
            if (from && event.at < from) {
                return false;
            }
            if (to && event.at.slice(0, 10) > to) {
                return false;
            }
            return true;
        });

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
