import { test, expect } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import { mockActivity } from '../support/api/activity';
import { expectNoA11yViolations } from '../support/a11y';

/**
 * The Activity Log query-builder filter drawer
 * (`@ortha-cms/query-builder-admin`): building a condition narrows the log, the
 * choice deep-links into the URL as `?filter=<json>`, and Reset clears it. The
 * `GET /api/activity` mock honours the `filter` param (AND-ed with the actor
 * search), mirroring the server.
 */
test.describe('Activity filter (query builder)', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockActivity(page);
    });

    test('opens the filter drawer from the toolbar', async ({
        activityLogPage
    }) => {
        await activityLogPage.goto();
        await expect(activityLogPage.heading).toBeVisible();

        await activityLogPage.openFilters();
        await expect(activityLogPage.filterDrawer()).toBeVisible();
    });

    test('filters the log by kind and deep-links the choice', async ({
        activityLogPage,
        page
    }) => {
        await activityLogPage.goto();
        await expect(
            activityLogPage.row('ada@ortha.dev').first()
        ).toBeVisible();

        // Default field is "Kind" with the "equals" operator → a text value.
        await activityLogPage.openFilters();
        await activityLogPage.addRule();
        await activityLogPage.fillValue('user.suspended');
        await activityLogPage.applyFilters();

        // Drawer closed; only the suspension event (actor grace) survives.
        await expect(activityLogPage.filterDrawer()).toHaveCount(0);
        await expect(
            activityLogPage.row('grace@ortha.dev').first()
        ).toBeVisible();
        await expect(activityLogPage.row('ada@ortha.dev')).toHaveCount(0);

        await expect(page).toHaveURL(/filter=/);
        const filterParam = new URL(page.url()).searchParams.get('filter');
        expect(filterParam).toContain('"kind"');
        expect(filterParam).toContain('user.suspended');
    });

    test('reflects the active condition count on the trigger', async ({
        activityLogPage
    }) => {
        await activityLogPage.goto();
        await activityLogPage.openFilters();
        await activityLogPage.addRule();
        await activityLogPage.fillValue('user.suspended');
        await activityLogPage.applyFilters();

        await expect(activityLogPage.filterTrigger()).toHaveText(
            /Filters \(1\)/
        );
    });

    test('restores the filter from a deep link on load', async ({
        activityLogPage,
        page
    }) => {
        const filter = encodeURIComponent(
            JSON.stringify({ field: 'kind', op: 'eq', value: 'user.suspended' })
        );
        await page.goto(`/activity?filter=${filter}`);

        await expect(
            activityLogPage.row('grace@ortha.dev').first()
        ).toBeVisible();
        await expect(activityLogPage.row('ada@ortha.dev')).toHaveCount(0);
        await expect(activityLogPage.filterTrigger()).toHaveText(
            /Filters \(1\)/
        );
    });

    test('the open drawer with a rule is accessible (axe)', async ({
        activityLogPage,
        makeAxe
    }) => {
        await activityLogPage.goto();
        await activityLogPage.openFilters();
        await activityLogPage.addRule();
        await activityLogPage.selectField('Actor email');
        await expectNoA11yViolations(makeAxe());
    });

    test('Reset clears the filter and restores the full log', async ({
        activityLogPage,
        page
    }) => {
        const filter = encodeURIComponent(
            JSON.stringify({ field: 'kind', op: 'eq', value: 'user.suspended' })
        );
        await page.goto(`/activity?filter=${filter}`);
        await expect(
            activityLogPage.row('grace@ortha.dev').first()
        ).toBeVisible();

        await activityLogPage.openFilters();
        await activityLogPage.resetFilters();

        await expect(activityLogPage.filterDrawer()).toHaveCount(0);
        await expect(
            activityLogPage.row('ada@ortha.dev').first()
        ).toBeVisible();
        await expect(page).not.toHaveURL(/filter=/);
    });
});
