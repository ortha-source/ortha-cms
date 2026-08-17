import { type Locator, type Page } from '@playwright/test';
import { test, expect } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import { mockMembers } from '../support/api/members';
import { mockWorkspaces } from '../support/api/workspaces';

/**
 * The two platform preferences nothing in this suite had ever emulated —
 * WCAG `1.4.3 (Contrast)`, `1.4.11 (Non-text Contrast)`, `2.4.7 (Focus
 * Visible)` and Section 508 `§503.2 (User Preferences)`.
 *
 * Every `a11y.spec.ts` in the project scans in the browser default, which is
 * light, so the dark palette had never been scanned at all. The one real
 * contrast failure this suite has ever caught (`muted-foreground`) was in the
 * light half; there was no reason to believe the other was clean, only no
 * measurement either way.
 *
 * Forced colors is the sharper of the two. In `forced-colors: active` the UA
 * discards `box-shadow` outright, and every focus indicator in the design
 * system is a Tailwind `ring-*` — which *is* a box-shadow. A Windows High
 * Contrast user therefore had no visible focus indicator anywhere in the admin.
 * axe cannot see this: it never emulates the media feature, so a clean scan
 * says nothing about it. These assertions read computed style instead.
 *
 * **Harness note.** `test.use({ forcedColors: 'active' })` is silently
 * ineffective here — the media query still reports `false` inside the page,
 * while `test.use({ colorScheme })` works normally. `page.emulateMedia()` does
 * take, so that is what forced colors uses below, the same way
 * `auth/reduced-motion.spec.ts` reaches for it. A spec that sets forced colors
 * the declarative way will pass while testing nothing.
 */

/** The resolved focus-indicator properties of one element. */
async function indicatorOf(locator: Locator): Promise<{
    outlineStyle: string;
    outlineWidth: string;
    boxShadow: string;
}> {
    return locator.evaluate((node) => {
        const style = (
            globalThis as unknown as {
                getComputedStyle: (el: unknown) => {
                    outlineStyle: string;
                    outlineWidth: string;
                    boxShadow: string;
                };
            }
        ).getComputedStyle(node);
        return {
            outlineStyle: style.outlineStyle,
            outlineWidth: style.outlineWidth,
            boxShadow: style.boxShadow
        };
    });
}

/** Whether one element currently holds focus. */
function isFocused(locator: Locator): Promise<boolean> {
    return locator.evaluate(
        (node) =>
            node ===
            (
                node as unknown as {
                    ownerDocument: { activeElement: unknown };
                }
            ).ownerDocument.activeElement
    );
}

/** Tabs until `target` holds focus, or gives up after `limit` presses. */
async function tabTo(page: Page, target: Locator, limit = 40): Promise<boolean> {
    for (let i = 0; i < limit; i++) {
        await page.keyboard.press('Tab');
        if (await isFocused(target)) {
            return true;
        }
    }
    return false;
}

test.describe('forced colors', () => {
    test('a button keeps a visible focus indicator', async ({
        page,
        membersPage
    }) => {
        await page.emulateMedia({ forcedColors: 'active' });
        await mockSignedIn(page);
        await mockMembers(page);
        await membersPage.goto();
        await expect(membersPage.heading).toBeVisible();
        expect(
            await page.evaluate(() =>
                (
                    globalThis as unknown as {
                        matchMedia: (q: string) => { matches: boolean };
                    }
                ).matchMedia('(forced-colors: active)').matches
            )
        ).toBe(true);

        await membersPage.inviteButton.focus();
        const indicator = await indicatorOf(membersPage.inviteButton);

        // The premise, asserted so the outline check below cannot pass for the
        // wrong reason: the ring this button declares really is gone.
        expect(indicator.boxShadow).toBe('none');

        // Which leaves the outline as the only indicator. `Button` also carries
        // `focus-visible:outline-none`, a class+pseudo that outranks a bare
        // `:focus-visible` — the reason the forced-colors rule is `!important`.
        expect(indicator.outlineStyle).not.toBe('none');
        expect(parseFloat(indicator.outlineWidth)).toBeGreaterThanOrEqual(1);
    });

    test('the app scrollport keeps a visible focus indicator', async ({
        page,
        hostPage,
        workspacesPage
    }) => {
        await page.emulateMedia({ forcedColors: 'active' });
        await mockSignedIn(page);
        await mockWorkspaces(page);
        await workspacesPage.goto();
        await expect(workspacesPage.heading).toBeVisible();

        // The scrollport is a deliberate tab stop with nothing else to see it
        // by — the worst place to lose an indicator, and the reason the inset
        // offset exists (an outset one is drawn outside `<main>`'s clip).
        expect(await tabTo(page, hostPage.insetScroll)).toBe(true);
        const indicator = await indicatorOf(hostPage.insetScroll);

        expect(indicator.outlineStyle).not.toBe('none');
        expect(parseFloat(indicator.outlineWidth)).toBeGreaterThanOrEqual(1);
    });

    test('nothing opts out of the user palette', async ({
        page,
        membersPage
    }) => {
        await page.emulateMedia({ forcedColors: 'active' });
        await mockSignedIn(page);
        await mockMembers(page);
        await membersPage.goto();
        await expect(membersPage.heading).toBeVisible();

        // `forced-color-adjust: none` is how a component overrides the palette
        // the user chose. Nothing in the product may — that is the failure the
        // preference exists to prevent, and it is worth an assertion because
        // the property is a tempting one-line "fix" for a flattened design.
        const optedOut = await page.evaluate(() => {
            const scope = globalThis as unknown as {
                document: {
                    querySelectorAll: (s: string) => ArrayLike<unknown>;
                };
                getComputedStyle: (el: unknown) => {
                    forcedColorAdjust?: string;
                };
            };
            return Array.from(scope.document.querySelectorAll('*')).filter(
                (node) => scope.getComputedStyle(node).forcedColorAdjust === 'none'
            ).length;
        });

        expect(optedOut).toBe(0);
        await expect(membersPage.inviteButton).toBeEnabled();
    });
});

test.describe('dark theme', () => {
    test.use({ colorScheme: 'dark' });

    test('the members table has no contrast failures in the dark palette', async ({
        page,
        membersPage,
        makeAxe
    }) => {
        await mockSignedIn(page);
        await mockMembers(page);
        await membersPage.goto();
        await expect(membersPage.heading).toBeVisible();

        // The theme preference defaults to `system`, so emulating the OS
        // scheme is what repaints the app — assert it took, or this would
        // silently be a second light-mode scan.
        await expect(page.locator('html')).toHaveClass(/dark/);

        const results = await makeAxe().analyze();
        expect(results.violations).toEqual([]);
    });

    test('the workspaces dashboard has no contrast failures in the dark palette', async ({
        page,
        workspacesPage,
        makeAxe
    }) => {
        await mockSignedIn(page);
        await mockWorkspaces(page);
        await workspacesPage.goto();
        await expect(workspacesPage.heading).toBeVisible();
        await expect(page.locator('html')).toHaveClass(/dark/);

        const results = await makeAxe().analyze();
        expect(results.violations).toEqual([]);
    });
});
