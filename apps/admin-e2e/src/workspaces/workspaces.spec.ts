import { test, expect } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import { mockWorkspaces } from '../support/api/workspaces';

/**
 * The Workspaces page (`@ortha-cms/workspaces-admin`). Data comes from the
 * `GET /api/workspaces` mock (`mockWorkspaces`); the auth probe is stubbed too,
 * since the page sits behind the shell's gate. The seed is fixed: four
 * workspaces (Marketing site, Product docs, Support hub, Internal wiki) — the
 * read API has no status, so the grid reads them all as Active; Product docs has
 * five members. Create is hidden (the API is read-only), so there is no create
 * flow here.
 */
test.describe('Workspaces page', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockWorkspaces(page);
    });

    test('renders the workspaces behind the shell', async ({
        workspacesPage
    }) => {
        await workspacesPage.goto();

        await expect(workspacesPage.heading).toBeVisible();
        await expect(workspacesPage.nav).toBeVisible();
        // Default filter is Active; the API has no status so every workspace
        // shows.
        await expect(workspacesPage.card('Marketing site')).toBeVisible();
        await expect(workspacesPage.card('Internal wiki')).toBeVisible();
        await expect(workspacesPage.count()).toHaveText('4 of 4');
    });

    test('search narrows the grid and updates the count', async ({
        workspacesPage
    }) => {
        await workspacesPage.goto();

        await workspacesPage.search.fill('Marketing');

        await expect(workspacesPage.card('Marketing site')).toBeVisible();
        await expect(workspacesPage.card('Support hub')).toBeHidden();
        await expect(workspacesPage.count()).toHaveText('1 of 4');
    });

    test('the archived filter empties the grid and badges the button', async ({
        workspacesPage
    }) => {
        await workspacesPage.goto();

        await workspacesPage.filterByStatus('Archived');

        // No workspace is archived (the API has no status), so the archived view
        // is empty and offers to clear the filters.
        await expect(workspacesPage.card('Marketing site')).toBeHidden();
        await expect(
            workspacesPage.emptyText('No workspaces match')
        ).toBeVisible();
        await expect(workspacesPage.count()).toHaveText('0 of 4');
        // A non-default status surfaces the count badge on the Filter button.
        await expect(workspacesPage.filterBadge()).toBeVisible();
    });

    test('the status filter can show all workspaces', async ({
        workspacesPage
    }) => {
        await workspacesPage.goto();

        await workspacesPage.filterByStatus('All');

        await expect(workspacesPage.card('Marketing site')).toBeVisible();
        await expect(workspacesPage.card('Internal wiki')).toBeVisible();
        await expect(workspacesPage.count()).toHaveText('4 of 4');
    });

    test('shows a contextual empty state when nothing matches', async ({
        workspacesPage
    }) => {
        await workspacesPage.goto();

        await workspacesPage.search.fill('nonexistent-workspace-xyz');

        await expect(
            workspacesPage.emptyText('No workspaces match')
        ).toBeVisible();
        // Clearing widens to every workspace (status → All, search reset), so
        // the action always reveals content.
        await workspacesPage.clearFiltersButton().click();
        await expect(workspacesPage.card('Marketing site')).toBeVisible();
        await expect(workspacesPage.count()).toHaveText('4 of 4');
    });

    test.describe('member stack', () => {
        test('collapses extra members into a "+N" pill', async ({
            workspacesPage
        }) => {
            await workspacesPage.goto();

            // Product docs has 5 members → 4 avatars + "+1".
            await expect(
                workspacesPage.card('Product docs').getByText('+1')
            ).toBeVisible();
        });

        test('opens a member list without opening the workspace', async ({
            page,
            workspacesPage
        }) => {
            await workspacesPage.goto();

            await workspacesPage.memberButton('Marketing site').click();

            // The popover lists members by name + email (shown nowhere else)…
            await expect(
                workspacesPage.memberName('Ada Lovelace')
            ).toBeVisible();
            await expect(
                workspacesPage.memberEmail('ada@ortha.dev')
            ).toBeVisible();
            // …and the card itself did NOT open (stayed on the list route).
            await expect(page).toHaveURL(/\/workspaces$/);
        });

        test('closes on Escape and on an outside click', async ({
            page,
            workspacesPage
        }) => {
            await workspacesPage.goto();
            const name = workspacesPage.memberName('Ada Lovelace');

            await workspacesPage.memberButton('Marketing site').click();
            await expect(name).toBeVisible();
            await page.keyboard.press('Escape');
            await expect(name).toBeHidden();

            await workspacesPage.memberButton('Marketing site').click();
            await expect(name).toBeVisible();
            await workspacesPage.heading.click(); // click outside the popover
            await expect(name).toBeHidden();
        });
    });

    test('a card opens its workspace on click', async ({
        page,
        workspacesPage
    }) => {
        await workspacesPage.goto();

        await workspacesPage.openButton('Marketing site').click();

        // TODO(workspaces-detail): there is no `/workspaces/:id` route yet, so
        // the catch-all redirects to home — this asserts the card is wired and
        // activates; tighten to the detail URL once that page lands.
        await expect(page).toHaveURL('/');
    });
});
