import { test, expect } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';

/**
 * The Workspaces page (`@ortha-cms/workspaces-admin`). Data comes from the
 * plugin's in-memory seed (no `/api` mock) — only the auth probe is stubbed,
 * since the page sits behind the shell's gate. The seed is fixed: four Active
 * workspaces (Marketing site, Product docs, Support hub, Internal wiki) and two
 * Archived (Research archive, Events 2023); Product docs has five members.
 */
test.describe('Workspaces page', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
    });

    test('renders the active workspaces by default behind the shell', async ({
        workspacesPage
    }) => {
        await workspacesPage.goto();

        await expect(workspacesPage.heading).toBeVisible();
        await expect(workspacesPage.nav).toBeVisible();
        // Default filter is Active: active cards show, archived are hidden.
        await expect(workspacesPage.card('Marketing site')).toBeVisible();
        await expect(workspacesPage.card('Research archive')).toBeHidden();
        await expect(workspacesPage.count()).toHaveText('4 of 6');
    });

    test('search narrows the grid and updates the count', async ({
        workspacesPage
    }) => {
        await workspacesPage.goto();

        await workspacesPage.search.fill('Marketing');

        await expect(workspacesPage.card('Marketing site')).toBeVisible();
        await expect(workspacesPage.card('Support hub')).toBeHidden();
        await expect(workspacesPage.count()).toHaveText('1 of 6');
    });

    test('the status filter switches to archived and badges the button', async ({
        workspacesPage
    }) => {
        await workspacesPage.goto();

        await workspacesPage.filterByStatus('Archived');

        await expect(workspacesPage.card('Research archive')).toBeVisible();
        await expect(workspacesPage.card('Marketing site')).toBeHidden();
        await expect(workspacesPage.count()).toHaveText('2 of 6');
        // A non-default status surfaces the count badge on the Filter button.
        await expect(workspacesPage.filterBadge()).toBeVisible();
    });

    test('the status filter can show all workspaces', async ({
        workspacesPage
    }) => {
        await workspacesPage.goto();

        await workspacesPage.filterByStatus('All');

        await expect(workspacesPage.card('Marketing site')).toBeVisible();
        await expect(workspacesPage.card('Research archive')).toBeVisible();
        await expect(workspacesPage.count()).toHaveText('6 of 6');
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
        // the action always reveals content — including the all-archived case
        // where resetting to the default Active view would leave it empty.
        await workspacesPage.clearFiltersButton().click();
        await expect(workspacesPage.card('Marketing site')).toBeVisible();
        await expect(workspacesPage.card('Research archive')).toBeVisible();
        await expect(workspacesPage.count()).toHaveText('6 of 6');
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

    test.describe('create', () => {
        test('adds a workspace optimistically and toasts', async ({
            workspacesPage
        }) => {
            await workspacesPage.goto();
            await workspacesPage.openCreate();

            await workspacesPage.nameField().fill('QA space');
            await workspacesPage
                .descriptionField()
                .fill('Scratch space for QA.');
            await workspacesPage.submitCreate().click();

            // Dialog closes, a toast confirms, and the new card is on top.
            await expect(workspacesPage.dialog()).toBeHidden();
            await expect(
                workspacesPage.toast(/Created.*QA space/)
            ).toBeVisible();
            await expect(workspacesPage.card('QA space')).toBeVisible();
            await expect(workspacesPage.count()).toHaveText('5 of 7');
        });

        test('blocks an empty name with a validation error', async ({
            workspacesPage
        }) => {
            await workspacesPage.goto();
            await workspacesPage.openCreate();

            // Touch then clear the field to trigger onChange validation.
            await workspacesPage.nameField().fill('Temp');
            await workspacesPage.nameField().fill('');

            await expect(
                workspacesPage.fieldError('Name is required')
            ).toBeVisible();
            // The dialog stays open and nothing is created.
            await expect(workspacesPage.dialog()).toBeVisible();
        });

        test('can be dismissed with Cancel', async ({ workspacesPage }) => {
            await workspacesPage.goto();
            await workspacesPage.openCreate();

            await workspacesPage.cancelCreate().click();

            await expect(workspacesPage.dialog()).toBeHidden();
        });

        test('lets the owner pick an accent color', async ({
            workspacesPage
        }) => {
            await workspacesPage.goto();
            await workspacesPage.openCreate();

            await workspacesPage.colorSwatch('teal').click();

            await expect(workspacesPage.colorSwatch('teal')).toHaveAttribute(
                'aria-checked',
                'true'
            );
        });
    });
});
