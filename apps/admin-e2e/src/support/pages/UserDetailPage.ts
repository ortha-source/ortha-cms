import { type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page object for the user detail page at `/users/:id` (from
 * `@orthacms/users-admin`). Data comes from the `mockUserDetail` /
 * `mockUserSessions` / activity mocks; tests also need `mockSignedIn` for the
 * auth probe and `mockMembers` for the list it links back to. Which side-rail
 * tabs appear depends on the signed-in user's `permissions`.
 */
export class UserDetailPage extends BasePage {
    /** The shell's primary nav — proof the gated layout wrapped the page. */
    readonly nav: Locator;
    /** The member page's tab bar (its own `nav` landmark). */
    readonly rail: Locator;

    constructor(page: Page) {
        super(page);
        this.nav = page.getByRole('navigation', { name: 'Primary' });
        this.rail = page.getByRole('navigation', {
            name: 'Member sections'
        });
    }

    /** Open a member's page directly (it opens on the Overview tab). */
    async goto(id: string) {
        await this.page.goto(`/users/${id}`);
    }

    /**
     * The top bar's "Members" crumb — the page's one way back to the roster.
     * It stays a link while the member loads and when it no longer exists.
     */
    membersCrumb(): Locator {
        return this.page
            .getByRole('navigation', { name: 'Breadcrumb' })
            .getByRole('link', { name: 'Members', exact: true });
    }

    /** The hero's `<h1>` (the member's name). */
    heading(name: string): Locator {
        return this.page.getByRole('heading', { name, level: 1 });
    }

    /** A tab link, by its visible label (e.g. "Sessions & access"). */
    tab(label: string): Locator {
        return this.rail.getByRole('link', { name: label, exact: true });
    }

    /** Open a tab by label. */
    async openTab(label: string) {
        await this.tab(label).click();
    }

    /** The Overview's full-name input. */
    nameInput(): Locator {
        return this.page.getByLabel('Full name');
    }

    /** The Overview's "Save changes" button (shown once the name is edited). */
    saveButton(): Locator {
        return this.page.getByRole('button', { name: 'Save changes' });
    }

    /**
     * The layout's failure alert. The 404 and the generic error share this one
     * element, so the copy — not the role — is what tells them apart; see
     * {@link notFoundAlert}.
     */
    errorAlert(): Locator {
        return this.page.getByRole('alert');
    }

    /**
     * The alert for a member id that matches nobody. Distinct copy on purpose:
     * a deleted member is a settled answer, and offering the retry the generic
     * message implies would send the admin round a loop that cannot succeed.
     */
    notFoundAlert(): Locator {
        return this.errorAlert().filter({
            hasText: 'This member no longer exists.'
        });
    }

    /**
     * The Sessions card's heading — the anchor the tab hands focus back to
     * when a revoked row unmounts (`tabIndex={-1}`).
     */
    sessionsCardHeader(): Locator {
        return this.page.getByRole('heading', {
            name: 'Sessions',
            level: 2
        });
    }

    /** A card on the page — a region named by its `<h2>` title. */
    card(title: string | RegExp): Locator {
        return this.page.getByRole('region', { name: title, exact: true });
    }

    /** The header's "Change role" button. */
    changeRoleButton(): Locator {
        return this.page.getByRole('button', { name: 'Change role' });
    }

    /** The header's `⋯` menu trigger. */
    moreActions(name: string): Locator {
        return this.page.getByRole('button', { name: `Actions for ${name}` });
    }

    /** The Sessions card's "Sign out everywhere". */
    signOutEverywhere(): Locator {
        return this.page.getByRole('button', { name: 'Sign out everywhere' });
    }

    /** A confirm-dialog button by label (e.g. "Revoke", "Suspend member"). */
    confirmButton(label: string): Locator {
        return this.page
            .getByRole('dialog')
            .getByRole('button', { name: label });
    }

    // --- Sessions & access tab: sessions, the password link, suspend ---

    /**
     * The sign-in access card's one action, whichever direction it is offering.
     * A single locator on purpose: the page renders exactly one of the two at a
     * time, so a test asserting "Suspend member" is visible is also asserting
     * "Reactivate member" is not.
     */
    accessAction(label: 'Suspend member' | 'Reactivate member'): Locator {
        return this.page.getByRole('button', { name: label });
    }

    /**
     * Copy on the sign-in access card, by text or pattern.
     *
     * `exact` matters more than it looks: the password card below repeats the
     * access card's wording inside a longer sentence ("This member is suspended
     * **and can't sign in, so a reset link…**"), so a substring match resolves
     * to two elements and fails strict mode.
     */
    accessStatus(text: string | RegExp, { exact = false } = {}): Locator {
        return this.page.getByText(text, exact ? { exact: true } : undefined);
    }

    /** The Password card's "Generate reset link" button. */
    generateResetLink(): Locator {
        return this.page.getByRole('button', {
            name: /Generate reset link|Generating reset link/
        });
    }

    /** The reveal-once dialog the row menu's "Password reset link" opens. */
    resetLinkDialog(): Locator {
        return this.page.getByRole('dialog');
    }

    /**
     * The read-only reset link field, by the member's email — inline on the
     * Password card, or inside the row menu's dialog.
     */
    resetLinkField(email: string): Locator {
        return this.page.getByLabel(`Password reset link for ${email}`);
    }

    /** The Password card's inline copy button. */
    copyResetLink(): Locator {
        return this.page.getByRole('button', {
            name: 'Copy the password reset link'
        });
    }

    /** The dialog's dismiss button (guarded until the link has been copied). */
    resetLinkDone(): Locator {
        return this.page.getByRole('button', { name: 'Done' });
    }

    // --- Preferences tab (self-only): the colour-theme picker ---

    /**
     * A theme option in the Preferences tab's radio group, by name (Light /
     * Dark / System). Each option is a `radio` whose accessible name comes from
     * its card label, so a substring match is robust to the hint copy. Used for
     * visibility/checked assertions; {@link selectTheme} does the clicking.
     */
    themeOption(name: 'Light' | 'Dark' | 'System'): Locator {
        return this.page.getByRole('radio', { name: new RegExp(name) });
    }

    /**
     * Select a theme by clicking its card. The radio itself is visually hidden
     * (`sr-only`) behind a custom card, so — as a user does — we click the card
     * label, which is wired to the radio via `htmlFor`.
     */
    async selectTheme(name: 'Light' | 'Dark' | 'System') {
        await this.page.locator('label', { hasText: name }).click();
    }

    /** True when the app has applied the dark theme (the `.dark` class on <html>). */
    async isDark(): Promise<boolean> {
        const cls =
            (await this.page.locator('html').getAttribute('class')) ?? '';
        return cls.split(/\s+/).includes('dark');
    }

    /** The "Theme saved." success toast shown after a theme is persisted. */
    savedToast(): Locator {
        return this.page.getByText('Theme saved.');
    }
}
