import { test, expect } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import { mockMembers } from '../support/api/members';
import { mockWorkspaces } from '../support/api/workspaces';
import {
    mockActivity,
    mockEmptyActivity,
    mockUserDetail,
    mockUserSessions,
    spyUpdateMember
} from '../support/api/userDetail';

/**
 * The user detail page (`/users/:id`, `@ortha-cms/users-admin`): the hero +
 * stats + side-rail shell, tab navigation, the General name edit, session
 * revocation, and permission-gated tabs. Backed by the `mockUserDetail` /
 * `mockUserSessions` / activity mocks; `mockSignedIn` satisfies the shell's
 * auth probe and decides which tabs the rail shows.
 */
test.describe('User detail page', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockMembers(page);
        await mockWorkspaces(page);
        await mockEmptyActivity(page);
        await mockUserSessions(page);
        await mockUserDetail(page);
    });

    test('renders the member hero and the General tab by default', async ({
        userDetailPage
    }) => {
        await userDetailPage.goto('u_grace');
        await expect(userDetailPage.nav).toBeVisible();
        await expect(userDetailPage.heading('Grace Hopper')).toBeVisible();
        // The index redirects to General, whose form shows the email read-only.
        await expect(userDetailPage.nameInput()).toHaveValue('Grace Hopper');
    });

    test('opens when the member row is clicked', async ({
        membersPage,
        userDetailPage,
        page
    }) => {
        await membersPage.goto();
        await membersPage.openMember('Grace Hopper');
        await expect(page).toHaveURL(/\/users\/u_grace/);
        await expect(userDetailPage.heading('Grace Hopper')).toBeVisible();
    });

    test('opens a specific tab from the row menu', async ({
        membersPage,
        userDetailPage,
        page
    }) => {
        await membersPage.goto();
        await page
            .getByRole('button', { name: 'Actions for Grace Hopper' })
            .click();
        await page.getByRole('menuitem', { name: 'Sessions' }).click();
        await expect(page).toHaveURL(/\/users\/u_grace\/sessions/);
        await expect(userDetailPage.heading('Grace Hopper')).toBeVisible();
    });

    test('navigates between tabs via the side rail', async ({
        userDetailPage,
        page
    }) => {
        await userDetailPage.goto('u_grace');
        await userDetailPage.openTab('Role');
        await expect(page).toHaveURL(/\/users\/u_grace\/roles/);
        await userDetailPage.openTab('Workspaces');
        await expect(page).toHaveURL(/\/users\/u_grace\/workspaces/);
        await userDetailPage.openTab('Sessions');
        await expect(page).toHaveURL(/\/users\/u_grace\/sessions/);
    });

    test('edits the display name (PATCH /api/users/:id)', async ({
        userDetailPage,
        page
    }) => {
        const spy = await spyUpdateMember(page);
        await userDetailPage.goto('u_grace');

        await userDetailPage.nameInput().fill('Grace B. Hopper');
        await userDetailPage.saveButton().click();

        await expect.poll(() => spy.bodies.length).toBe(1);
        expect(spy.bodies[0]).toMatchObject({ name: 'Grace B. Hopper' });
    });

    test('revokes a session from the Sessions tab', async ({
        userDetailPage,
        page
    }) => {
        const sessions = await mockUserSessions(page);
        await userDetailPage.goto('u_grace');
        await userDetailPage.openTab('Sessions');

        await expect(page.getByText('Chrome on macOS')).toBeVisible();
        await page
            .getByRole('button', { name: 'Revoke this session' })
            .first()
            .click();
        await userDetailPage.confirmButton('Revoke').click();

        await expect.poll(() => sessions.revoked.length).toBe(1);
    });

    test('renders the activity timeline with per-action entries', async ({
        page,
        userDetailPage
    }) => {
        await mockActivity(page, [
            {
                id: 'ev_role',
                kind: 'user.role_changed',
                subjectType: 'user',
                subjectId: 'u_grace',
                actorId: 'u_ada',
                actorEmail: 'ada@ortha.dev',
                meta: { from: 'viewer', to: 'contributor' },
                at: '2026-06-10T10:00:00.000Z'
            }
        ]);
        await userDetailPage.goto('u_grace');
        await userDetailPage.openTab('Activity');

        await expect(page.getByText('Role changed')).toBeVisible();
        await expect(page.getByText('by ada@ortha.dev')).toBeVisible();
    });

    test('shows workspace membership events in the personal log', async ({
        page,
        userDetailPage
    }) => {
        // The member was removed from a workspace — recorded against them
        // (subjectType=user), so it appears in their own activity timeline.
        await mockActivity(page, [
            {
                id: 'ev_ws',
                kind: 'workspace.member_removed',
                subjectType: 'user',
                subjectId: 'u_grace',
                actorId: 'u_ada',
                actorEmail: 'ada@ortha.dev',
                meta: { workspaceId: 'ws_docs', email: 'grace@ortha.dev' },
                at: '2026-06-11T09:00:00.000Z'
            }
        ]);
        await userDetailPage.goto('u_grace');
        await userDetailPage.openTab('Activity');

        await expect(
            page.getByText('Removed from a workspace')
        ).toBeVisible();
    });

    test('hides audit and access tabs without users:update', async ({
        page,
        userDetailPage
    }) => {
        // A viewer holds users:read (can see the page) but not users:update.
        await mockSignedIn(page, { permissions: ['users:read'] });
        await userDetailPage.goto('u_grace');

        await expect(userDetailPage.tab('General')).toBeVisible();
        await expect(userDetailPage.tab('Sessions')).toHaveCount(0);
        await expect(userDetailPage.tab('Sign-in access')).toHaveCount(0);
    });
});
