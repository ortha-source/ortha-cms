import { type Page } from '@playwright/test';

/** One item as `GET /api/inbox` returns it. */
export type InboxItemSeed = {
    id: string;
    kind: string;
    category?: 'reviews' | 'alarms' | 'updates';
    workspaceId?: string | null;
    payload?: Record<string, unknown>;
    link?: string;
    createdAt?: string;
    readAt?: string | null;
};

/** What the mock recorded the page asking for. */
export type InboxRecorder = {
    /** Ids passed to `POST /api/inbox/:id/read`. */
    read: string[];
    /** Bodies of `POST /api/inbox/read`. */
    readAll: unknown[];
};

const CATEGORY_OF: Record<string, 'reviews' | 'alarms' | 'updates'> = {
    'review.requested': 'reviews',
    'review.approval_stale': 'reviews',
    'review.ready': 'updates',
    'alarm.flagged': 'alarms'
};

/**
 * Serves the inbox — its pages, its unread summary and the two read routes —
 * from one mutable seed, so marking an item read is visible to the next read
 * exactly as it would be against the server.
 */
export async function mockInbox(
    page: Page,
    seed: InboxItemSeed[] = [],
    options: { status?: number } = {}
): Promise<InboxRecorder> {
    const recorder: InboxRecorder = { read: [], readAll: [] };
    const items = seed.map((item) => ({
        category: CATEGORY_OF[item.kind] ?? 'updates',
        workspaceId: 'ws_lib',
        payload: {},
        link: 'workspaces/ws_lib/reviews',
        createdAt: new Date().toISOString(),
        readAt: null,
        ...item
    }));
    const failed = options.status && options.status >= 400;

    await page.route('**/api/inbox*', async (route) => {
        if (failed) {
            await route.fulfill({ status: options.status, body: '{}' });
            return;
        }
        const url = new URL(route.request().url());
        const category = url.searchParams.get('category');
        const unread = url.searchParams.get('unread') === '1';
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                items: items.filter(
                    (item) =>
                        (!category || item.category === category) &&
                        (!unread || item.readAt === null)
                ),
                nextCursor: null
            })
        });
    });

    await page.route('**/api/inbox/summary*', async (route) => {
        if (failed) {
            await route.fulfill({ status: options.status, body: '{}' });
            return;
        }
        const unread = items.filter((item) => item.readAt === null);
        const byCategory = { reviews: 0, alarms: 0, updates: 0 };
        for (const item of unread) byCategory[item.category] += 1;
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ unread: unread.length, byCategory })
        });
    });

    await page.route('**/api/inbox/*/read', async (route) => {
        const id =
            new URL(route.request().url()).pathname.split('/').at(-2) ?? '';
        recorder.read.push(id);
        const item = items.find((candidate) => candidate.id === id);
        if (item) item.readAt = new Date().toISOString();
        await route.fulfill({ status: 204, body: '' });
    });

    await page.route('**/api/inbox/read', async (route) => {
        const body = route.request().postDataJSON() as { category?: string };
        recorder.readAll.push(body);
        let marked = 0;
        for (const item of items) {
            if (
                item.readAt === null &&
                (!body?.category || item.category === body.category)
            ) {
                item.readAt = new Date().toISOString();
                marked += 1;
            }
        }
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ marked })
        });
    });

    return recorder;
}
