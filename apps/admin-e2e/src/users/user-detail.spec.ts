import { test, expect } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import { mockMembers } from '../support/api/members';
import { mockWorkspaces } from '../support/api/workspaces';
import {
    mockActivity,
    mockMemberPage,
    mockMemberSignIn,
    mockUserDetail,
    mockUserSessions,
    spyRevokeAllSessions,
    spyUpdateMember
} from '../support/api/userDetail';

/**
 * The member page (`/users/:id`, `@orthacms/users-admin`): the header, the
 * four tabs (Overview, Workspaces, Sessions & access, Activity), the
 * Overview's profile edit and summaries, session revocation, and
 * permission-gated tabs. Backed by the `mockUserDetail` /
 * `mockUserSessions` / activity mocks; `mockSignedIn` satisfies the shell's
 * auth probe and decides which tabs the rail shows.
 */
test.describe('User detail page', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockMembers(page);
        await mockWorkspaces(page);
        await mockMemberPage(page);
        await mockUserDetail(page);
    });

    test('renders the header and opens on Overview', async ({
        userDetailPage,
        page
    }) => {
        await userDetailPage.goto('u_grace');
        await expect(userDetailPage.nav).toBeVisible();
        await expect(userDetailPage.heading('Grace Hopper')).toBeVisible();
        await expect(page).toHaveURL(/\/users\/u_grace\/overview$/);
        // Status, role, address and last activity on one line.
        await expect(page.getByText('Active 1 h ago')).toBeVisible();
        await expect(page.getByText('Member since Jan 2026')).toBeVisible();
        await expect(userDetailPage.changeRoleButton()).toBeVisible();
        await expect(userDetailPage.nameInput()).toHaveValue('Grace Hopper');
    });

    test('has four tabs, not seven', async ({ userDetailPage }) => {
        await userDetailPage.goto('u_grace');
        await expect(userDetailPage.rail.getByRole('link')).toHaveText([
            'Overview',
            'Workspaces',
            'Sessions & access',
            'Activity'
        ]);
    });

    test('sends the old tab paths somewhere sensible', async ({
        userDetailPage,
        page
    }) => {
        await page.goto('/users/u_grace/general');
        await expect(page).toHaveURL(/\/users\/u_grace\/overview$/);
        await page.goto('/users/u_grace/roles');
        await expect(page).toHaveURL(/\/users\/u_grace\/overview$/);
        await page.goto('/users/u_grace/sessions');
        await expect(page).toHaveURL(/\/users\/u_grace\/access$/);
        await expect(userDetailPage.sessionsCardHeader()).toBeVisible();
    });

    test('summarises workspaces, sign-in and recent activity, each with a way in', async ({
        userDetailPage,
        page
    }) => {
        await mockActivity(page, [
            {
                id: 'ev_pub',
                kind: 'entry.published',
                subjectType: 'entry',
                subjectId: 'e1',
                actorId: 'u_grace',
                actorEmail: 'grace@orthacms.dev',
                meta: { title: 'Spring launch' },
                at: new Date(Date.now() - 3_600_000).toISOString()
            }
        ]);
        await userDetailPage.goto('u_grace');

        await expect(userDetailPage.card('Workspaces')).toContainText(
            'Product docs'
        );
        await expect(userDetailPage.card('Sign-in')).toContainText(
            '2 active sessions'
        );
        await expect(userDetailPage.card('Sign-in')).toContainText(
            'Password set · SSO: Google'
        );
        await expect(userDetailPage.card('Recent activity')).toContainText(
            'Spring launch'
        );

        await page
            .getByRole('link', {
                name: 'Manage Grace Hopper’s sessions and access'
            })
            .click();
        await expect(page).toHaveURL(/\/users\/u_grace\/access$/);
        await userDetailPage.openTab('Overview');
        await page
            .getByRole('link', { name: 'See all of Grace Hopper’s activity' })
            .click();
        await expect(page).toHaveURL(/\/users\/u_grace\/activity$/);
    });

    test('says an invitee has no way to sign in yet', async ({
        userDetailPage,
        page
    }) => {
        await mockMemberSignIn(page, { hasPassword: false, ssoProviders: [] });
        await userDetailPage.goto('u_alan');
        await expect(userDetailPage.card('Sign-in')).toContainText(
            'Invite not accepted yet'
        );
        // The header says when the invite went out instead of "Member since".
        await expect(page.getByText(/^Invited /)).toBeVisible();
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

    test('returns to the roster through the "Members" breadcrumb', async ({
        membersPage,
        userDetailPage,
        page
    }) => {
        await userDetailPage.goto('u_grace');
        await expect(userDetailPage.heading('Grace Hopper')).toBeVisible();

        await userDetailPage.membersCrumb().click();

        await expect(page).toHaveURL(/\/users$/);
        await expect(membersPage.heading).toBeVisible();
    });

    test('a member that no longer exists still links back to the roster', async ({
        membersPage,
        userDetailPage,
        page
    }) => {
        // The not-found state has no hero to hang a way out on, so the
        // breadcrumb has to stay a link there too, not collapse to a label.
        await userDetailPage.goto('u_nobody');
        await expect(userDetailPage.notFoundAlert()).toBeVisible();

        await userDetailPage.membersCrumb().click();

        await expect(page).toHaveURL(/\/users$/);
        await expect(membersPage.heading).toBeVisible();
    });

    test('opens the Workspaces tab from the row menu', async ({
        membersPage,
        userDetailPage,
        page
    }) => {
        await membersPage.goto();
        await page
            .getByRole('button', { name: 'Actions for Grace Hopper' })
            .click();
        await page.getByRole('menuitem', { name: 'Workspaces…' }).click();
        await expect(page).toHaveURL(/\/users\/u_grace\/workspaces/);
        await expect(userDetailPage.heading('Grace Hopper')).toBeVisible();
    });

    test('navigates between the tabs', async ({ userDetailPage, page }) => {
        await userDetailPage.goto('u_grace');
        await userDetailPage.openTab('Workspaces');
        await expect(page).toHaveURL(/\/users\/u_grace\/workspaces/);
        await userDetailPage.openTab('Sessions & access');
        await expect(page).toHaveURL(/\/users\/u_grace\/access/);
        await userDetailPage.openTab('Activity');
        await expect(page).toHaveURL(/\/users\/u_grace\/activity/);
        await userDetailPage.openTab('Overview');
        await expect(page).toHaveURL(/\/users\/u_grace\/overview/);
    });

    test('signs the member out everywhere from Sessions & access', async ({
        userDetailPage,
        page
    }) => {
        const revokeAll = await spyRevokeAllSessions(page, 2);
        await userDetailPage.goto('u_grace');
        await userDetailPage.openTab('Sessions & access');

        await userDetailPage.signOutEverywhere().click();
        await userDetailPage.confirmButton('Sign out everywhere').click();

        await expect.poll(() => revokeAll.count).toBe(1);
        await expect(page.getByText('Ended 2 sessions.')).toBeVisible();
        await expect(userDetailPage.sessionsCardHeader()).toBeFocused();
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
        await userDetailPage.openTab('Sessions & access');

        await expect(page.getByText('Chrome on macOS')).toBeVisible();
        // The accessible name carries the device, so each row's Revoke is
        // distinguishable — see the a11y assertion below.
        await page
            .getByRole('button', {
                name: /Revoke the session on Chrome on macOS/
            })
            .click();
        await userDetailPage.confirmButton('Revoke').click();

        await expect.poll(() => sessions.revoked.length).toBe(1);
    });

    test('names the device in each session control and in its confirm dialog', async ({
        userDetailPage,
        page
    }) => {
        await mockUserSessions(page);
        await userDetailPage.goto('u_grace');
        await userDetailPage.openTab('Sessions & access');

        // Two rows, two distinct accessible names: an unnamed "Revoke this
        // session" on both would leave a screen-reader user unable to tell
        // which device they are about to sign out (WCAG 2.4.6 / 4.1.2).
        await expect(
            page.getByRole('button', {
                name: /Revoke the session on Chrome on macOS/
            })
        ).toBeVisible();
        await expect(
            page.getByRole('button', {
                name: /Revoke the session on Firefox on Linux/
            })
        ).toBeVisible();

        await page
            .getByRole('button', {
                name: /Revoke the session on Firefox on Linux/
            })
            .click();

        // The dialog's accessible name is its title, so the device has to be
        // in the title — not only in the card behind the overlay.
        await expect(
            page.getByRole('heading', {
                name: 'Revoke the session on Firefox on Linux?'
            })
        ).toBeVisible();
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
                actorEmail: 'ada@orthacms.dev',
                meta: { from: 'viewer', to: 'contributor' },
                at: '2026-06-10T10:00:00.000Z'
            }
        ]);
        await userDetailPage.goto('u_grace');
        await userDetailPage.openTab('Activity');

        // The label comes from `activity-admin`'s one kind->label catalogue,
        // shared with the global Activity Log — this tab used to keep its own
        // twelve-kind map and print the raw wire kind for everything else.
        await expect(page.getByText('Changed role')).toBeVisible();
        await expect(page.getByText('by ada@orthacms.dev')).toBeVisible();
    });

    test('names every kind the member touched, not just the user.* ones', async ({
        page,
        userDetailPage
    }) => {
        // The tab's query is "about **or by** this member", so an admin's own
        // timeline surfaces whatever they did — media, tokens, content grants.
        // Its private label map knew twelve kinds, so 14 of 25 rows on a real
        // admin's page rendered as raw dotted wire tokens.
        await mockActivity(
            page,
            [
                'media.asset.uploaded',
                'token.created',
                'workspace.content_granted',
                'user.activated'
            ].map((kind, index) => ({
                id: `ev_${index}`,
                kind,
                subjectType: 'user',
                subjectId: 'u_grace',
                actorId: 'u_grace',
                actorEmail: 'grace@orthacms.dev',
                meta: null,
                at: `2026-06-1${index}T09:00:00.000Z`
            }))
        );
        await userDetailPage.goto('u_grace');
        await userDetailPage.openTab('Activity');

        await expect(page.getByText('Uploaded asset')).toBeVisible();
        await expect(page.getByText('Created API token')).toBeVisible();
        await expect(page.getByText('Granted content access')).toBeVisible();
        await expect(page.getByText('Activated account')).toBeVisible();
        await expect(page.getByText('media.asset.uploaded')).toHaveCount(0);
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
                actorEmail: 'ada@orthacms.dev',
                meta: { workspaceId: 'ws_docs', email: 'grace@orthacms.dev' },
                at: '2026-06-11T09:00:00.000Z'
            }
        ]);
        await userDetailPage.goto('u_grace');
        await userDetailPage.openTab('Activity');

        await expect(page.getByText('Removed workspace member')).toBeVisible();
    });

    test('hides audit and access tabs without users:update', async ({
        page,
        userDetailPage
    }) => {
        // A viewer holds users:read (can see the page) but not users:update.
        await mockSignedIn(page, { permissions: ['users:read'] });
        await userDetailPage.goto('u_grace');

        await expect(userDetailPage.tab('Overview')).toBeVisible();
        await expect(userDetailPage.tab('Sessions & access')).toHaveCount(0);
        // Nor the controls that need the permission, nor the sign-in card.
        await expect(userDetailPage.changeRoleButton()).toHaveCount(0);
        await expect(userDetailPage.card('Sign-in')).toHaveCount(0);
        await expect(userDetailPage.nameInput()).toBeDisabled();
        // A deep link is turned back too.
        await page.goto('/users/u_grace/access');
        await expect(page).toHaveURL(/\/users\/u_grace\/overview$/);
    });
});
