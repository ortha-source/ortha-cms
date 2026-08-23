import { expect, test } from '@playwright/test';

/**
 * The deployment shape, end to end.
 *
 * These assert the things that are only true of the **built** app served by one
 * process — an admin bundle and an API on a single origin — and that a
 * dev-server run would never exercise. Everything about *what the CMS does*
 * belongs in unit tests or in suites you add per feature; this is the check
 * that the thing boots and is wired together at all.
 */
test.describe('a built app on one origin', () => {
    test('serves the admin and lands an anonymous visitor on sign-in', async ({
        page
    }) => {
        await page.goto('/');

        await expect(
            page.getByRole('textbox', { name: /email/i })
        ).toBeVisible();
    });

    test('serves a deep client-side route on a hard refresh', async ({
        page
    }) => {
        // The SPA fallback. Without it this 404s, and only ever on a refresh —
        // never while clicking around, which is how it reaches production.
        await page.goto('/workspaces');

        await expect(page.locator('#root')).not.toBeEmpty();
    });

    test('requires a session for the API', async ({ request }) => {
        const response = await request.get('/api/workspaces');

        expect(response.status()).toBe(401);
    });

    /**
     * The SPA fallback must not answer for the API. Applied indiscriminately it
     * turns every mistyped endpoint into `200` and a page of HTML, so clients
     * see a success and a JSON parse error with nothing saying the route is
     * gone.
     */
    test('answers an unknown API path with JSON, not the app shell', async ({
        request
    }) => {
        const response = await request.get('/api/not-a-real-endpoint');

        expect(response.status()).toBe(404);
        expect(response.headers()['content-type']).toContain('application/json');
    });

    test('404s a missing asset instead of returning the page', async ({
        request
    }) => {
        // A stale `index.html` referencing a deleted hashed chunk reads as a
        // bundler bug rather than the bad deploy it is.
        const response = await request.get('/assets/does-not-exist.js');

        expect(response.status()).toBe(404);
    });
});
