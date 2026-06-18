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
}
