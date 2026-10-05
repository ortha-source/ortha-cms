import type { Page } from '@playwright/test';
import { test, expect } from '../support/fixtures';
import type { MembersPage } from '../support/pages/MembersPage';
import { mockSignedIn } from '../support/api/auth';
import { mockMembers } from '../support/api/members';
import { expectNoA11yViolations } from '../support/a11y';

/**
 * The Members query-builder filter (`@orthacms/query-builder-admin`): building a
 * condition narrows the roster, the choice deep-links into the URL as
 * `?filter=<json>`, and Reset clears it. The `GET /api/users` mock honours the
 * `filter` param (AND-ed with search), mirroring the server.
 *
 * The builder is a **popover** anchored to an icon-only "Filters" button here,
 * matching the activity log and the records list. Two behaviours follow from
 * that and are asserted below rather than assumed: a valid **Apply closes it**,
 * and the applied conditions read out as removable chips under the toolbar.
 */
test.describe('Members filter (query builder)', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockMembers(page);
    });

    test('opens the filter popover from the toolbar', async ({
        membersPage
    }) => {
        await membersPage.goto();
        await expect(membersPage.heading).toBeVisible();

        await membersPage.openFilters();
        await expect(membersPage.filterSurface()).toBeVisible();
        await expect(membersPage.filterTrigger()).toHaveAttribute(
            'aria-expanded',
            'true'
        );
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

        // Only the disabled member remains — and the popover has closed: Apply
        // commits to the URL and gets out of the way of the table it changed.
        // Assert the state the trigger publishes, not only the surface's
        // absence, which would pass on a page that never opened one.
        await expect(membersPage.row('Katherine Johnson')).toBeVisible();
        await expect(membersPage.row('Ada Lovelace')).toHaveCount(0);
        await expect(membersPage.row('Grace Hopper')).toHaveCount(0);
        await expect(membersPage.filterTrigger()).toHaveAttribute(
            'aria-expanded',
            'false'
        );
        await expect(membersPage.filterSurface()).toBeHidden();

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

        // In the name as words, and on the icon as a badge.
        await expect(membersPage.filterTrigger()).toHaveAccessibleName(
            'Filters, 1 applied'
        );
        await expect(membersPage.filterCountBadge()).toHaveText('1');
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
        await expect(membersPage.filterTrigger()).toHaveAccessibleName(
            'Filters, 1 applied'
        );
    });

    test('Escape closes the popover and hands focus back to the trigger', async ({
        membersPage,
        page
    }) => {
        await membersPage.goto();
        await membersPage.openFilters();
        await membersPage.addRule();

        // The popover unmounts on close; without the hand-back focus falls to
        // `<body>` and the next Tab restarts at the top of the document
        // (2.4.3, `ORT-157`).
        await page.keyboard.press('Escape');
        await expect(membersPage.filterTrigger()).toHaveAttribute(
            'aria-expanded',
            'false'
        );
        await expect(membersPage.filterSurface()).toBeHidden();
        await expect(membersPage.filterTrigger()).toBeFocused();
    });

    test('the open filter popover with a rule is accessible (axe)', async ({
        membersPage,
        makeAxe
    }) => {
        await membersPage.goto();
        await membersPage.openFilters();
        await membersPage.addRule();
        await membersPage.selectField('Status');
        // Scan the popover with a live rule row (combobox pickers + footer).
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

        await expect(membersPage.row('Ada Lovelace')).toBeVisible();
        await expect(membersPage.row('Grace Hopper')).toBeVisible();
        await expect(page).not.toHaveURL(/filter=/);
        await expect(membersPage.filterTrigger()).toHaveAccessibleName(
            'Filters'
        );
        await expect(membersPage.filterCountBadge()).toHaveCount(0);
    });

    /**
     * The resting read-out. The drawer this page once mounted only ever showed
     * a count on the trigger, so an applied filter said nothing about *what*
     * was filtered once the surface was shut.
     */
    test.describe('applied-filter summary', () => {
        /**
         * Apply `status equals Disabled`. A valid Apply closes the popover;
         * `closeFilters()` asserts that it did.
         */
        async function applyAndCollapse(membersPage: MembersPage, page: Page) {
            await page.goto('/users');
            await expect(membersPage.row('Ada Lovelace')).toBeVisible();
            await membersPage.openFilters();
            await membersPage.addRule();
            await membersPage.selectField('Status');
            await membersPage.selectEnumValue('Disabled');
            await membersPage.applyFilters();
            await membersPage.closeFilters();
        }

        test('reads the applied condition back as a chip', async ({
            membersPage,
            page
        }) => {
            await applyAndCollapse(membersPage, page);

            // The enum value renders through the field's declared members, not
            // the wire value — "Disabled", never "disabled".
            await expect(
                membersPage.filterChip('Status equals Disabled')
            ).toBeVisible();
        });

        test('removing a chip re-commits the narrowed filter', async ({
            membersPage,
            page
        }) => {
            await applyAndCollapse(membersPage, page);
            await membersPage.removeFilterChip('Status equals');

            // The last condition removed clears the param entirely, rather than
            // leaving an empty group the server would reject.
            await expect(page).not.toHaveURL(/filter=/);
            await expect(membersPage.row('Ada Lovelace')).toBeVisible();
        });

        test('"Clear all" drops every condition', async ({
            membersPage,
            page
        }) => {
            await applyAndCollapse(membersPage, page);
            await membersPage.clearAllFilters();

            await expect(page).not.toHaveURL(/filter=/);
            await expect(membersPage.row('Ada Lovelace')).toBeVisible();
        });
    });
});
