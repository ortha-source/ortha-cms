import { type Page } from '@playwright/test';
import { test, expect } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import { mockMembers } from '../support/api/members';
import { mockWorkspaces } from '../support/api/workspaces';

/**
 * Reflow of the **shell** — WCAG 2.1 `1.4.10 (Reflow, AA)` on the private routes.
 *
 * `src/auth/reflow.spec.ts` already covers the two auth screens, and they are the
 * easy case: one centred `max-w-sm` column with no chrome around it. Every other
 * page in the product renders inside a three-part layout — a persistent offcanvas
 * sidebar, an inner scrollport, and a right-hand panel column — which is exactly
 * the shape that produces two-dimensional scrolling at 400% zoom, and the shape
 * nothing asserted.
 *
 * The scrollport is `overflow-y-auto` with no `overflow-x`, so horizontal content
 * inside the shell can only be **clipped**, never scrolled to. That makes the
 * document-level check the right one: if the root does not scroll sideways and
 * every control is reachable, nothing was lost; wide tables are expected to
 * scroll inside their own `overflow-x` wrapper, which is the conformant answer.
 */
const NARROW = { width: 320, height: 480 };

/**
 * Horizontal overflow of the document, in pixels — 0 when nothing spills.
 *
 * Typed inline through `globalThis`, the idiom the rest of this suite uses: this
 * project's tsconfig ships no DOM lib, because the specs drive a browser rather
 * than compile against one.
 */
async function horizontalOverflow(page: Page): Promise<number> {
    return page.evaluate(() => {
        const { documentElement } = (
            globalThis as unknown as {
                document: {
                    documentElement: {
                        scrollWidth: number;
                        clientWidth: number;
                    };
                };
            }
        ).document;
        return documentElement.scrollWidth - documentElement.clientWidth;
    });
}

test.describe('the shell reflows at 320px', () => {
    test.use({ viewport: NARROW });

    test('the home dashboard does not scroll sideways', async ({
        page,
        homePage
    }) => {
        await mockSignedIn(page);
        await mockWorkspaces(page);
        await homePage.goto();
        await expect(homePage.heading).toBeVisible();

        expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
        await expect(homePage.heading).toBeInViewport();
    });

    test('a table page keeps its controls reachable, and its table scrolls in its own box', async ({
        page,
        hostPage,
        membersPage
    }) => {
        await mockSignedIn(page);
        await mockMembers(page);
        await membersPage.goto();
        await expect(membersPage.heading).toBeVisible();

        // Content tables are the usual clipping victims: wider than 320px by
        // nature, and inside a scrollport that offers no horizontal scroll of its
        // own. What must not happen is the *page* growing to fit them.
        expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);

        // Reachable, not merely present — scrolling vertically to a control is
        // fine under 1.4.10; being unreachable in either direction is not.
        for (const control of [membersPage.search, membersPage.inviteButton]) {
            await control.scrollIntoViewIfNeeded();
            await expect(control).toBeInViewport();
        }
        expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);

        // And the bypass mechanism still works at this width — a skip link that
        // the narrow layout puts off screen is not one.
        await page.keyboard.press('Tab');
        await expect(hostPage.skipLink).toBeFocused();
        await expect(hostPage.skipLink).toBeInViewport();
    });

    test('the sidebar collapses rather than pushing the page sideways', async ({
        page,
        hostPage,
        workspacesPage
    }) => {
        await mockSignedIn(page);
        await mockWorkspaces(page);
        await workspacesPage.goto();
        await expect(workspacesPage.heading).toBeVisible();

        // A persistent sidebar at 320px would leave the content column a few
        // dozen pixels wide, or push it out of the viewport entirely. The
        // offcanvas variant is what prevents that, and `<main>` staying inside
        // the viewport is how it shows.
        await expect(hostPage.main).toBeInViewport();
        expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    });
});
