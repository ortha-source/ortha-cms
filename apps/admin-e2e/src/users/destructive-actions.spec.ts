import { test, expect } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import {
    DEFAULT_MEMBERS,
    mockMembers,
    spyResendInvite,
    spyRevokeInvite,
    spySetMemberStatus
} from '../support/api/members';

/** Alan — the roster's one pending invite, the only member Revoke applies to. */
const PENDING_MEMBER = DEFAULT_MEMBERS.filter(
    (member) => member.status === 'pending'
)[0];

/** Grace — an ordinary active member, so no guardrail blocks Disable. */
const ACTIVE_MEMBER = DEFAULT_MEMBERS.find(
    (member) => member.id === 'u_grace'
)!;

/**
 * The row menu's two irreversible actions. Revoking **deletes** the pending
 * account (cascading its token and workspace assignments) and Disable locks a
 * person out and kills their sessions — so both are confirmed, both name their
 * target, and neither may leave focus on `<body>` when the row disappears.
 *
 * These exist because the actions previously fired straight off `onSelect`: one
 * stray arrow key past "Resend invite" destroyed an account with no dialog, no
 * undo, and the first feedback arriving in a success toast afterwards.
 */
test.describe('Destructive member actions', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockMembers(page);
    });

    test('confirms before revoking an invite, naming the invitee', async ({
        membersPage,
        page
    }) => {
        const revoke = await spyRevokeInvite(page);
        await membersPage.goto();

        await membersPage.openActions(PENDING_MEMBER.email);
        await membersPage.menuItem('Revoke invite').click();

        // A dialog, not a fait accompli.
        await expect(
            membersPage.confirmTitle('Delete this invite permanently?')
        ).toBeVisible();
        // The description has to identify who — the menu is long gone.
        await expect(membersPage.confirmDialog()).toContainText(
            PENDING_MEMBER.email
        );
        expect(revoke.count).toBe(0);
    });

    test('sends nothing when the revoke confirmation is cancelled', async ({
        membersPage,
        page
    }) => {
        const revoke = await spyRevokeInvite(page);
        await membersPage.goto();

        await membersPage.openActions(PENDING_MEMBER.email);
        await membersPage.menuItem('Revoke invite').click();
        await membersPage.confirmAction('Cancel').click();

        await expect(membersPage.confirmDialog()).toHaveCount(0);
        expect(revoke.count).toBe(0);
        // The account is still there.
        await expect(membersPage.row(PENDING_MEMBER.email)).toBeVisible();
    });

    test('sends exactly one request when the revoke is confirmed', async ({
        membersPage,
        page
    }) => {
        const revoke = await spyRevokeInvite(page);
        await membersPage.goto();

        await membersPage.openActions(PENDING_MEMBER.email);
        await membersPage.menuItem('Revoke invite').click();
        await membersPage.confirmAction('Delete invite').click();

        await expect.poll(() => revoke.count).toBe(1);
    });

    test('moves focus to a stable anchor after the row is removed', async ({
        membersPage,
        page
    }) => {
        await spyRevokeInvite(page);
        await membersPage.goto();

        await membersPage.openActions(PENDING_MEMBER.email);
        await membersPage.menuItem('Revoke invite').click();
        await membersPage.confirmAction('Delete invite').click();
        await expect(membersPage.confirmDialog()).toHaveCount(0);

        // The kebab that opened the dialog unmounts with its row, so Radix has
        // nothing to restore to and focus falls to `<body>` — restarting a
        // keyboard user at the top of the document (WCAG 2.4.3).
        await expect(membersPage.tableAnchor()).toBeFocused();
        await expect(page.locator('body:focus')).toHaveCount(0);
    });

    test('confirms before disabling a member, naming them', async ({
        membersPage,
        page
    }) => {
        const status = await spySetMemberStatus(page, ACTIVE_MEMBER);
        await membersPage.goto();

        await membersPage.openActions(ACTIVE_MEMBER.name!);
        await membersPage.menuItem('Disable').click();

        await expect(
            membersPage.confirmTitle(`Disable ${ACTIVE_MEMBER.name}?`)
        ).toBeVisible();
        expect(status.disabled).toBe(0);

        await membersPage.confirmAction('Disable').click();
        await expect.poll(() => status.disabled).toBe(1);
    });

    test('returns focus to the row’s own kebab when the row survives', async ({
        membersPage,
        page
    }) => {
        await spySetMemberStatus(page, ACTIVE_MEMBER);
        await membersPage.goto();

        await membersPage.openActions(ACTIVE_MEMBER.name!);
        await membersPage.menuItem('Disable').click();
        await membersPage.confirmAction('Disable').click();
        await expect(membersPage.confirmDialog()).toHaveCount(0);

        // Disabling only flips the status pill, so the kebab is still mounted
        // and is where the user was.
        await expect(
            membersPage.actionsTrigger(ACTIVE_MEMBER.name!)
        ).toBeFocused();
    });

    test('warns before discarding an uncopied invite link', async ({
        membersPage,
        page
    }) => {
        await spyResendInvite(page, PENDING_MEMBER);
        await membersPage.goto();

        await membersPage.openActions(PENDING_MEMBER.email);
        await membersPage.menuItem('Resend invite').click();
        await expect(membersPage.inviteLinkDialog()).toBeVisible();

        // Esc is the reflex, and the resend has *already* rotated the token —
        // losing this dialog leaves the invitee with a dead link and the admin
        // with no live one.
        await page.keyboard.press('Escape');

        await expect(membersPage.inviteLinkDialog()).toBeVisible();
        await expect(membersPage.inviteLinkDialog()).toContainText(
            'haven’t copied the link yet'
        );
        await expect(
            membersPage.inviteLinkField(PENDING_MEMBER.email)
        ).toBeVisible();
    });

    test('keeps the link on screen when the discard warning is declined', async ({
        membersPage,
        page
    }) => {
        await spyResendInvite(page, PENDING_MEMBER);
        await membersPage.goto();

        await membersPage.openActions(PENDING_MEMBER.email);
        await membersPage.menuItem('Resend invite').click();
        await page.keyboard.press('Escape');
        await membersPage.confirmAction('Keep it open').click();

        await expect(
            membersPage.inviteLinkField(PENDING_MEMBER.email)
        ).toBeVisible();
    });

    test('closes without a warning once the link has been copied', async ({
        membersPage,
        page,
        context
    }) => {
        await context.grantPermissions(['clipboard-read', 'clipboard-write']);
        await spyResendInvite(page, PENDING_MEMBER);
        await membersPage.goto();

        await membersPage.openActions(PENDING_MEMBER.email);
        await membersPage.menuItem('Resend invite').click();
        await membersPage.copyInviteLink().click();
        await expect(page.getByText('Invite link copied')).toBeVisible();
        await page.keyboard.press('Escape');

        // Captured, so there is nothing left to lose — no second prompt.
        await expect(membersPage.inviteLinkDialog()).toHaveCount(0);
    });
});
