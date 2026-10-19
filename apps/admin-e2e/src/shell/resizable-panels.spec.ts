import { test, expect } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import { mockActivity } from '../support/api/activity';
import { mockPreferences } from '../support/api/preferences';
import { expectNoA11yViolations } from '../support/a11y';

/**
 * The app sidebar's **resize handle** — the design system's `ResizeHandle`,
 * wired by `shell-admin` to the panel layout and synced by `users-admin` into
 * the user's preferences.
 *
 * The bounds below are the sidebar's (`SIDEBAR_PANEL` in the shell): 256px by
 * default, 208px at least, and at most 384px **or a quarter of the viewport**,
 * whichever is narrower. Playwright's default 1280px viewport makes that cap
 * 320px — so a test that drags to the maximum is also a test that the viewport
 * cap, not the absolute one, is what stopped it.
 *
 * Saves are debounced (600ms), so every assertion on what reached the server
 * polls rather than reads once.
 */

const DEFAULT_WIDTH = 256;
const MIN_WIDTH = 208;
/** `min(384, 0.25 × 1280)`. */
const MAX_WIDTH = 320;

test.describe('the resizable sidebar', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockActivity(page);
    });

    test('dragging its edge widens it, and the width is saved to the preferences', async ({
        page,
        activityLogPage,
        resizablePanels
    }) => {
        const prefs = await mockPreferences(page);
        await activityLogPage.goto();
        expect(
            await resizablePanels.widthOf(resizablePanels.sidebarPanel)
        ).toBe(DEFAULT_WIDTH);

        await resizablePanels.drag(resizablePanels.sidebarHandle, 40);

        expect(
            await resizablePanels.widthOf(resizablePanels.sidebarPanel)
        ).toBe(DEFAULT_WIDTH + 40);
        await expect(resizablePanels.sidebarHandle).toHaveAttribute(
            'aria-valuenow',
            String(DEFAULT_WIDTH + 40)
        );
        // Only the panel that changed is sent — the server merges per panel.
        await expect
            .poll(() => prefs.layoutPuts)
            .toEqual([{ 'shell.sidebar': { width: DEFAULT_WIDTH + 40 } }]);
    });

    test('stops at the viewport cap, however far it is dragged', async ({
        page,
        activityLogPage,
        resizablePanels
    }) => {
        await mockPreferences(page);
        await activityLogPage.goto();

        await resizablePanels.drag(resizablePanels.sidebarHandle, 600);

        expect(
            await resizablePanels.widthOf(resizablePanels.sidebarPanel)
        ).toBe(MAX_WIDTH);
        await expect(resizablePanels.sidebarHandle).toHaveAttribute(
            'aria-valuemax',
            String(MAX_WIDTH)
        );
    });

    test('dragged well past its minimum, it collapses — and remembers that [shell:I-34]', async ({
        page,
        activityLogPage,
        resizablePanels
    }) => {
        const prefs = await mockPreferences(page);
        await activityLogPage.goto();

        // 256 − 200 = 56px, under half the 208px minimum.
        await resizablePanels.drag(resizablePanels.sidebarHandle, -200);

        await expect
            .poll(() => resizablePanels.sidebarState())
            .toBe('collapsed');
        await expect
            .poll(() => prefs.layout)
            .toEqual({ 'shell.sidebar': { collapsed: true } });
    });

    test('a drag that stops short of the collapse point rests at the minimum [shell:I-34]', async ({
        page,
        activityLogPage,
        resizablePanels
    }) => {
        await mockPreferences(page);
        await activityLogPage.goto();

        // 256 − 100 = 156px: under the minimum, but over half of it.
        await resizablePanels.drag(resizablePanels.sidebarHandle, -100);

        expect(await resizablePanels.sidebarState()).toBe('expanded');
        expect(
            await resizablePanels.widthOf(resizablePanels.sidebarPanel)
        ).toBe(MIN_WIDTH);
    });

    test('is operable from the keyboard: arrows step, Home and End jump to the bounds', async ({
        page,
        activityLogPage,
        resizablePanels
    }) => {
        await mockPreferences(page);
        await activityLogPage.goto();
        const handle = resizablePanels.sidebarHandle;

        await handle.focus();
        await handle.press('ArrowRight');
        await expect(handle).toHaveAttribute(
            'aria-valuenow',
            String(DEFAULT_WIDTH + 16)
        );
        await handle.press('Shift+ArrowLeft');
        await expect(handle).toHaveAttribute(
            'aria-valuenow',
            String(DEFAULT_WIDTH + 16 - 64)
        );
        await handle.press('Home');
        await expect(handle).toHaveAttribute(
            'aria-valuenow',
            String(MIN_WIDTH)
        );
        await handle.press('End');
        await expect(handle).toHaveAttribute(
            'aria-valuenow',
            String(MAX_WIDTH)
        );
        // A key step eases over the panel's 300ms slide, unlike a drag, which
        // the panel follows with its transitions off — so poll the width.
        await expect
            .poll(() => resizablePanels.widthOf(resizablePanels.sidebarPanel))
            .toBe(MAX_WIDTH);
    });

    test('Enter collapses it from the keyboard and hands focus to a reveal control', async ({
        page,
        activityLogPage,
        resizablePanels
    }) => {
        await mockPreferences(page);
        await activityLogPage.goto();

        await resizablePanels.sidebarHandle.focus();
        await resizablePanels.sidebarHandle.press('Enter');

        await expect
            .poll(() => resizablePanels.sidebarState())
            .toBe('collapsed');
        // The handle went inert with the panel; focus must not fall to <body>.
        await expect(
            page.locator('[data-sidebar="trigger"]:focus')
        ).toHaveCount(1);
    });

    test('a width saved on another device is what this one opens at [shell:I-33]', async ({
        page,
        activityLogPage,
        resizablePanels
    }) => {
        await mockPreferences(page, {
            layout: { 'shell.sidebar': { width: 300 } }
        });
        await activityLogPage.goto();

        await expect
            .poll(() => resizablePanels.widthOf(resizablePanels.sidebarPanel))
            .toBe(300);
    });

    test('a width saved on a wider screen is narrowed here, not trusted [shell:I-36]', async ({
        page,
        activityLogPage,
        resizablePanels
    }) => {
        await mockPreferences(page, {
            layout: { 'shell.sidebar': { width: 384 } }
        });
        await activityLogPage.goto();

        await expect
            .poll(() => resizablePanels.widthOf(resizablePanels.sidebarPanel))
            .toBe(MAX_WIDTH);
    });

    test('the handle passes an axe scan while focused', async ({
        page,
        activityLogPage,
        resizablePanels,
        makeAxe
    }) => {
        await mockPreferences(page);
        await activityLogPage.goto();
        await resizablePanels.sidebarHandle.focus();

        await expectNoA11yViolations(makeAxe());
    });
});
