import { type Page } from '@playwright/test';
import { test, expect } from '../support/fixtures';
import { mockSignedOut } from '../support/api/auth';
import { mockInvite } from '../support/api/invites';

/**
 * Reflow on the two auth screens — WCAG 2.1 **1.4.10 (Reflow, AA)**, which axe
 * cannot judge. At 320 CSS pixels (a 1280px viewport at 400% zoom, or a small
 * phone) the content must still be reachable without scrolling in two
 * directions.
 *
 * Both screens are a single centred `max-w-sm` column, which is structurally
 * the right shape; what is worth guarding is what the centring does when the
 * card is taller than the viewport — `min-h-svh` plus `justify-center` can push
 * the top of a card above the scroll origin, where nothing can reach it.
 */
const NARROW = { width: 320, height: 480 };

/**
 * Horizontal overflow of the document, in pixels — 0 when nothing spills.
 *
 * Typed inline through `globalThis`: this project's tsconfig ships no DOM lib
 * (the specs drive a browser, they do not compile against one), the same reason
 * `settings.spec.ts` reaches for the clipboard that way.
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

test.describe('reflow at 320px', () => {
    test.use({ viewport: NARROW });

    test('the sign-in card fits without sideways scrolling', async ({
        page,
        loginPage
    }) => {
        await mockSignedOut(page);
        await loginPage.goto();
        await expect(loginPage.heading).toBeVisible();

        expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
        // Reachable, not merely present. Scrolling *vertically* to reach a
        // control is fine under 1.4.10 — being unreachable in either direction
        // is not — so each one is scrolled to and then has to actually be on
        // screen, and the page must still not scroll sideways afterwards.
        await expect(loginPage.heading).toBeInViewport();
        for (const control of [loginPage.email, loginPage.submit]) {
            await control.scrollIntoViewIfNeeded();
            await expect(control).toBeInViewport();
        }
        expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    });

    test('the accept-invite card fits, long email and all', async ({
        page,
        acceptInvitePage
    }) => {
        // A long address is the realistic worst case for a fixed-width input on
        // a narrow screen.
        await mockInvite(page, {
            email: 'grace.brewster.murray.hopper@a-fairly-long-domain.example',
            name: 'Grace Brewster Murray Hopper'
        });
        await acceptInvitePage.goto();
        await expect(acceptInvitePage.heading).toBeVisible();

        expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
        await expect(acceptInvitePage.heading).toBeInViewport();
        for (const control of [
            acceptInvitePage.emailField(),
            acceptInvitePage.password,
            acceptInvitePage.submit
        ]) {
            await control.scrollIntoViewIfNeeded();
            await expect(control).toBeInViewport();
        }
        expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    });

    test('nothing is stranded above the scroll origin', async ({
        page,
        acceptInvitePage
    }) => {
        await mockInvite(page);
        await acceptInvitePage.goto();
        await expect(acceptInvitePage.heading).toBeVisible();

        // The centring layout is the risk: if the column is taller than the
        // viewport, its first child must still start at or below the top of the
        // scrollable area.
        const headingTop = await acceptInvitePage.heading.evaluate((node) => {
            const { scrollY } = globalThis as unknown as { scrollY: number };
            const { top } = (
                node as unknown as {
                    getBoundingClientRect(): { top: number };
                }
            ).getBoundingClientRect();
            return top + scrollY;
        });
        expect(headingTop).toBeGreaterThanOrEqual(0);
    });
});
