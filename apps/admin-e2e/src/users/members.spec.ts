import { test, expect } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import { mockMembers, spyInvite } from '../support/api/members';

/**
 * The Members page (`/users`, `@ortha-cms/users-admin`): rendering the roster,
 * search, the invite dialog, status-dependent row actions, the guardrail
 * tooltips for the sole admin, and permission gating. The backend is the
 * `GET /api/users` mock; `mockSignedIn` satisfies the shell's auth probe.
 */
test.describe('Members page', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockMembers(page);
    });

    test('renders the roster with names, emails, and status pills', async ({
        membersPage
    }) => {
        await membersPage.goto();
        await expect(membersPage.heading).toBeVisible();
        // The gated shell wrapped the page.
        await expect(membersPage.nav).toBeVisible();

        await expect(membersPage.row('Ada Lovelace')).toBeVisible();
        await expect(membersPage.row('grace@ortha.dev')).toBeVisible();
        // The pending invite renders as a normal row with an "Invited" pill —
        // not a separate tab.
        await expect(membersPage.row('alan@ortha.dev')).toBeVisible();
        await expect(membersPage.statusPill('Invited')).toBeVisible();
        await expect(membersPage.statusPill('Disabled')).toBeVisible();
    });

    test('shows the member count in the header subtitle', async ({
        membersPage,
        page
    }) => {
        await membersPage.goto();
        await expect(
            page.getByText('4 people', { exact: false })
        ).toBeVisible();
    });

    test('filters the roster by a search term', async ({ membersPage }) => {
        await membersPage.goto();
        await membersPage.search.fill('grace');

        await expect(membersPage.row('Grace Hopper')).toBeVisible();
        await expect(membersPage.row('Ada Lovelace')).toHaveCount(0);
    });

    test('shows an empty state when the search matches nobody', async ({
        membersPage
    }) => {
        await membersPage.goto();
        await membersPage.search.fill('nobody-xyz');
        await expect(membersPage.emptyText('No members match')).toBeVisible();
    });

    test('opens the invite dialog and sends an invite', async ({
        membersPage,
        page
    }) => {
        const invite = await spyInvite(page);
        await membersPage.goto();

        await membersPage.inviteButton.click();
        await expect(membersPage.dialog()).toBeVisible();

        await membersPage.dialogEmail().fill('new@ortha.dev');
        await membersPage.dialogSubmit().click();

        await expect(membersPage.dialog()).toBeHidden();
        expect(invite.count).toBe(1);
    });

    test('does not call the API when the invite email is invalid', async ({
        membersPage,
        page
    }) => {
        const invite = await spyInvite(page);
        await membersPage.goto();

        await membersPage.inviteButton.click();
        await membersPage.dialogEmail().fill('not-an-email');
        await membersPage.dialogSubmit().click();

        // The dialog stays open and the request is suppressed by validation.
        await expect(membersPage.dialog()).toBeVisible();
        expect(invite.count).toBe(0);
    });

    test('shows status-specific actions for a pending invite', async ({
        membersPage
    }) => {
        await membersPage.goto();
        await membersPage.openActions('alan@ortha.dev');

        await expect(membersPage.menuItem('Resend invite')).toBeVisible();
        await expect(membersPage.menuItem('Edit')).toBeVisible();
        await expect(membersPage.menuItem('Revoke invite')).toBeVisible();
        await expect(membersPage.menuItem('Disable')).toHaveCount(0);
    });

    test('offers Enable (not Disable) for a disabled member', async ({
        membersPage
    }) => {
        await membersPage.goto();
        await membersPage.openActions('Katherine Johnson');

        await expect(membersPage.menuItem('Enable')).toBeVisible();
        await expect(membersPage.menuItem('Disable')).toHaveCount(0);
    });

    test('disables the role select for the sole admin', async ({
        membersPage
    }) => {
        await membersPage.goto();
        // Ada is the last admin (isLastAdmin), so her role can't be changed.
        await expect(membersPage.roleSelect('Ada Lovelace')).toBeDisabled();
        // Grace is editable.
        await expect(membersPage.roleSelect('Grace Hopper')).toBeEnabled();
    });

    test('hides write controls without the matching permission', async ({
        membersPage,
        page
    }) => {
        // A viewer holds only users:read.
        await mockSignedIn(page, { permissions: ['users:read'] });
        await membersPage.goto();

        await expect(membersPage.heading).toBeVisible();
        await expect(membersPage.inviteButton).toHaveCount(0);
        // No inline role editor — the role renders as plain text.
        await expect(membersPage.roleSelect('Grace Hopper')).toHaveCount(0);
        // No row menu either (no write actions available).
        await expect(membersPage.actionsTrigger('Grace Hopper')).toHaveCount(0);
    });

    test('shows a no-access state without users:read', async ({
        membersPage,
        page
    }) => {
        await mockSignedIn(page, { permissions: [] });
        await membersPage.goto();

        await expect(membersPage.noAccessText()).toBeVisible();
        await expect(membersPage.search).toHaveCount(0);
    });
});
