import { test, expect } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import {
    DEFAULT_MEMBERS,
    mockMembers,
    spyInviteMany,
    type MemberSeed
} from '../support/api/members';
import { manyWorkspaces, mockWorkspaces } from '../support/api/workspaces';
import { mockMemberPage, mockUserDetail } from '../support/api/userDetail';

/** Thirty workspaces in the deployment… */
const WORKSPACES = manyWorkspaces(30);

/** …and Grace in twelve of them. */
const GRACE: MemberSeed = {
    ...DEFAULT_MEMBERS.find((member) => member.id === 'u_grace')!,
    workspaces: WORKSPACES.slice(0, 12).map((workspace) => ({
        id: workspace.id,
        name: workspace.name,
        description: workspace.description,
        color: workspace.color
    }))
};
const ROSTER = DEFAULT_MEMBERS.map((member) =>
    member.id === GRACE.id ? GRACE : member
);

/**
 * The members screens with **many** workspaces: the invite page's tiles get a
 * search and a capped, scrolling box; the Overview lists five and links to the
 * rest; the Workspaces tab is a compact list with a search past ten; the add
 * dialog keeps each option to one line.
 */
test.describe('Members with many workspaces', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockMembers(page, ROSTER);
        await mockWorkspaces(page, WORKSPACES);
        await mockMemberPage(page);
        await mockUserDetail(page, ROSTER);
    });

    test('invite: search narrows the tiles, and a ticked one stays ticked out of view', async ({
        membersPage,
        page
    }) => {
        const invite = await spyInviteMany(page);
        await page.goto('/users/invite');

        await membersPage.inviteWorkspace('Workspace 3', true).click();
        await expect(membersPage.inviteSelectedCount()).toHaveText(
            '1 selected'
        );

        await membersPage.inviteWorkspaceSearch().fill('Workspace 2');
        await expect(
            membersPage.inviteWorkspace('Workspace 20', true)
        ).toBeVisible();
        await expect(
            membersPage.inviteWorkspace('Workspace 3', true)
        ).toHaveCount(0);

        await membersPage.inviteWorkspaceSearch().fill('nothing-like-it');
        await expect(
            membersPage.invitePage().getByText('No workspaces match')
        ).toBeVisible();

        await membersPage.inviteWorkspaceSearch().fill('');
        await membersPage.addInviteEmails('lena@growth.io');
        await membersPage.sendInvites().click();
        await expect.poll(() => invite.count).toBe(1);
        expect(invite.bodies[0].workspaceIds).toEqual(['ws_many_3']);
    });

    test('invite: the tiles scroll inside a capped box', async ({
        membersPage,
        page
    }) => {
        await page.goto('/users/invite');
        const box = membersPage.inviteWorkspaceBox();
        await expect(box).toBeVisible();
        // No DOM lib in this project, so the element is read structurally.
        const { height, scrollHeight } = await box.evaluate((element) => {
            const box = element as unknown as {
                clientHeight: number;
                scrollHeight: number;
            };
            return {
                height: box.clientHeight,
                scrollHeight: box.scrollHeight
            };
        });
        expect(height).toBeLessThanOrEqual(300);
        expect(scrollHeight).toBeGreaterThan(height);

        // "all workspaces" still ticks every one, visible or not.
        await membersPage.allWorkspaces().click();
        await expect(membersPage.inviteSelectedCount()).toHaveText(
            '30 selected'
        );
    });

    test('overview lists five workspaces and links to the rest', async ({
        userDetailPage,
        page
    }) => {
        await userDetailPage.goto(GRACE.id);
        const card = userDetailPage.card('Workspaces');
        await expect(card.getByRole('listitem')).toHaveCount(6);
        await expect(card).toContainText('12');

        await card
            .getByRole('link', {
                name: 'See all 12 of Grace Hopper’s workspaces'
            })
            .click();
        await expect(page).toHaveURL(/\/users\/u_grace\/workspaces$/);
    });

    test('the Workspaces tab is a compact list with a search past ten', async ({
        userDetailPage,
        page
    }) => {
        await userDetailPage.goto(GRACE.id);
        await userDetailPage.openTab('Workspaces');

        const list = page.getByRole('list', { name: 'Workspaces' });
        await expect(list.getByRole('listitem')).toHaveCount(12);
        await expect(
            page.getByRole('button', { name: 'Remove from Workspace 1' })
        ).toBeVisible();

        await page
            .getByRole('searchbox', { name: 'Search this member’s workspaces' })
            .fill('Workspace 1');
        // 1, 10, 11, 12.
        await expect(list.getByRole('listitem')).toHaveCount(4);
    });

    test('the add dialog keeps each description on one line, with the full text on hover', async ({
        userDetailPage,
        page
    }) => {
        await userDetailPage.goto(GRACE.id);
        await userDetailPage.openTab('Workspaces');
        await page.getByRole('button', { name: 'Add to workspace' }).click();

        const description = page
            .getByRole('dialog')
            .getByText('Seeded workspace number 13.');
        await expect(description).toHaveAttribute(
            'title',
            'Seeded workspace number 13.'
        );
        await expect(description).toHaveCSS('white-space', 'nowrap');
    });
});
