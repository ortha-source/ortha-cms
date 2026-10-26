import { test, expect } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import {
    DEFAULT_MEMBERS,
    ROTATED_INVITE_TOKEN,
    manyMembers,
    mockMembers,
    spyResendInvite
} from '../support/api/members';

/** Alan — the roster's one pending invite, the only member Resend applies to. */
const PENDING_MEMBER = DEFAULT_MEMBERS.filter(
    (member) => member.status === 'pending'
)[0];

/**
 * The Members page (`/users`, `@orthacms/users-admin`): rendering the roster,
 * search and its two empty states, the quick filters, "Last active",
 * status-dependent row actions, the failed read, and permission gating — of the page, of the nav
 * entry that points at it, and of the request behind it. The backend is the
 * `GET /api/users` mock; `mockSignedIn` satisfies the shell's auth probe.
 *
 * The invite page has its own suite (`invite-page.spec.ts`). The row
 * menu's **guardrails** (the sole admin, your own account) live in
 * `destructive-actions.spec.ts` beside the actions they veto; the Access tab's
 * equivalents are in `user-access.spec.ts`. This docstring used to claim them,
 * which is roughly how they went untested.
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
        await expect(membersPage.row('grace@orthacms.dev')).toBeVisible();
        // The pending invite renders as a normal row with an "Invited" pill —
        // not a separate tab.
        await expect(membersPage.row('alan@orthacms.dev')).toBeVisible();
        await expect(membersPage.statusPill('Invited')).toBeVisible();
        await expect(membersPage.statusPill('Disabled')).toBeVisible();
    });

    test('says who can sign in and how many invites wait, in the subtitle', async ({
        membersPage,
        page
    }) => {
        await membersPage.goto();
        // Ada and Grace are active; Alan's invite is waiting.
        await expect(
            page.getByText('2 people can sign in · 1 invite waiting')
        ).toBeVisible();
    });

    test('shows when each member was last active — or when an invite went out', async ({
        membersPage,
        page
    }) => {
        await membersPage.goto();
        await expect(membersPage.lastActiveHeader()).toBeVisible();
        // "Last active" replaced "Joined".
        await expect(
            page.getByRole('columnheader', { name: 'Joined' })
        ).toHaveCount(0);

        await expect(membersPage.row('Ada Lovelace')).toContainText(
            /1[23] min ago/
        );
        await expect(membersPage.row('Grace Hopper')).toContainText('1 h ago');
        // An invite has never been active; its row says when it was sent.
        await expect(membersPage.row('alan@orthacms.dev')).toContainText(
            /Invited Jan 1/
        );
        // Past a week it is the date, with the year when it isn't this one.
        await expect(membersPage.row('Katherine Johnson')).toContainText(
            'Sep 30, 2025'
        );
    });

    test('offers Resend right on an invited row', async ({
        membersPage,
        page
    }) => {
        const resend = await spyResendInvite(page, PENDING_MEMBER);
        await membersPage.goto();

        await membersPage.inlineResend(PENDING_MEMBER.email).click();

        await expect(membersPage.inviteLinkDialog()).toBeVisible();
        expect(resend.count).toBe(1);
        // Only the invited row carries one.
        await expect(
            page.getByRole('button', { name: /^Resend the invite to/ })
        ).toHaveCount(1);
    });

    test('marks your own row', async ({ membersPage, page }) => {
        await mockSignedIn(page, {
            id: 'u_grace',
            email: 'grace@orthacms.dev',
            name: 'Grace Hopper'
        });
        await membersPage.goto();
        await expect(membersPage.youBadge('Grace Hopper')).toBeVisible();
        await expect(membersPage.youBadge('Ada Lovelace')).toHaveCount(0);
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

    test('offers a retry when the roster read fails, instead of an empty table', async ({
        membersPage,
        page
    }) => {
        await mockMembers(page, DEFAULT_MEMBERS, { status: 500 });
        await membersPage.goto();

        // A `5xx` is retried three times with backoff before the query settles,
        // so the alert is several seconds away — under the default timeout this
        // assertion would judge a page still showing its skeleton.
        await expect(membersPage.errorAlert()).toBeVisible({
            timeout: 15_000
        });
        await expect(membersPage.errorAlert()).toContainText(
            'Couldn’t load members'
        );
        // Not an empty table and not the empty state: both are claims about the
        // directory, and the page does not know anything about the directory.
        await expect(page.locator('table')).toHaveCount(0);
        await expect(membersPage.emptyState()).toHaveCount(0);

        // Retry has to refetch in place — an admin who has to reload the tab to
        // get past a blip is being told to fix it themselves.
        await mockMembers(page);
        await membersPage.retryButton().click();

        await expect(membersPage.row('Ada Lovelace')).toBeVisible();
        await expect(membersPage.errorAlert()).toHaveCount(0);
    });

    test('tells an empty directory apart from a search that matched nobody', async ({
        membersPage,
        page
    }) => {
        await mockMembers(page, []);
        await membersPage.goto();

        // Nobody has been invited yet, so the way forward is to invite someone
        // — not to clear a filter that was never applied.
        await expect(membersPage.emptyText('No members yet')).toBeVisible();
        await expect(membersPage.emptyInviteButton()).toBeVisible();
        await expect(membersPage.clearSearchButton()).toHaveCount(0);

        // The same surface under a search miss says the opposite. Telling the
        // two apart is the entire reason there are two of them: an install with
        // no members and a search for a name nobody has need different answers.
        await membersPage.search.fill('nobody-xyz');
        await expect(membersPage.emptyText('No members match')).toBeVisible();
        await expect(membersPage.clearSearchButton()).toBeVisible();
        await expect(membersPage.emptyInviteButton()).toHaveCount(0);
    });

    test('clearing the search from the empty state restores the roster', async ({
        membersPage,
        page
    }) => {
        await membersPage.goto();
        await membersPage.search.fill('nobody-xyz');
        await expect(membersPage.clearSearchButton()).toBeVisible();

        await membersPage.clearSearchButton().click();

        // The URL is this page's source of truth, so clearing has to reach it:
        // a button that only emptied the input would leave `?search=` behind
        // and the next render would re-apply it.
        await expect(membersPage.search).toHaveValue('');
        await expect(page).not.toHaveURL(/[?&]search=/);
        await expect(membersPage.row('Ada Lovelace')).toBeVisible();
    });

    test('announces the result count when a search changes it', async ({
        membersPage
    }) => {
        await membersPage.goto();
        // The table is replaced without a navigation, so nothing tells a
        // screen-reader user that anything happened except this region — and a
        // search that narrowed four rows to one otherwise reads exactly like a
        // search that did nothing (WCAG 4.1.3).
        await expect(membersPage.resultsStatus()).toHaveText(
            '4 members found.'
        );

        await membersPage.search.fill('grace');
        await expect(membersPage.resultsStatus()).toHaveText('1 member found.');
    });

    test('a link back to the bare roster clears the search box with it', async ({
        membersPage,
        page
    }) => {
        await membersPage.goto();
        await membersPage.search.fill('grace');
        await expect(page).toHaveURL(/[?&]search=grace/);
        await expect(membersPage.row('Ada Lovelace')).toHaveCount(0);

        // The sidebar entry points at the bare `/users`. The URL is the source
        // of truth for this page, so the box has to follow it back down —
        // `useTableUrlState` used to only read the URL on mount and write its
        // own value out forever after, which re-applied the filter and rewrote
        // the URL the user had just navigated to.
        await membersPage.nav.getByRole('link', { name: 'Members' }).click();

        await expect(page).toHaveURL(/\/users$/);
        await expect(membersPage.search).toHaveValue('');
        await expect(membersPage.row('Ada Lovelace')).toBeVisible();
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
        // The landmark is named by the page, through react-intl — the design
        // system has no i18n, so its own default is untranslated English.
        await expect(membersPage.paginationNav()).toBeVisible();
    });

    test('an invited row’s menu is resend, copy link, revoke', async ({
        membersPage
    }) => {
        await membersPage.goto();
        await membersPage.openActions('alan@orthacms.dev');

        await expect(membersPage.menuItem('Resend invite')).toBeVisible();
        await expect(membersPage.menuItem('Copy invite link')).toBeVisible();
        await expect(membersPage.menuItem('Revoke invite')).toBeVisible();
        await expect(membersPage.menuItem('Open profile')).toHaveCount(0);
        await expect(membersPage.menuItem('Suspend')).toHaveCount(0);
    });

    test('an active row’s menu is profile, role, workspaces, sign-in tools, suspend', async ({
        membersPage
    }) => {
        await membersPage.goto();
        await membersPage.openActions('Grace Hopper');

        for (const label of [
            'Open profile',
            'Change role…',
            'Workspaces…',
            'Password reset link',
            'Sign out everywhere',
            'Suspend…'
        ]) {
            await expect(membersPage.menuItem(label)).toBeVisible();
        }
        await expect(membersPage.menuItem('Resend invite')).toHaveCount(0);
    });

    test('a suspended row’s menu offers Reactivate (not Suspend)', async ({
        membersPage
    }) => {
        await membersPage.goto();
        await membersPage.openActions('Katherine Johnson');

        await expect(membersPage.menuItem('Reactivate')).toBeVisible();
        await expect(membersPage.menuItem('Suspend')).toHaveCount(0);
        await expect(membersPage.menuItem('Password reset link')).toHaveCount(
            0
        );
    });

    test('Copy invite link hands over a fresh link', async ({
        membersPage,
        page
    }) => {
        // Only a hash of the old token is stored, so "copy" can only ever mean
        // a new link — the dialog says the old one stopped working.
        const resend = await spyResendInvite(page, PENDING_MEMBER);
        await membersPage.goto();
        await membersPage.openActions(PENDING_MEMBER.email);
        await membersPage.menuItem('Copy invite link').click();

        await expect(
            membersPage.inviteLinkField(PENDING_MEMBER.email)
        ).toHaveValue(new RegExp(`token=${ROTATED_INVITE_TOKEN}$`));
        expect(resend.count).toBe(1);
    });

    test('renders the role as a read-only chip', async ({ membersPage }) => {
        await membersPage.goto();
        // The Role column is a read-only chip; changing it is the role dialog.
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
        // The row menu is navigation-only for a viewer: no role change, no
        // sign-in tools, no suspend.
        await membersPage.openActions('Grace Hopper');
        await expect(membersPage.menuItem('Open profile')).toBeVisible();
        await expect(membersPage.menuItem('Change role')).toHaveCount(0);
        await expect(membersPage.menuItem('Sign out everywhere')).toHaveCount(
            0
        );
        await expect(membersPage.menuItem('Suspend')).toHaveCount(0);
        await page.keyboard.press('Escape');
        // …and an invited row offers no Resend button either.
        await expect(membersPage.inlineResend('alan@orthacms.dev')).toHaveCount(
            0
        );
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

    test('asks for nothing at all without users:read', async ({
        membersPage,
        page
    }) => {
        await mockSignedIn(page, { permissions: [] });
        const roster = await mockMembers(page);
        await membersPage.goto();

        // The read is suppressed by the query's `enabled` flag rather than
        // hidden after the fact. "No rows on screen" cannot tell those apart,
        // which is why the counter exists: the server would refuse the request
        // anyway, and asking it to is a wasted round-trip and an audit line
        // about a permission nobody was exercising.
        await expect(membersPage.noAccessText()).toBeVisible();
        expect(roster.count).toBe(0);
    });

    test('offers the Members nav entry only to someone who can read it [shell:I-08]', async ({
        membersPage,
        page
    }) => {
        await mockSignedIn(page, { permissions: ['users:read'] });
        await membersPage.goto();
        await expect(membersPage.navItem('Members')).toBeVisible();

        // The entry declares `permission: 'users:read'` precisely so navigation
        // never promises a destination that answers "you don't have access to
        // members" — a dead link in the sidebar reads as a broken app.
        await mockSignedIn(page, { permissions: [] });
        await membersPage.goto();
        await expect(membersPage.noAccessText()).toBeVisible();
        await expect(membersPage.navItem('Members')).toHaveCount(0);
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
