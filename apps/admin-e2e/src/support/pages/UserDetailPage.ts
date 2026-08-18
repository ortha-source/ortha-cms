import { type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page object for the user detail page at `/users/:id` (from
 * `@ortha-cms/users-admin`). Data comes from the `mockUserDetail` /
 * `mockUserSessions` / activity mocks; tests also need `mockSignedIn` for the
 * auth probe and `mockMembers` for the list it links back to. Which side-rail
 * tabs appear depends on the signed-in user's `permissions`.
 */
export class UserDetailPage extends BasePage {
    /** The shell's primary nav — proof the gated layout wrapped the page. */
    readonly nav: Locator;
    /** The detail side rail (its own `nav` landmark). */
    readonly rail: Locator;

    constructor(page: Page) {
        super(page);
        this.nav = page.getByRole('navigation', { name: 'Primary' });
        this.rail = page.getByRole('navigation', {
            name: 'User detail sections'
        });
    }

    /** Open a member's detail page directly (defaults to the General tab). */
    async goto(id: string) {
        await this.page.goto(`/users/${id}`);
    }

    /** The hero's `<h1>` (the member's name). */
    heading(name: string): Locator {
        return this.page.getByRole('heading', { name, level: 1 });
    }

    /** A side-rail tab link, by its visible label (e.g. "Sessions"). */
    tab(label: string): Locator {
        return this.rail.getByRole('link', { name: label });
    }

    /** Open a tab by label. */
    async openTab(label: string) {
        await this.tab(label).click();
    }

    /** The General tab's full-name input. */
    nameInput(): Locator {
        return this.page.getByLabel('Full name');
    }

    /** The General tab's "Save changes" button. */
    saveButton(): Locator {
        return this.page.getByRole('button', { name: 'Save changes' });
    }

    /** A confirm-dialog button by label (e.g. "Revoke", "Suspend member"). */
    confirmButton(label: string): Locator {
        return this.page
            .getByRole('dialog')
            .getByRole('button', { name: label });
    }

    // --- Access tab: sign-in access + the password reset link ---

    /** The Access tab's "Generate reset link" button. */
    generateResetLink(): Locator {
        return this.page.getByRole('button', {
            name: /Generate reset link|Generating reset link/
        });
    }

    /** The reveal-once dialog that shows the minted reset link. */
    resetLinkDialog(): Locator {
        return this.page.getByRole('dialog');
    }

    /** The read-only link field inside the reveal dialog, by the member's email. */
    resetLinkField(email: string): Locator {
        return this.page.getByLabel(`Password reset link for ${email}`);
    }

    /** The dialog's copy button. */
    copyResetLink(): Locator {
        return this.page.getByRole('button', { name: 'Copy link' });
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
