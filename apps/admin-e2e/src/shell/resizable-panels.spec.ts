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

    test('a drag released far from the edge is over — nothing keeps following the pointer [design-system:I-50]', async ({
        page,
        activityLogPage,
        resizablePanels
    }) => {
        await mockPreferences(page);
        await activityLogPage.goto();

        // Drag 30px, then sweep straight down — a vertical move does not
        // change the width — and let go well below, over the page's content.
        const box = await resizablePanels.sidebarHandle.boundingBox();
        if (!box) throw new Error('the handle has no box');
        const releaseX = box.x + box.width / 2 + 30;
        await resizablePanels.dragAndReleaseElsewhere(
            resizablePanels.sidebarHandle,
            30,
            { x: releaseX, y: 650 }
        );

        // The pointer then moved on 120px with the button up: the width
        // stayed, the resize cursor and the drag flag are gone, the line is
        // unlit.
        expect(
            await resizablePanels.widthOf(resizablePanels.sidebarPanel)
        ).toBe(DEFAULT_WIDTH + 30);
        expect(await resizablePanels.dragFlagged()).toBe(false);
        expect(await resizablePanels.cursorAt(releaseX + 150, 650)).not.toBe(
            'col-resize'
        );
        await expect(resizablePanels.sidebarHandle).not.toHaveAttribute(
            'data-dragging',
            /.*/
        );
    });

    test('Escape mid-drag puts the width back', async ({
        page,
        activityLogPage,
        resizablePanels
    }) => {
        await mockPreferences(page);
        await activityLogPage.goto();
        await resizablePanels.escapeMidDrag(resizablePanels.sidebarHandle, 60);

        // With the drag over the panel's slide is back on, so it eases home.
        await expect
            .poll(() => resizablePanels.widthOf(resizablePanels.sidebarPanel))
            .toBe(DEFAULT_WIDTH);
        expect(await resizablePanels.dragFlagged()).toBe(false);
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

    test('Enter collapses it from the keyboard', async ({
        page,
        activityLogPage,
        resizablePanels
    }) => {
        const prefs = await mockPreferences(page);
        await activityLogPage.goto();

        await resizablePanels.sidebarHandle.focus();
        await resizablePanels.sidebarHandle.press('Enter');

        await expect
            .poll(() => resizablePanels.sidebarState())
            .toBe('collapsed');
        await expect
            .poll(() => prefs.layout)
            .toEqual({ 'shell.sidebar': { collapsed: true } });
        // Where focus lands afterwards is `SidebarProvider`'s handoff, shared
        // with the header trigger and ⌘B — and on a page with a top bar it is
        // lost to <body> on `main` too, so it is not asserted here.
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
