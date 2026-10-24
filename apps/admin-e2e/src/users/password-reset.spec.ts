import { test, expect } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import { DEFAULT_MEMBERS, mockMembers } from '../support/api/members';
import { mockWorkspaces } from '../support/api/workspaces';
import { mockMemberPage, mockUserDetail } from '../support/api/userDetail';
import {
    RESET_TOKEN,
    spyIssuePasswordReset
} from '../support/api/passwordReset';

const GRACE = DEFAULT_MEMBERS[1];
const ALAN = DEFAULT_MEMBERS[2];
const KATHERINE = DEFAULT_MEMBERS[3];

/**
 * The password link (`@orthacms/users-admin`): on the **Sessions & access**
 * tab it is generated and shown **in place** with Copy; from the roster row's
 * "Password reset link" it opens the reveal-once dialog.
 *
 * Generating rotates the token server-side, so whatever link was outstanding
 * is already dead — which makes "the admin actually captured this one" part of
 * the operation rather than a nicety. Both surfaces ask before losing it.
 */
test.describe('generate a password reset link', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockMembers(page);
        await mockWorkspaces(page);
        await mockMemberPage(page);
        await mockUserDetail(page);
    });

    test('shows the link in place, once, for the right member', async ({
        page,
        userDetailPage
    }) => {
        const spy = await spyIssuePasswordReset(page, { member: GRACE });

        await userDetailPage.goto(GRACE.id);
        await userDetailPage.openTab('Sessions & access');
        await userDetailPage.generateResetLink().click();

        await expect(userDetailPage.resetLinkField(GRACE.email)).toHaveValue(
            new RegExp(`/identity/reset-password\\?token=${RESET_TOKEN}$`)
        );
        expect(spy.count).toBe(1);
        await expect(
            page.getByText(
                'Works once, for 1 hour. Generating another one replaces it.'
            )
        ).toBeVisible();
        await expect(
            page.getByText(/Mail is off, so share it yourself/)
        ).toBeVisible();
        await expect(userDetailPage.copyResetLink()).toBeVisible();
    });

    test('asks before leaving the page with the link uncopied', async ({
        page,
        userDetailPage
    }) => {
        await spyIssuePasswordReset(page, { member: GRACE });

        await userDetailPage.goto(GRACE.id);
        await userDetailPage.openTab('Sessions & access');
        await userDetailPage.generateResetLink().click();
        await expect(userDetailPage.resetLinkField(GRACE.email)).toBeVisible();

        // Leaving is the app-wide unsaved-changes guard's job: a tab switch
        // is a navigation, and the link is the only copy there is.
        await userDetailPage.openTab('Overview');
        await expect(
            page.locator('[role="dialog"], [role="alertdialog"]')
        ).toBeVisible();
        await expect(page).toHaveURL(/\/access$/);
    });

    test('from the roster, opens the reveal dialog and guards its dismissal', async ({
        page,
        membersPage,
        userDetailPage
    }) => {
        await spyIssuePasswordReset(page, { member: GRACE });
        await membersPage.goto();
        await membersPage.openActions(GRACE.name!);
        await membersPage.menuItem('Password reset link').click();

        await expect(userDetailPage.resetLinkDialog()).toBeVisible();
        await expect(userDetailPage.resetLinkField(GRACE.email)).toHaveValue(
            new RegExp(`token=${RESET_TOKEN}$`)
        );
        // Closing without copying loses the only copy that exists — and the
        // server refuses another for a minute.
        await userDetailPage.resetLinkDone().click();
        await expect(userDetailPage.resetLinkDialog()).toBeVisible();
        await expect(
            page.getByText(/haven’t copied the link yet/)
        ).toBeVisible();
    });

    test('offers no reset for a member who has not accepted their invite', async ({
        page,
        userDetailPage
    }) => {
        const spy = await spyIssuePasswordReset(page, { member: ALAN });

        await userDetailPage.goto(ALAN.id);
        await userDetailPage.openTab('Sessions & access');

        // A pending member has no password to reset — the card says so and
        // offers no button the server would 409.
        await expect(page.getByText(/no password to reset/)).toBeVisible();
        await expect(userDetailPage.generateResetLink()).toHaveCount(0);
        expect(spy.count).toBe(0);
    });

    test('offers no reset for a suspended member', async ({
        page,
        userDetailPage
    }) => {
        await spyIssuePasswordReset(page, { member: KATHERINE });

        await userDetailPage.goto(KATHERINE.id);
        await userDetailPage.openTab('Sessions & access');

        await expect(
            page.getByText(/suspended and can’t sign in/)
        ).toBeVisible();
        await expect(userDetailPage.generateResetLink()).toHaveCount(0);
    });

    test('says how long to wait when a link was just generated', async ({
        page,
        userDetailPage
    }) => {
        await spyIssuePasswordReset(page, {
            member: GRACE,
            status: 409,
            code: 'PASSWORD_RESET_RECENTLY_SENT',
            retryAfterSeconds: 42
        });

        await userDetailPage.goto(GRACE.id);
        await userDetailPage.openTab('Sessions & access');
        await userDetailPage.generateResetLink().click();

        // The conflict is actionable and the body says how — "something went
        // wrong" would leave the admin retrying into the same refusal.
        await expect(page.getByText(/Wait 42 seconds/)).toBeVisible();
        await expect(userDetailPage.resetLinkField(GRACE.email)).toHaveCount(0);
    });
});
