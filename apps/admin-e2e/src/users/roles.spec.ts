import { test, expect } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import { DEFAULT_MEMBERS, mockMembers } from '../support/api/members';
import { mockWorkspaces } from '../support/api/workspaces';
import {
    mockMemberPage,
    mockRoleCatalog,
    mockUserDetail,
    spyUpdateMember
} from '../support/api/userDetail';
import { expectNoA11yViolations } from '../support/a11y';

/** Grace — an ordinary active contributor, so nothing locks her role. */
const GRACE = DEFAULT_MEMBERS.find((member) => member.id === 'u_grace')!;

/** Ada — the sole active admin (`isLastAdmin`). */
const ADA = DEFAULT_MEMBERS.find((member) => member.id === 'u_ada')!;

/**
 * A member holding a role outside the three assignable system roles. The
 * server's `Role.create` accepts any non-empty key, so this is a shape the
 * admin has to render honestly rather than round down to `viewer`.
 */
const CUSTOM_ROLE_MEMBER = {
    ...GRACE,
    id: 'u_custom',
    email: 'editor@orthacms.dev',
    name: 'Edie Editor',
    role: { id: 'role_editor', key: 'editor', name: 'Editor' }
};

/**
 * The role dialog — opened from the member page's header ("Change role") or
 * the roster row's "Change role…". Instead of a bare "are you sure?", it shows
 * **what changes**: the capabilities the current and the chosen role hold, the
 * flipping rows highlighted, and a button that names the outcome. The guards
 * stay, with the reason written underneath.
 */
test.describe('Role dialog', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page, {
            id: ADA.id,
            email: ADA.email,
            name: ADA.name
        });
        await mockMembers(page);
        await mockWorkspaces(page);
        await mockMemberPage(page);
        await mockUserDetail(page);
    });

    test('shows what promotion adds, and names the outcome on the button', async ({
        userDetailPage,
        membersPage,
        page
    }) => {
        const update = await spyUpdateMember(page);
        await userDetailPage.goto(GRACE.id);
        await userDetailPage.changeRoleButton().click();

        await expect(membersPage.roleDialog()).toBeVisible();
        // Nothing chosen yet, so nothing to do.
        await expect(membersPage.roleConfirm()).toBeDisabled();

        await membersPage.inviteRole('Admin').click();

        await expect(
            membersPage.roleChange('Edit and publish content')
        ).not.toHaveAttribute('data-changed', 'true');
        await expect(
            membersPage.roleChange('Manage members and roles')
        ).toHaveAttribute('data-changed', 'true');
        await expect(
            membersPage.roleChange('API tokens and webhooks')
        ).toContainText(/No\s*Yes/);
        await expect(membersPage.roleDialog()).toContainText(
            'Takes effect on Grace’s next request — no sign-out needed.'
        );
        await expect(membersPage.roleConfirm()).toHaveText(
            'Make Grace an admin'
        );

        await membersPage.roleConfirm().click();
        await expect.poll(() => update.bodies.length).toBe(1);
        expect(update.bodies[0]).toEqual({ role: 'admin' });
        await expect(membersPage.roleDialog()).toHaveCount(0);
    });

    test('shows what a demotion takes away', async ({
        userDetailPage,
        membersPage
    }) => {
        await userDetailPage.goto(GRACE.id);
        await userDetailPage.changeRoleButton().click();
        await membersPage.inviteRole('Viewer').click();

        await expect(
            membersPage.roleChange('Edit and publish content')
        ).toHaveAttribute('data-changed', 'true');
        await expect(membersPage.roleConfirm()).toHaveText(
            'Make Grace a viewer'
        );
    });

    test('opens from the roster row too', async ({ membersPage }) => {
        await membersPage.goto();
        await membersPage.openActions(GRACE.name!);
        await membersPage.menuItem('Change role…').click();

        await expect(membersPage.roleDialog()).toBeVisible();
        await expect(membersPage.roleDialog()).toContainText('Current');
    });

    test('still changes the role when the role catalogue cannot be read', async ({
        userDetailPage,
        membersPage,
        page
    }) => {
        await mockRoleCatalog(page, { status: 500 });
        await userDetailPage.goto(GRACE.id);
        await userDetailPage.changeRoleButton().click();
        await membersPage.inviteRole('Admin').click();

        await expect(
            membersPage.roleDialog().getByText(/Couldn’t load what each role/)
        ).toBeVisible({ timeout: 15_000 });
        await expect(membersPage.roleConfirm()).toBeEnabled();
    });

    test('locks your own role with the reason, rather than 409-ing', async ({
        userDetailPage,
        membersPage,
        page
    }) => {
        // Signed in as Ada, looking at Ada: the server refuses a self re-role.
        await userDetailPage.goto(ADA.id);
        await userDetailPage.changeRoleButton().click();
        await expect(
            page.getByText('You can’t change your own role')
        ).toBeVisible();
        await expect(membersPage.roleConfirm()).toBeDisabled();
    });

    test('locks the sole active admin with the reason [users:I-16]', async ({
        userDetailPage,
        membersPage,
        page
    }) => {
        // Signed in as somebody else, so `self` doesn't mask `lastAdmin`.
        await mockSignedIn(page, {
            id: GRACE.id,
            email: GRACE.email,
            name: GRACE.name
        });
        await userDetailPage.goto(ADA.id);
        await userDetailPage.changeRoleButton().click();

        await expect(
            membersPage
                .roleDialog()
                .getByText(
                    'Ada is the last admin — make someone else admin first.'
                )
        ).toBeVisible();
        await expect(membersPage.inviteRole('Viewer')).toBeDisabled();
        await expect(membersPage.roleConfirm()).toBeDisabled();
    });

    test('shows a custom role by its server name and refuses to guess', async ({
        userDetailPage,
        membersPage,
        page
    }) => {
        const members = [...DEFAULT_MEMBERS, CUSTOM_ROLE_MEMBER];
        await mockMembers(page, members);
        await mockUserDetail(page, members);

        await userDetailPage.goto(CUSTOM_ROLE_MEMBER.id);

        // The header chip shows "Editor" — not "Viewer", which is what a
        // `?? 'viewer'` mapper fallback would have asserted.
        await expect(page.getByText('Editor', { exact: true })).toBeVisible();

        await userDetailPage.changeRoleButton().click();
        await expect(
            membersPage
                .roleDialog()
                .getByText('holds the custom role “Editor”', { exact: false })
        ).toBeVisible();
        // No card claims to be their current role.
        await expect(membersPage.roleDialog().getByText('Current')).toHaveCount(
            0
        );
        await expect(membersPage.roleConfirm()).toBeDisabled();
    });

    test('accessibility — the dialog with a change chosen', async ({
        userDetailPage,
        membersPage,
        makeAxe
    }) => {
        await userDetailPage.goto(GRACE.id);
        await userDetailPage.changeRoleButton().click();
        await membersPage.inviteRole('Admin').click();
        await membersPage.roleChangesTable().waitFor();
        await expectNoA11yViolations(makeAxe());
    });
});
