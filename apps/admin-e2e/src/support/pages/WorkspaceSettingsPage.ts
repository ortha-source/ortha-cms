import { type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page object for the workspace settings page at `/workspaces/:id/settings`
 * (from `@ortha-cms/workspaces-admin`). A tabbed page — General, Members,
 * Content, and Danger zone — mounted inside the workspace shell. Backed by
 * `mockWorkspaceSettingsApi` (the stateful settings mock).
 */
export class WorkspaceSettingsPage extends BasePage {
    /** The page's `<h1>`. */
    readonly heading: Locator;

    constructor(page: Page) {
        super(page);
        this.heading = page.getByRole('heading', {
            name: 'Settings',
            level: 1
        });
    }

    /** Navigate straight to a workspace's settings and wait for the heading. */
    async goto(workspaceId: string) {
        await this.page.goto(`/workspaces/${workspaceId}/settings`);
        await this.heading.waitFor();
    }

    // --- tabs ---

    tab(name: string): Locator {
        return this.page.getByRole('tab', { name });
    }

    async openTab(name: string) {
        await this.tab(name).click();
    }

    // --- general ---

    get nameInput(): Locator {
        return this.page.getByLabel('Name');
    }

    get descriptionInput(): Locator {
        return this.page.getByLabel('Description');
    }

    get slugInput(): Locator {
        return this.page.getByLabel('URL slug');
    }

    colorSwatch(color: string): Locator {
        return this.page.getByRole('radio', { name: `Use the ${color} accent` });
    }

    get saveButton(): Locator {
        return this.page.getByRole('button', { name: 'Save changes' });
    }

    // --- members ---

    get memberSearch(): Locator {
        return this.page.getByPlaceholder('Add people by name or email');
    }

    /** A directory-search result option by visible name. */
    memberOption(name: string): Locator {
        return this.page.getByRole('button', { name: new RegExp(name) });
    }

    /** The roster row for a member (its email is unique in the list). */
    memberRow(email: string): Locator {
        return this.page.getByText(email, { exact: true });
    }

    memberRemoveButton(name: string): Locator {
        return this.page.getByRole('button', { name: `Remove ${name}` });
    }

    ownerBadge(): Locator {
        return this.page.getByText('Owner', { exact: true });
    }

    // --- content ---

    get addContentButton(): Locator {
        return this.page.getByRole('button', { name: 'Add content type' });
    }

    /** An option inside the add-content popover, by its label. */
    contentOption(label: string): Locator {
        return this.page.getByRole('button', { name: label });
    }

    contentRemoveButton(label: string): Locator {
        return this.page.getByRole('button', { name: `Remove ${label}` });
    }

    // --- danger ---

    get archiveButton(): Locator {
        return this.page.getByRole('button', { name: 'Archive', exact: true });
    }

    get unarchiveButton(): Locator {
        return this.page.getByRole('button', { name: 'Unarchive', exact: true });
    }

    get deleteButton(): Locator {
        return this.page.getByRole('button', { name: 'Delete workspace' });
    }

    archivedBadge(): Locator {
        return this.page.getByText('Archived', { exact: true });
    }

    // --- shared: confirm dialog + toasts ---

    get dialog(): Locator {
        return this.page.getByRole('dialog');
    }

    /** The confirm button inside the open dialog, by its label. */
    dialogConfirm(name: string): Locator {
        return this.dialog.getByRole('button', { name });
    }

    toast(text: string | RegExp): Locator {
        return this.page.getByText(text);
    }
}
