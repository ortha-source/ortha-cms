import { test, expect } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import {
    DEFAULT_MEMBERS,
    INVITE_TOKEN,
    ROTATED_INVITE_TOKEN,
    manyMembers,
    mockMembers,
    spyInvite,
    spyResendInvite
} from '../support/api/members';
import { mockWorkspaces } from '../support/api/workspaces';

/** Alan — the roster's one pending invite, the only member Resend applies to. */
const PENDING_MEMBER = DEFAULT_MEMBERS.filter(
    (member) => member.status === 'pending'
)[0];

/**
 * The Members page (`/users`, `@ortha-cms/users-admin`): rendering the roster,
 * search, the invite wizard, status-dependent row actions, the guardrail
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

    test('invites a member through the three-step wizard', async ({
        membersPage,
        page
    }) => {
        const invite = await spyInvite(page);
        await mockWorkspaces(page); // the assignment step lists workspaces
        await membersPage.goto();

        await membersPage.inviteButton.click();
        await expect(page).toHaveURL(/\/users\/invite$/);
        await expect(membersPage.inviteHeading()).toBeVisible();

        // Step 1 — details.
        await membersPage.inviteEmail().fill('new@ortha.dev');
        await membersPage.continueToRole().click();
        // Step 2 — role.
        await membersPage.continueToWorkspaces().click();
        // Step 3 — assign a workspace, then send.
        await membersPage.inviteWorkspace('Marketing site').check();
        await membersPage.sendInvite().click();

        // No redirect: the raw token comes back once, so the wizard hands the
        // link over instead of dropping the admin back on the list.
        await expect(membersPage.inviteSentHeading()).toBeVisible();
        await expect(page).toHaveURL(/\/users\/invite$/);
        await expect(membersPage.inviteLinkField('new@ortha.dev')).toHaveValue(
            new RegExp(`/identity/accept-invite\\?token=${INVITE_TOKEN}$`)
        );
        expect(invite.count).toBe(1);
    });

    test('assigns all workspaces via the "All workspaces" mode', async ({
        membersPage,
        page
    }) => {
        await spyInvite(page);
        await mockWorkspaces(page);
        await membersPage.goto();

        await membersPage.inviteButton.click();
        await membersPage.inviteEmail().fill('new@ortha.dev');
        await membersPage.continueToRole().click();
        await membersPage.continueToWorkspaces().click();

        // Default is "Specific" — the search is shown.
        await expect(membersPage.workspaceSearch()).toBeVisible();
        // Switching to "All workspaces" hides the per-workspace picker.
        await membersPage.inviteWorkspaceMode('All workspaces').check();
        await expect(membersPage.workspaceSearch()).toBeHidden();
    });

    test('searches the workspaces in the assignment step', async ({
        membersPage,
        page
    }) => {
        await spyInvite(page);
        await mockWorkspaces(page);
        await membersPage.goto();

        await membersPage.inviteButton.click();
        await membersPage.inviteEmail().fill('new@ortha.dev');
        await membersPage.continueToRole().click();
        await membersPage.continueToWorkspaces().click();

        await membersPage.workspaceSearch().fill('Marketing');
        await expect(
            membersPage.inviteWorkspace('Marketing site')
        ).toBeVisible();
        await expect(membersPage.inviteWorkspace('Product docs')).toHaveCount(
            0
        );
    });

    test('keeps Continue disabled (no request) for an invalid email', async ({
        membersPage,
        page
    }) => {
        const invite = await spyInvite(page);
        await membersPage.goto();

        await membersPage.inviteButton.click();
        await membersPage.inviteEmail().fill('not-an-email');

        // Continue stays disabled, so the role step and submit are unreachable.
        await expect(membersPage.continueToRole()).toBeDisabled();
        expect(invite.count).toBe(0);
    });

    test('paginates with a selectable page size', async ({
        membersPage,
        page
    }) => {
        // 7 members so a page size of 5 yields two pages.
        await mockMembers(page, manyMembers(7));
        await membersPage.goto();

        // Default size (10) fits all 7 on one page — no prev/next.
        await expect(membersPage.paginationRange()).toHaveText(/^1.7 of 7$/);
        await expect(membersPage.nextPage()).toHaveCount(0);

        // 5 per page → two pages; the readout and controls follow.
        await membersPage.setRowsPerPage('5');
        await expect(membersPage.paginationRange()).toHaveText(/^1.5 of 7$/);
        await membersPage.nextPage().click();
        await expect(membersPage.paginationRange()).toHaveText(/^6.7 of 7$/);
    });

    test('shows status-specific actions for a pending invite', async ({
        membersPage
    }) => {
        await membersPage.goto();
        await membersPage.openActions('alan@ortha.dev');

        await expect(membersPage.menuItem('Resend invite')).toBeVisible();
        await expect(membersPage.menuItem('Revoke invite')).toBeVisible();
        await expect(membersPage.menuItem('Disable')).toHaveCount(0);
    });

    test('the row menu mirrors the detail sections', async ({
        membersPage
    }) => {
        await membersPage.goto();
        await membersPage.openActions('Grace Hopper');

        // Account + gated Audit/Access navigation, no "Edit".
        await expect(membersPage.menuItem('General')).toBeVisible();
        await expect(membersPage.menuItem('Sessions')).toBeVisible();
        await expect(membersPage.menuItem('Sign-in access')).toBeVisible();
        await expect(membersPage.menuItem('Edit')).toHaveCount(0);
    });

    test('offers Enable (not Disable) for a disabled member', async ({
        membersPage
    }) => {
        await membersPage.goto();
        await membersPage.openActions('Katherine Johnson');

        await expect(membersPage.menuItem('Enable')).toBeVisible();
        await expect(membersPage.menuItem('Disable')).toHaveCount(0);
    });

    test('renders the role as a read-only chip', async ({ membersPage }) => {
        await membersPage.goto();
        // The Role column is a read-only chip; editing happens on the detail
        // page's Role tab, not inline.
        await expect(membersPage.roleChip('Ada Lovelace')).toBeVisible();
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
        // The role is a read-only chip for everyone.
        await expect(membersPage.roleChip('Grace Hopper')).toBeVisible();
        // The row menu is navigation-only for a viewer: Account links, but no
        // gated Audit/Access tabs and no write actions.
        await membersPage.openActions('Grace Hopper');
        await expect(membersPage.menuItem('General')).toBeVisible();
        await expect(membersPage.menuItem('Sessions')).toHaveCount(0);
        await expect(membersPage.menuItem('Disable')).toHaveCount(0);
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

    test('hands over the rotated link when an invite is resent', async ({
        membersPage,
        page
    }) => {
        const resend = await spyResendInvite(page, PENDING_MEMBER);
        await membersPage.goto();

        await membersPage.openActions(PENDING_MEMBER.email);
        await membersPage.menuItem('Resend invite').click();

        // Resending rotates the token, so the old link is already dead — the
        // dialog exists so the admin leaves with the one that works.
        await expect(membersPage.inviteLinkDialog()).toBeVisible();
        await expect(
            membersPage.inviteLinkField(PENDING_MEMBER.email)
        ).toHaveValue(
            new RegExp(
                `/identity/accept-invite\\?token=${ROTATED_INVITE_TOKEN}$`
            )
        );
        expect(resend.count).toBe(1);
    });
});
