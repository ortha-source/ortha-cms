import { type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page object for the Members page at `/users` (from `@orthacms/users-admin`).
 *
 * Data comes from the `GET /api/users` mock (`mockMembers`); tests also need
 * `mockSignedIn` for the auth probe, since the page lives behind the shell's
 * gate. Permission-gated controls assume the signed-in user's `permissions`
 * (set via `mockSignedIn`).
 */
export class MembersPage extends BasePage {
    /** The page's `<h1>`. */
    readonly heading: Locator;
    /** The shell's primary nav — proof the gated layout wrapped the page. */
    readonly nav: Locator;
    /** The search box (leading search icon). */
    readonly search: Locator;
    /** The header's primary "Invite people" button. */
    readonly inviteButton: Locator;

    constructor(page: Page) {
        super(page);
        // `exact`, because the route's `Suspense` fallback now carries an
        // `<h1>` of its own ("Loading members" — `ORT-167`), and Playwright's
        // default name matching is a case-insensitive **substring**. Without it
        // this resolved during the skeleton, before the page had even issued its
        // list request, and every spec that waited on it was racing the load.
        this.heading = page.getByRole('heading', {
            name: 'Members',
            exact: true,
            level: 1
        });
        this.nav = page.getByRole('navigation', { name: 'Primary' });
        this.search = page.getByRole('searchbox', {
            name: 'Search members by name or email'
        });
        this.inviteButton = page.getByRole('button', {
            name: 'Invite people',
            exact: true
        });
    }

    async goto() {
        await this.page.goto('/users');
    }

    /** A member's row, located by the member's visible name or email text. */
    row(nameOrEmail: string): Locator {
        return this.page.getByRole('row').filter({ hasText: nameOrEmail });
    }

    /**
     * The table loading skeleton — a `role="status"` region announcing
     * "Loading members…", shown while the list query is in flight (seed it with
     * `mockMembers(page, …, { delayMs })`).
     */
    tableSkeleton(): Locator {
        return this.page
            .getByRole('status')
            .filter({ hasText: /Loading members/ });
    }

    /** A status pill anywhere in the table (e.g. "Invited"). */
    statusPill(label: string): Locator {
        return this.page.getByText(label, { exact: true });
    }

    /** A primary-nav entry by label — rendered only for the permission it declares. */
    navItem(label: string): Locator {
        return this.nav.getByRole('link', { name: label });
    }

    /**
     * The list's retryable failure — an alert in place of the table, not an
     * empty table. `role="alert"` is unique on this page (the toolbar and
     * pagination carry none), so the bare role is a safe anchor.
     */
    errorAlert(): Locator {
        return this.page.getByRole('alert');
    }

    /** The error alert's own Retry, which refetches without a reload. */
    retryButton(): Locator {
        return this.errorAlert().getByRole('button', { name: 'Retry' });
    }

    /**
     * The result area's empty state. Both empties render through it — the
     * search miss and the genuinely empty roster — so scoping here is what
     * separates its "Invite member" button from the header's, which carries the
     * identical accessible name and would otherwise be a second match.
     */
    emptyState(): Locator {
        return this.page.locator('[data-slot="empty"]');
    }

    /** The empty roster's call to action (absent without `users:create`). */
    emptyInviteButton(): Locator {
        return this.emptyState().getByRole('button', {
            name: 'Invite people'
        });
    }

    /** A narrowed list's way back to the full roster. */
    clearSearchButton(): Locator {
        return this.emptyState().getByRole('button', {
            name: 'Clear filters'
        });
    }

    // --- quick filters + Last active ---

    /** The quick-filter chip group ("Show members"). */
    quickFilters(): Locator {
        return this.page.getByRole('group', { name: 'Show members' });
    }

    /**
     * One quick-filter chip by its label. Its accessible name also carries the
     * count ("Admins 1"), so the label is matched as a prefix.
     */
    quickFilter(
        label: 'Everyone' | 'Admins' | 'Invited' | 'Disabled'
    ): Locator {
        return this.quickFilters().getByRole('button', {
            name: new RegExp(`^${label}\\b`)
        });
    }

    /** The column header for "Last active". */
    lastActiveHeader(): Locator {
        return this.page.getByRole('columnheader', { name: 'Last active' });
    }

    /** A row's "You" badge — only on the signed-in member's own row. */
    youBadge(nameOrEmail: string): Locator {
        return this.row(nameOrEmail).getByText('You', { exact: true });
    }

    /** An invited row's inline Resend button. */
    inlineResend(email: string): Locator {
        return this.page.getByRole('button', {
            name: `Resend the invite to ${email}`
        });
    }

    /**
     * The inline reason a guarded menu item carries. It is written inside the
     * item (not a tooltip), so it is located by text within the open menu.
     */
    menuReason(text: string | RegExp): Locator {
        return this.page.getByRole('menu').getByText(text);
    }

    /**
     * The polite live region that restates how many members matched. A `<p>`,
     * unlike the loading skeleton's `role="status"` `<div>`, and matched on the
     * sentence it always ends with so a live region elsewhere in the shell (the
     * copilot dock composer's) can never be picked up instead.
     */
    resultsStatus(): Locator {
        return this.page
            .locator('p[role="status"]')
            .filter({ hasText: /members? found\./ });
    }

    /**
     * The tooltip a guarded row action opens. Radix draws the bubble and, for
     * assistive tech, a `role="tooltip"` copy of the same text — so this handle
     * is the one that proves the reason reached both.
     */
    actionTooltip(): Locator {
        return this.page.getByRole('tooltip');
    }

    /**
     * A sonner toast by its text. The shell keeps one live region for the whole
     * app, so a row action's failure notice lands here rather than anywhere near
     * the row it came from.
     */
    toast(text: string | RegExp): Locator {
        return this.page.getByText(text);
    }

    /** The kebab actions trigger in a member's row. */
    actionsTrigger(name: string): Locator {
        return this.page.getByRole('button', { name: `Actions for ${name}` });
    }

    /** Open a member's row menu. */
    async openActions(name: string) {
        await this.actionsTrigger(name).click();
    }

    /** A menu item by its label (rendered in the portaled menu). */
    menuItem(label: string): Locator {
        return this.page.getByRole('menuitem', { name: label });
    }

    /** The read-only role chip in a member's row. */
    roleChip(name: string): Locator {
        return this.row(name).getByText(/^(Admin|Contributor|Viewer)$/);
    }

    // --- the destructive-action confirmation ---

    /**
     * The confirm dialog a destructive row action opens. Both Disable and
     * Revoke invite go through one — neither fires straight off the menu.
     */
    confirmDialog(): Locator {
        return this.page.getByRole('dialog');
    }

    /** The confirm dialog's title, which must name what is about to happen. */
    confirmTitle(name: string): Locator {
        return this.page.getByRole('heading', { name });
    }

    /** A button inside the confirm dialog, by label. */
    confirmAction(label: string): Locator {
        return this.confirmDialog().getByRole('button', { name: label });
    }

    /**
     * The roster's focus anchor — where focus lands after a row is removed. It
     * wraps every result state, so it survives the table being swapped for the
     * empty state when the last row goes.
     */
    resultsAnchor(): Locator {
        return this.page.locator('#members-results');
    }

    // --- the invite page (/users/invite) ---

    /**
     * The invite page's content — the `<main>` region, so its locators never
     * reach the shell around it.
     */
    invitePage(): Locator {
        return this.page.getByRole('main');
    }

    /** The invite page's `<h1>` ("Invite people", or "2 invites created"). */
    inviteHeading(): Locator {
        return this.page.getByRole('heading', { level: 1 });
    }

    /** The page's address field (the chip input's text box). */
    inviteEmails(): Locator {
        return this.invitePage().getByRole('textbox', { name: 'Emails' });
    }

    /** Type addresses into the chip field and commit them with Enter. */
    async addInviteEmails(text: string) {
        await this.inviteEmails().fill(text);
        await this.inviteEmails().press('Enter');
    }

    /** One address chip, by its address. */
    emailChip(email: string): Locator {
        return this.invitePage()
            .getByRole('listitem')
            .filter({ hasText: email });
    }

    /** The remove button on an address chip. */
    removeEmailChip(email: string): Locator {
        return this.invitePage().getByRole('button', {
            name: `Remove ${email}`
        });
    }

    /** A role card's radio on the invite page (or in the role dialog). */
    inviteRole(label: 'Admin' | 'Contributor' | 'Viewer'): Locator {
        return this.page.getByRole('radio', { name: new RegExp(`^${label}`) });
    }

    /** A workspace tile's checkbox on the invite page, by its visible name. */
    inviteWorkspace(name: string): Locator {
        return this.invitePage().getByRole('checkbox', { name });
    }

    /** "all workspaces" — ticks every workspace there is. */
    allWorkspaces(): Locator {
        return this.invitePage().getByRole('button', {
            name: 'all workspaces'
        });
    }

    /** The page's submit, whose label counts the invites ("Send 2 invites"). */
    sendInvites(): Locator {
        return this.invitePage().getByRole('button', { name: /^Send/ });
    }

    /** The page's "3 people · Contributor · 2 workspaces" read-out. */
    inviteSummary(): Locator {
        return this.invitePage().getByText(/\b(person|people) · /);
    }

    /** The field's error text (malformed or already-a-member addresses). */
    inviteFieldError(text: string | RegExp): Locator {
        return this.invitePage().getByText(text);
    }

    /** The result state's heading ("2 invites created"). */
    inviteSentHeading(): Locator {
        return this.page.getByRole('heading', {
            level: 1,
            name: /invites? created/
        });
    }

    /** The page's "Couldn’t load workspaces." state. */
    workspacesError(): Locator {
        return this.page.getByText('Couldn’t load workspaces.');
    }

    /** The retry beside {@link workspacesError}. */
    retryWorkspaces(): Locator {
        return this.page.getByRole('button', { name: 'Try again' });
    }

    // --- the invite link hand-off (sheet result + resend dialog) ---

    /**
     * The read-only field holding a shareable invite link. Scoped by its
     * accessible name so it works in both places a link appears — the invite
     * page's result and the resend dialog.
     */
    inviteLinkField(email: string): Locator {
        return this.page.getByRole('textbox', {
            name: `Invite link for ${email}`
        });
    }

    /** The resend dialog's copy-to-clipboard control. */
    copyInviteLink(): Locator {
        return this.page.getByRole('button', { name: 'Copy link' });
    }

    /** The invite result's per-person copy button. */
    copyInviteLinkFor(email: string): Locator {
        return this.invitePage().getByRole('button', {
            name: `Copy link for ${email}`
        });
    }

    /** A button on the invite page, by label ("Done", "Invite more", …). */
    pageButton(label: string): Locator {
        return this.invitePage().getByRole('button', {
            name: label,
            exact: true
        });
    }

    /** The dialog a resend opens, carrying the rotated link. */
    inviteLinkDialog(): Locator {
        return this.page.getByRole('dialog').filter({
            hasText: /Send this link to/
        });
    }

    /**
     * The app-wide unsaved-changes guard ("Discard your unsaved changes?"),
     * raised when leaving the invite page with a link still uncopied.
     */
    leaveGuard(): Locator {
        return this.page.getByRole('dialog', {
            name: 'Discard your unsaved changes?'
        });
    }

    // --- the role dialog ---

    /** The role dialog, named "Change <name>’s role". */
    roleDialog(): Locator {
        return this.page.getByRole('dialog', { name: /^Change .*’s role$/ });
    }

    /** The dialog's "What changes" table. */
    roleChangesTable(): Locator {
        return this.roleDialog().getByRole('table', { name: 'What changes' });
    }

    /** One "What changes" row, by capability. */
    roleChange(capability: string): Locator {
        return this.roleChangesTable()
            .getByRole('row')
            .filter({ hasText: capability });
    }

    /** The dialog's confirm, whose label names the outcome. */
    roleConfirm(): Locator {
        return this.roleDialog().getByRole('button', { name: /^(Make|Keep) / });
    }

    // --- detail navigation ---

    /** A member's name rendered as a link to their detail page. */
    memberLink(name: string): Locator {
        return this.page.getByRole('link', { name });
    }

    /** Open a member's detail page by clicking their name link. */
    async openMember(name: string) {
        await this.memberLink(name).click();
    }

    // --- pagination ---

    /** The "{from}–{to} of {total}" readout in the pagination bar. */
    paginationRange(): Locator {
        return this.page.getByText(/^\d+.\d+ of \d+$/);
    }

    /**
     * The pager's `<nav>` landmark, by its exact (case-sensitive) name — the
     * translated one the page passes, not the design system's lower-case
     * English fallback.
     */
    paginationNav(): Locator {
        return this.page.getByRole('navigation', {
            name: 'Pagination',
            exact: true
        });
    }

    /**
     * The "Page {n} of {count}" readout between the prev/next controls, shown
     * only once there is more than one page. The clamp's visible effect, so it
     * is what a resilience test reads rather than the row range.
     */
    pageReadout(): Locator {
        return this.page.getByText(/^Page \d+ of \d+$/);
    }

    /** Pick a rows-per-page value from the page-size select. */
    async setRowsPerPage(value: string) {
        await this.page
            .getByRole('combobox', { name: 'Rows per page' })
            .click();
        await this.page
            .getByRole('option', { name: value, exact: true })
            .click();
    }

    nextPage(): Locator {
        return this.page.getByRole('button', { name: 'Next page' });
    }

    prevPage(): Locator {
        return this.page.getByRole('button', { name: 'Previous page' });
    }

    // The query-builder filter-drawer helpers live on BasePage (the drawer is
    // the same component on every list page).

    // --- empty / no-access states ---

    noAccessText(): Locator {
        return this.page.getByText('You don’t have access to members');
    }

    emptyText(text: string): Locator {
        return this.page.getByText(text);
    }
}
