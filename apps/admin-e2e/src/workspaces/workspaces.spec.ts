import { test, expect } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import { mockWorkspaces, mockWorkspacesApi } from '../support/api/workspaces';

/**
 * The Workspaces page (`@ortha-cms/workspaces-admin`). The grid reads
 * `GET /api/workspaces`, stubbed by `mockWorkspaces` (the FE analog of seeded
 * rows): four Active workspaces (Marketing site, Product docs, Support hub,
 * Internal wiki) and two Archived (Research archive, Events 2023); Product docs
 * has five members. The auth probe is stubbed too, since the page sits behind
 * the shell's gate.
 */
test.describe('Workspaces page', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockWorkspaces(page);
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
        // Clearing widens to every workspace (status → All, search reset).
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

        // The card opens the workspace shell, which redirects the base to its
        // first rail section (Content Library).
        await expect(page).toHaveURL('/workspaces/ws_marketing/content');
        await expect(
            page.getByRole('heading', { name: 'Content Library' })
        ).toBeVisible();
    });

    test.describe('create wizard', () => {
        test.beforeEach(async ({ page }) => {
            // Stateful create flow: the list GET reflects POSTed workspaces, plus
            // the wizard's slug/users/content-type reads.
            await mockWorkspacesApi(page);
        });

        test('creates a workspace and shows it in the grid', async ({
            page,
            workspacesPage,
            createWorkspacePage
        }) => {
            await workspacesPage.goto();
            await workspacesPage.openCreate();
            await expect(createWorkspacePage.heading).toBeVisible();
            await expect(page).toHaveURL(/\/workspaces\/new$/);

            await createWorkspacePage.create('QA space');

            // Back on the list: a toast confirms and the new card persists
            // through the post-create refetch (not just the optimistic insert).
            await expect(page).toHaveURL(/\/workspaces$/);
            await expect(workspacesPage.card('QA space')).toBeVisible();
            await expect(
                workspacesPage.toast('Workspace "QA space" created.')
            ).toBeVisible();
            await expect(workspacesPage.count()).toHaveText('5 of 7');
        });

        test('keeps Continue disabled until the basics are valid', async ({
            createWorkspacePage
        }) => {
            await createWorkspacePage.goto();

            await expect(createWorkspacePage.continueToMembers).toBeDisabled();

            await createWorkspacePage.nameInput.fill('QA space');

            // Enables once the auto-filled slug is confirmed available.
            await expect(createWorkspacePage.continueToMembers).toBeEnabled();
        });

        test('returns to the list via "Back to workspaces"', async ({
            page,
            workspacesPage,
            createWorkspacePage
        }) => {
            await createWorkspacePage.goto();

            await createWorkspacePage.backLink.click();

            await expect(page).toHaveURL(/\/workspaces$/);
            await expect(workspacesPage.heading).toBeVisible();
        });

        test('lets the owner pick an accent color', async ({
            createWorkspacePage
        }) => {
            await createWorkspacePage.goto();

            await createWorkspacePage.colorSwatch('teal').click();

            await expect(
                createWorkspacePage.colorSwatch('teal')
            ).toHaveAttribute('aria-checked', 'true');
        });
    });
});
