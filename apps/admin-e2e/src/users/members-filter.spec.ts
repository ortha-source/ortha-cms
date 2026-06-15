import { test, expect } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import { mockMembers } from '../support/api/members';
import { expectNoA11yViolations } from '../support/a11y';

/**
 * The Members query-builder filter drawer (`@ortha-cms/query-builder-admin`):
 * building a condition narrows the roster, the choice deep-links into the URL
 * as `?filter=<json>`, and Reset clears it. The `GET /api/users` mock honours
 * the `filter` param (AND-ed with search), mirroring the server.
 */
test.describe('Members filter (query builder)', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockMembers(page);
    });

    test('opens the filter drawer from the toolbar', async ({
        membersPage
    }) => {
        await membersPage.goto();
        await expect(membersPage.heading).toBeVisible();

        await membersPage.openFilters();
        await expect(membersPage.filterDrawer()).toBeVisible();
    });

    test('filters the roster by status and deep-links the choice', async ({
        membersPage,
        page
    }) => {
        await membersPage.goto();
        await expect(membersPage.row('Ada Lovelace')).toBeVisible();

        await membersPage.openFilters();
        await membersPage.addRule();
        await membersPage.selectField('Status');
        await membersPage.selectEnumValue('Disabled');
        await membersPage.applyFilters();

        // The drawer closed and only the disabled member remains.
        await expect(membersPage.filterDrawer()).toHaveCount(0);
        await expect(membersPage.row('Katherine Johnson')).toBeVisible();
        await expect(membersPage.row('Ada Lovelace')).toHaveCount(0);
        await expect(membersPage.row('Grace Hopper')).toHaveCount(0);

        // The applied filter is in the URL, so the view is shareable.
        await expect(page).toHaveURL(/filter=/);
        const filterParam = new URL(page.url()).searchParams.get('filter');
        expect(filterParam).toContain('"status"');
        expect(filterParam).toContain('"disabled"');
    });

    test('reflects the active condition count on the trigger', async ({
        membersPage
    }) => {
        await membersPage.goto();
        await membersPage.openFilters();
        await membersPage.addRule();
        await membersPage.selectField('Status');
        await membersPage.selectEnumValue('Active');
        await membersPage.applyFilters();

        await expect(membersPage.filterTrigger()).toHaveText(/Filters \(1\)/);
    });

    test('restores the filter from a deep link on load', async ({
        membersPage,
        page
    }) => {
        const filter = encodeURIComponent(
            JSON.stringify({ field: 'status', op: 'eq', value: 'disabled' })
        );
        await page.goto(`/users?filter=${filter}`);

        await expect(membersPage.row('Katherine Johnson')).toBeVisible();
        await expect(membersPage.row('Ada Lovelace')).toHaveCount(0);
        await expect(membersPage.filterTrigger()).toHaveText(/Filters \(1\)/);
    });

    test('the open drawer with a rule is accessible (axe)', async ({
        membersPage,
        makeAxe
    }) => {
        await membersPage.goto();
        await membersPage.openFilters();
        await membersPage.addRule();
        await membersPage.selectField('Status');
        // Scan the drawer with a live rule row (combobox pickers + footer).
        await expectNoA11yViolations(makeAxe());
    });

    test('Reset clears the filter and restores the full roster', async ({
        membersPage,
        page
    }) => {
        const filter = encodeURIComponent(
            JSON.stringify({ field: 'status', op: 'eq', value: 'disabled' })
        );
        await page.goto(`/users?filter=${filter}`);
        await expect(membersPage.row('Katherine Johnson')).toBeVisible();

        await membersPage.openFilters();
        await membersPage.resetFilters();

        await expect(membersPage.filterDrawer()).toHaveCount(0);
        await expect(membersPage.row('Ada Lovelace')).toBeVisible();
        await expect(membersPage.row('Grace Hopper')).toBeVisible();
        await expect(page).not.toHaveURL(/filter=/);
    });
});
