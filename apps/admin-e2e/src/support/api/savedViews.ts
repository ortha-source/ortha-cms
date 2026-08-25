import { type Page } from '@playwright/test';

/** One saved view as `GET /api/views` returns it. */
export interface SavedViewSeed {
    id: string;
    scope: string;
    name: string;
    visibility: 'private' | 'workspace';
    ownerId: string;
    isOwn: boolean;
    isDefault: boolean;
    payload: {
        filter?: string;
        sort?: string;
        pageSize?: number;
        columns?: string[];
        extra?: Record<string, string>;
    };
    updatedAt: string;
}

/** A view over `article`, filtered to one status and pinned to two columns. */
export const NEEDS_REVIEW_VIEW: SavedViewSeed = {
    id: '11111111-1111-4111-8111-111111111111',
    scope: 'content:article',
    name: 'Needs review',
    visibility: 'private',
    ownerId: 'user-1',
    isOwn: true,
    isDefault: false,
    payload: {
        filter: JSON.stringify({
            op: 'and',
            rules: [{ field: 'text', op: 'contains', value: 'draft' }]
        }),
        sort: '-updatedAt',
        pageSize: 10,
        columns: ['text', 'select']
    },
    updatedAt: '2026-08-01T10:00:00.000Z'
};

/** A workspace-shared view somebody else owns — `isOwn: false`. */
export const SHARED_VIEW: SavedViewSeed = {
    id: '22222222-2222-4222-8222-222222222222',
    scope: 'content:article',
    name: 'Editorial backlog',
    visibility: 'workspace',
    ownerId: 'user-2',
    isOwn: false,
    isDefault: false,
    payload: { pageSize: 10, columns: ['text'] },
    updatedAt: '2026-08-02T10:00:00.000Z'
};

/**
 * Stub `GET /api/views` — the saved-view switcher's whole world.
 *
 * Defaults to **none**, which is what a fresh install looks like and what every
 * records suite that does not care about views should see: an empty list settles
 * the query, and the switcher collapses to its "save the first one" affordance
 * instead of a menu.
 */
export async function mockSavedViews(
    page: Page,
    views: SavedViewSeed[] = []
): Promise<void> {
    await page.route('**/api/views?*', async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(views)
        });
    });
}

/** Fails `GET /api/views`, so the header must render without the switcher. */
export async function mockSavedViewsError(page: Page): Promise<void> {
    await page.route('**/api/views?*', async (route) => {
        await route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ statusCode: 500, message: 'Boom' })
        });
    });
}

/**
 * Records every `POST /api/views` and answers with the created view.
 *
 * Returns a live counter plus the last body, so a spec can assert both that the
 * dialog submitted and **what** it captured — which is the only way to pin that
 * the search box and the page number stay out of a payload.
 */
export function spySaveView(page: Page): {
    count: number;
    lastBody: Record<string, unknown> | null;
} {
    const spy = { count: 0, lastBody: null as Record<string, unknown> | null };
    void page.route('**/api/views', async (route) => {
        if (route.request().method() !== 'POST') {
            await route.fallback();
            return;
        }
        spy.count += 1;
        spy.lastBody = route.request().postDataJSON() as Record<
            string,
            unknown
        >;
        await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({
                ...NEEDS_REVIEW_VIEW,
                id: '33333333-3333-4333-8333-333333333333',
                name: String(spy.lastBody?.name ?? 'Saved'),
                payload: spy.lastBody?.payload ?? {}
            })
        });
    });
    return spy;
}
