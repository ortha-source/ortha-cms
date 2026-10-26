import { test, expect } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import {
    DEFAULT_MEMBERS,
    mockMembers,
    spyResendInvite,
    spyRevokeInvite,
    spySetMemberStatus
} from '../support/api/members';
import { mockWorkspaces } from '../support/api/workspaces';
import {
    mockMemberPage,
    mockUserDetail,
    mockUserSessions,
    spyRevokeAllSessions
} from '../support/api/userDetail';

/** Alan — the roster's one pending invite, the only member Revoke applies to. */
const PENDING_MEMBER = DEFAULT_MEMBERS.filter(
    (member) => member.status === 'pending'
)[0];

/** Grace — an ordinary active member, so no guardrail blocks Suspend. */
const ACTIVE_MEMBER = DEFAULT_MEMBERS.find(
    (member) => member.id === 'u_grace'
)!;

/** Ada — the sole active admin, so the guardrail vetoes suspending her. */
const LAST_ADMIN = DEFAULT_MEMBERS.find((member) => member.isLastAdmin)!;

/** The reason the sole-admin guardrail gives, verbatim. */
const LAST_ADMIN_REASON =
    'Ada is the last admin — make someone else admin first.';

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
        await expect(membersPage.resultsAnchor()).toBeFocused();
        await expect(page.locator('body:focus')).toHaveCount(0);
    });

    test('keeps focus when revoking the last row empties the table', async ({
        membersPage,
        page
    }) => {
        // Narrow the roster to exactly the pending invite, so confirming swaps
        // the table for the empty state. An anchor that lived on the table would
        // unmount at precisely the moment focus needed somewhere to land — which
        // is how this slipped through the first fix, whose spec always left
        // other rows behind.
        const roster = [{ ...PENDING_MEMBER }];
        await mockMembers(page, roster);
        await spyRevokeInvite(page, roster);
        await page.goto(`/users?search=${PENDING_MEMBER.email}`);
        await expect(membersPage.row(PENDING_MEMBER.email)).toBeVisible();

        await membersPage.openActions(PENDING_MEMBER.email);
        await membersPage.menuItem('Revoke invite').click();
        await membersPage.confirmAction('Delete invite').click();
        await expect(membersPage.confirmDialog()).toHaveCount(0);

        // The table is gone; the anchor is not.
        await expect(page.locator('table')).toHaveCount(0);
        await expect(membersPage.resultsAnchor()).toBeFocused();
        await expect(page.locator('body:focus')).toHaveCount(0);
    });

    test('confirms before suspending a member, naming them', async ({
        membersPage,
        page
    }) => {
        const status = await spySetMemberStatus(page, ACTIVE_MEMBER);
        await membersPage.goto();

        await membersPage.openActions(ACTIVE_MEMBER.name!);
        await membersPage.menuItem('Suspend').click();

        await expect(
            membersPage.confirmTitle(`Suspend ${ACTIVE_MEMBER.name}?`)
        ).toBeVisible();
        expect(status.disabled).toBe(0);

        await membersPage.confirmAction('Suspend member').click();
        await expect.poll(() => status.disabled).toBe(1);
    });

    test('returns focus to the row’s own kebab when the row survives', async ({
        membersPage,
        page
    }) => {
        await spySetMemberStatus(page, ACTIVE_MEMBER);
        await membersPage.goto();

        await membersPage.openActions(ACTIVE_MEMBER.name!);
        await membersPage.menuItem('Suspend').click();
        await membersPage.confirmAction('Suspend member').click();
        await expect(membersPage.confirmDialog()).toHaveCount(0);

        // Suspending only flips the status badge, so the kebab is still mounted
        // and is where the user was.
        await expect(
            membersPage.actionsTrigger(ACTIVE_MEMBER.name!)
        ).toBeFocused();
    });

    test('leaves the sole admin’s Suspend and Change role inert, with the reason written inline [users:I-16]', async ({
        membersPage,
        page
    }) => {
        // The guardrail the row menu shares with the server: demoting or
        // disabling the last active admin is the one action that can lock
        // everyone out of the deployment, and the server answers it with
        // LAST_ADMIN_PROTECTED. Greying the item without saying why would leave
        // the admin guessing at a rule the API states outright (WCAG 3.3.1).
        const status = await spySetMemberStatus(page, LAST_ADMIN);
        await membersPage.goto();

        await membersPage.openActions(LAST_ADMIN.name!);
        const disable = membersPage.menuItem('Suspend');
        const changeRole = membersPage.menuItem('Change role');

        // Radix's real `disabled` would skip the item in keyboard navigation,
        // so it is inert by `aria-disabled` instead — still reachable, so the
        // reason can be heard. That flag is what makes the item unclickable to
        // every caller that honours ARIA, Playwright included.
        await expect(disable).toBeDisabled();
        await expect(changeRole).toBeDisabled();
        // The reason is written in the menu, not a hover-only tooltip, and it
        // is each item's description — written once, shared by both.
        await expect(membersPage.menuReason(LAST_ADMIN_REASON)).toBeVisible();
        await expect(disable).toHaveAccessibleDescription(LAST_ADMIN_REASON);
        await expect(changeRole).toHaveAccessibleDescription(LAST_ADMIN_REASON);

        // Force past the actionability check to prove the second guard too:
        // Radix still delivers `onSelect`, and the handler's `preventDefault()`
        // is what keeps the menu open and the request unsent.
        await disable.click({ force: true });
        await expect(disable).toBeVisible();
        await expect(membersPage.confirmDialog()).toHaveCount(0);
        expect(status.disabled).toBe(0);
    });

    test('puts focus back on the kebab when the suspend fails', async ({
        membersPage,
        page
    }) => {
        // A refused write is where focus is easiest to lose: the dialog closes,
        // but nothing was removed, so there is a kebab to go back to and no
        // excuse for landing on `<body>`. The toast is the only account of what
        // happened — the row still reads "Active".
        const status = await spySetMemberStatus(page, ACTIVE_MEMBER, {
            status: 500
        });
        await membersPage.goto();

        await membersPage.openActions(ACTIVE_MEMBER.name!);
        await membersPage.menuItem('Suspend').click();
        await membersPage.confirmAction('Suspend member').click();

        await expect(
            membersPage.toast('Something went wrong. Please try again.')
        ).toBeVisible();
        // The request was made and refused — not a click that never left.
        await expect.poll(() => status.disabled).toBe(1);
        await expect(membersPage.confirmDialog()).toHaveCount(0);
        await expect(
            membersPage.actionsTrigger(ACTIVE_MEMBER.name!)
        ).toBeFocused();
        await expect(page.locator('body:focus')).toHaveCount(0);
    });

    test('walks the whole row menu from the keyboard, and closes on Escape', async ({
        membersPage,
        page
    }) => {
        // The menu groups navigation and actions under separate headings, and
        // arrow keys have to cross those group boundaries — a keyboard user who
        // cannot reach the last item cannot suspend anyone.
        await membersPage.goto();
        await membersPage.actionsTrigger(ACTIVE_MEMBER.name!).focus();
        await page.keyboard.press('Enter');

        const items = page.getByRole('menuitem');
        const total = await items.count();
        expect(total).toBeGreaterThan(1);

        // Arrow down `total` times: the last press wraps back to the first, so
        // every item in between was reachable.
        for (let i = 1; i < total; i += 1) {
            await page.keyboard.press('ArrowDown');
            await expect(items.nth(i)).toBeFocused();
        }

        await page.keyboard.press('Escape');
        await expect(items).toHaveCount(0);
        // Radix hands focus back to the trigger, which is still mounted.
        await expect(
            membersPage.actionsTrigger(ACTIVE_MEMBER.name!)
        ).toBeFocused();
    });

    test('returns focus to the sessions card once a revoked row unmounts', async ({
        userDetailPage,
        page
    }) => {
        // Same shape as the roster's anchor, one screen over: the card that
        // opened the dialog is the card the revoke deletes, so Radix restores
        // focus to something that no longer exists. The tab aims at its own
        // header instead.
        await mockWorkspaces(page);
        await mockUserDetail(page);
        await mockMemberPage(page);
        const sessions = await mockUserSessions(page);

        await userDetailPage.goto('u_grace');
        await userDetailPage.openTab('Sessions & access');
        await page
            .getByRole('button', {
                name: /Revoke the session on Chrome on macOS/
            })
            .click();
        await userDetailPage.confirmButton('Revoke').click();
        await expect.poll(() => sessions.revoked.length).toBe(1);

        await expect(userDetailPage.sessionsCardHeader()).toBeFocused();
        await expect(page.locator('body:focus')).toHaveCount(0);
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

    test('signs a member out everywhere from the row, behind a confirm', async ({
        membersPage,
        page
    }) => {
        const revokeAll = await spyRevokeAllSessions(page, 2);
        await membersPage.goto();

        await membersPage.openActions(ACTIVE_MEMBER.name!);
        await membersPage.menuItem('Sign out everywhere').click();
        await expect(
            membersPage.confirmTitle(
                `Sign ${ACTIVE_MEMBER.name} out everywhere?`
            )
        ).toBeVisible();
        expect(revokeAll.count).toBe(0);

        await membersPage.confirmAction('Sign out everywhere').click();
        await expect.poll(() => revokeAll.count).toBe(1);
        await expect(
            membersPage.toast(`Signed ${ACTIVE_MEMBER.name} out of 2 sessions.`)
        ).toBeVisible();
        await expect(
            membersPage.actionsTrigger(ACTIVE_MEMBER.name!)
        ).toBeFocused();
    });
});
