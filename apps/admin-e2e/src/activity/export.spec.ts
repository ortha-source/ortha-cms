import { test, expect } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import { mockActivity, spyActivityExport } from '../support/api/activity';
import { expectNoA11yViolations } from '../support/a11y';

/**
 * "Export CSV" — the current view of the log as a file. The export takes the
 * same search, range and filter the feed shows and **no paging**, downloads
 * what the server answers, and says so when the server capped the file.
 */
test.describe('Activity CSV export', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockActivity(page);
    });

    test('exports the current view, not the current page', async ({
        activityLogPage,
        page
    }) => {
        const exported = await spyActivityExport(page);
        const filter = encodeURIComponent(
            JSON.stringify({ field: 'kind', op: 'eq', value: 'user.suspended' })
        );
        await activityLogPage.gotoWith(`q=grace&filter=${filter}&page=1`);
        await expect(activityLogPage.table).toBeVisible();

        const download = page.waitForEvent('download');
        await activityLogPage.exportButton.click();
        expect((await download).suggestedFilename()).toBe(
            'activity-2026-10-24.csv'
        );

        await expect.poll(() => exported.count).toBe(1);
        const sent = exported.requests[0];
        expect(sent.get('q')).toBe('grace');
        expect(sent.get('filter')).toContain('user.suspended');
        // The default range travels with it — the export is what is on screen.
        expect(sent.get('from')).toBeTruthy();
        expect(sent.has('page')).toBe(false);
        expect(sent.has('pageSize')).toBe(false);

        await expect(activityLogPage.toast('Exported 2 events.')).toBeVisible();
    });

    test('says when the file is not the whole answer', async ({
        activityLogPage,
        page
    }) => {
        await spyActivityExport(page, { total: 12_345 });
        await activityLogPage.goto();
        await expect(activityLogPage.table).toBeVisible();
        await activityLogPage.exportButton.click();

        await expect(
            activityLogPage.toast(
                'Exported the newest 2 of 12,345 events. Narrow the range or the filters to export the rest.'
            )
        ).toBeVisible();
    });

    test('a failed export says so and downloads nothing', async ({
        activityLogPage,
        page
    }) => {
        await spyActivityExport(page, { status: 500 });
        let downloads = 0;
        page.on('download', () => {
            downloads += 1;
        });
        await activityLogPage.goto();
        await expect(activityLogPage.table).toBeVisible();
        await activityLogPage.exportButton.click();

        await expect(
            activityLogPage.toast('Couldn’t export the activity log.')
        ).toBeVisible();
        expect(downloads).toBe(0);
    });

    test('the button stays in the tab order while it works', async ({
        activityLogPage,
        page
    }) => {
        await spyActivityExport(page, { delayMs: 1_500 });
        await activityLogPage.goto();
        await expect(activityLogPage.table).toBeVisible();
        await activityLogPage.exportButton.focus();
        await page.keyboard.press('Enter');

        await expect(activityLogPage.exportButton).toHaveAttribute(
            'aria-disabled',
            'true'
        );
        await expect(activityLogPage.exportButton).toBeFocused();
    });

    test('is accessible beside the breadcrumb (axe)', async ({
        activityLogPage,
        makeAxe
    }) => {
        await activityLogPage.goto();
        await expect(activityLogPage.exportButton).toBeVisible();
        await expectNoA11yViolations(makeAxe());
    });
});
