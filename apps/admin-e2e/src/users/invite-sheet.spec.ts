import { test, expect } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import { mockMembers, spyInviteMany } from '../support/api/members';
import {
    mockWorkspaces,
    mockWorkspacesUnavailable
} from '../support/api/workspaces';
import { expectNoA11yViolations } from '../support/a11y';

/**
 * The invite sheet (`/users/invite`, `@orthacms/users-admin`): several people
 * from one sheet — addresses as chips, one role, workspaces as tiles — then a
 * link per person. Backed by `spyInviteMany` (`POST /api/users/invites/batch`);
 * the "already a member" check reads the ordinary `GET /api/users` mock with an
 * `email in […]` filter.
 */
test.describe('Invite sheet', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockMembers(page);
        await mockWorkspaces(page);
    });

    test('opens over the roster from the header, as its own route', async ({
        membersPage,
        page
    }) => {
        await membersPage.goto();
        await membersPage.inviteButton.click();

        await expect(page).toHaveURL(/\/users\/invite$/);
        await expect(membersPage.inviteSheet()).toBeVisible();
        // The roster is still underneath — it is a sheet, not a page.
        await expect(membersPage.heading).toBeAttached();
        // Contributor is the default role.
        await expect(membersPage.inviteRole('Contributor')).toBeChecked();
    });

    test('a deep link to /users/invite opens the sheet', async ({
        membersPage,
        page
    }) => {
        await page.goto('/users/invite');
        await expect(membersPage.inviteSheet()).toBeVisible();
    });

    test('turns a pasted list into one chip per address', async ({
        membersPage
    }) => {
        await membersPage.goto();
        await membersPage.inviteButton.click();

        await membersPage.addInviteEmails(
            'lena@growth.io, Sam@Growth.io; kai@growth.io'
        );

        await expect(membersPage.emailChip('lena@growth.io')).toBeVisible();
        // Lower-cased, as the server compares them.
        await expect(membersPage.emailChip('sam@growth.io')).toBeVisible();
        await expect(membersPage.emailChip('kai@growth.io')).toBeVisible();
        await expect(membersPage.sendInvites()).toHaveText(/Send 3 invites/);
        await expect(membersPage.inviteSummary()).toHaveText(
            '3 people · Contributor · no workspaces'
        );

        await membersPage.removeEmailChip('kai@growth.io').click();
        await expect(membersPage.emailChip('kai@growth.io')).toHaveCount(0);
        await expect(membersPage.sendInvites()).toHaveText(/Send 2 invites/);
    });

    test('flags an address that already belongs to a member, before sending', async ({
        membersPage,
        page
    }) => {
        const invite = await spyInviteMany(page);
        await membersPage.goto();
        await membersPage.inviteButton.click();

        await membersPage.addInviteEmails(
            'lena@growth.io, sam@growth.io, ada@orthacms.dev'
        );

        await expect(
            membersPage.inviteFieldError(
                'ada@orthacms.dev is already a member — remove it to continue.'
            )
        ).toBeVisible();
        await expect(membersPage.emailChip('ada@orthacms.dev')).toHaveAttribute(
            'data-flagged',
            'true'
        );
        // The button says how many would go out, and waits for the fix.
        await expect(membersPage.sendInvites()).toHaveText(/Send 2 invites/);
        await expect(membersPage.sendInvites()).toBeDisabled();

        await membersPage.removeEmailChip('ada@orthacms.dev').click();
        await expect(membersPage.sendInvites()).toBeEnabled();
        expect(invite.count).toBe(0);
    });

    test('flags a malformed address and sends nothing', async ({
        membersPage,
        page
    }) => {
        const invite = await spyInviteMany(page);
        await membersPage.goto();
        await membersPage.inviteButton.click();

        await membersPage.addInviteEmails('not-an-email');

        await expect(
            membersPage.inviteFieldError('not-an-email isn’t an email address.')
        ).toBeVisible();
        await expect(membersPage.sendInvites()).toBeDisabled();
        expect(invite.count).toBe(0);
    });

    test('asks for an address when Send is pressed with none', async ({
        membersPage,
        page
    }) => {
        const invite = await spyInviteMany(page);
        await membersPage.goto();
        await membersPage.inviteButton.click();

        await membersPage.sendInvites().click();

        await expect(
            membersPage.inviteFieldError('Add at least one email address.')
        ).toBeVisible();
        expect(invite.count).toBe(0);
    });

    test('sends one batch with the role and workspaces, then shows a link per person', async ({
        membersPage,
        page
    }) => {
        const invite = await spyInviteMany(page);
        await membersPage.goto();
        await membersPage.inviteButton.click();

        await membersPage.addInviteEmails('lena@growth.io, sam@growth.io');
        await membersPage.inviteRole('Viewer').check();
        await membersPage.inviteWorkspace('Marketing site').click();
        await membersPage.sendInvites().click();

        await expect(membersPage.inviteSentHeading()).toHaveText(
            '2 invites created'
        );
        expect(invite.bodies).toEqual([
            {
                emails: ['lena@growth.io', 'sam@growth.io'],
                role: 'viewer',
                workspaceIds: [expect.any(String)]
            }
        ]);
        await expect(
            membersPage.inviteSheet().getByText(/expire in 7 days/)
        ).toBeVisible();
        await expect(membersPage.inviteLinkField('lena@growth.io')).toHaveValue(
            /\/identity\/accept-invite\?token=tok_lena$/
        );
        await expect(membersPage.inviteLinkField('sam@growth.io')).toHaveValue(
            /token=tok_sam$/
        );
        await expect(
            membersPage.inviteSheet().getByText('Viewer · Marketing site')
        ).toHaveCount(2);
    });

    test('"all workspaces" ticks every workspace there is', async ({
        membersPage
    }) => {
        await membersPage.goto();
        await membersPage.inviteButton.click();

        await membersPage.allWorkspaces().click();

        await expect(
            membersPage.inviteWorkspace('Marketing site')
        ).toBeChecked();
        await expect(membersPage.inviteWorkspace('Product docs')).toBeChecked();
    });

    test('a collision the server catches lands on the chip too', async ({
        membersPage,
        page
    }) => {
        // Someone joined between the live check and Send: the server's 409
        // names the address, and nobody was invited.
        const invite = await spyInviteMany(page, { taken: ['lena@growth.io'] });
        await membersPage.goto();
        await membersPage.inviteButton.click();

        await membersPage.addInviteEmails('lena@growth.io');
        await membersPage.sendInvites().click();

        await expect.poll(() => invite.count).toBe(1);
        await expect(
            membersPage.inviteFieldError(/lena@growth.io is already a member/)
        ).toBeVisible();
        await expect(membersPage.inviteSentHeading()).toHaveCount(0);
    });

    test('says so when a mailer sent the links instead', async ({
        membersPage,
        page
    }) => {
        await spyInviteMany(page, { mailed: true });
        await membersPage.goto();
        await membersPage.inviteButton.click();

        await membersPage.addInviteEmails('lena@growth.io, sam@growth.io');
        await membersPage.sendInvites().click();

        await expect(
            membersPage.inviteSheet().getByText('Emails sent to 2 people.')
        ).toBeVisible();
        await expect(membersPage.inviteLinkField('lena@growth.io')).toHaveCount(
            0
        );
        // Nothing to lose, so Done just closes.
        await membersPage.sheetButton('Done').click();
        await expect(membersPage.inviteSheet()).toHaveCount(0);
        await expect(page).toHaveURL(/\/users$/);
    });

    test('Done asks first while a link was never copied', async ({
        membersPage,
        page
    }) => {
        await spyInviteMany(page);
        await membersPage.goto();
        await membersPage.inviteButton.click();
        await membersPage.addInviteEmails('lena@growth.io');
        await membersPage.sendInvites().click();
        await expect(membersPage.inviteSentHeading()).toBeVisible();

        await membersPage.sheetButton('Done').click();
        await expect(
            membersPage.inviteSheet().getByText(/hasn’t been copied yet/)
        ).toBeVisible();
        // Esc is the same exit, and is held the same way.
        await page.keyboard.press('Escape');
        await expect(membersPage.inviteSheet()).toBeVisible();

        await membersPage.sheetButton('Keep it open').click();
        await expect(
            membersPage.inviteLinkField('lena@growth.io')
        ).toBeVisible();

        await membersPage.sheetButton('Done').click();
        await membersPage.sheetButton('Leave without copying').click();
        await expect(membersPage.inviteSheet()).toHaveCount(0);
    });

    test('closes freely once every link was copied, and Invite more starts over', async ({
        membersPage,
        page,
        context
    }) => {
        await context.grantPermissions(['clipboard-read', 'clipboard-write']);
        await spyInviteMany(page);
        await membersPage.goto();
        await membersPage.inviteButton.click();
        await membersPage.addInviteEmails('lena@growth.io');
        await membersPage.sendInvites().click();

        await membersPage.copyInviteLinkFor('lena@growth.io').click();
        await expect(
            membersPage.inviteSheet().getByText('Copied', { exact: true })
        ).toBeVisible();

        await membersPage.sheetButton('Invite more').click();
        await expect(membersPage.inviteEmails()).toBeVisible();
        await expect(membersPage.emailChip('lena@growth.io')).toHaveCount(0);

        await membersPage.sheetButton('Cancel').click();
        await expect(membersPage.inviteSheet()).toHaveCount(0);
    });

    test('offers a retry when the workspaces could not be read', async ({
        membersPage,
        page
    }) => {
        await mockWorkspacesUnavailable(page, 403);
        await membersPage.goto();
        await membersPage.inviteButton.click();

        await expect(membersPage.workspacesError()).toBeVisible();

        await mockWorkspaces(page);
        await membersPage.retryWorkspaces().click();
        await expect(
            membersPage.inviteWorkspace('Marketing site')
        ).toBeVisible();
    });

    test('is not offered without users:create', async ({
        membersPage,
        page
    }) => {
        await mockSignedIn(page, { permissions: ['users:read'] });
        await page.goto('/users/invite');
        await expect(membersPage.heading).toBeVisible();
        await expect(membersPage.inviteSheet()).toHaveCount(0);
    });

    test('accessibility — composing, with a flagged address', async ({
        membersPage,
        makeAxe
    }) => {
        await membersPage.goto();
        await membersPage.inviteButton.click();
        await membersPage.addInviteEmails('ada@orthacms.dev, lena@growth.io');
        await membersPage.inviteFieldError(/already a member/).waitFor();
        await expectNoA11yViolations(makeAxe());
    });

    test('accessibility — the links step', async ({
        membersPage,
        page,
        makeAxe
    }) => {
        await spyInviteMany(page);
        await membersPage.goto();
        await membersPage.inviteButton.click();
        await membersPage.addInviteEmails('lena@growth.io');
        await membersPage.sendInvites().click();
        await membersPage.inviteSentHeading().waitFor();
        await expectNoA11yViolations(makeAxe());
    });
});
