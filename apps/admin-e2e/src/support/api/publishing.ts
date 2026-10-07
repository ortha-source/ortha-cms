import { type Page } from '@playwright/test';

/** One entry's approval status, as `GET …/protection/entries/:type/status` answers. */
export type ReviewStatusSeed = {
    protected: boolean;
    required: number;
    given: number;
    stale: number;
    requested: boolean;
    blocked: boolean;
};

/**
 * Stub the approval-status read the Publish Manager's protection notes come
 * from. Without it the request falls through to the dev server's dead proxy
 * and the page reports, correctly, that approval status could not load.
 * Entries absent from `byEntry` carry no note (an unprotected type).
 */
export async function mockReviewStatus(
    page: Page,
    byEntry: Record<string, ReviewStatusSeed> = {}
): Promise<void> {
    await page.route(
        /\/api\/protection\/entries\/[^/]+\/status(\?.*)?$/,
        async (route) => {
            const ids = (
                new URL(route.request().url()).searchParams.get('ids') ?? ''
            ).split(',');
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    byEntry: Object.fromEntries(
                        ids
                            .filter((id) => byEntry[id])
                            .map((id) => [id, byEntry[id]])
                    )
                })
            });
        }
    );
}
