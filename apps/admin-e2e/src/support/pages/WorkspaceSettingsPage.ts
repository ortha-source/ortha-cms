import { type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page object for the workspace settings page at `/workspaces/:id/settings`
 * (from `@ortha-cms/workspaces-admin`). A left-rail page — General, Members,
 * Content, and Danger zone are nested routes reached from the side nav —
 * mounted inside the workspace shell. Backed by `mockWorkspaceSettingsApi` (the
 * stateful settings mock).
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

    // --- left-rail section nav ---

    /** The settings side-rail nav (scopes section links away from the navbar). */
    get sectionNav(): Locator {
        return this.page.getByRole('navigation', {
            name: 'Workspace settings sections'
        });
    }

    /** A section entry in the left rail (a link). */
    navItem(name: string): Locator {
        return this.sectionNav.getByRole('link', { name });
    }

    /** Navigate to a section by clicking its rail entry. */
    async openSection(name: string) {
        await this.navItem(name).click();
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

    /** The trigger that opens the add-content dialog. */
    get addContentButton(): Locator {
        return this.page.getByRole('button', { name: 'Add content types' });
    }

    /** The add dialog's search box. */
    get addContentSearch(): Locator {
        return this.dialog.getByPlaceholder('Search content types');
    }

    /** A selectable content-type checkbox in the add dialog, by its label. */
    contentCheckbox(label: string): Locator {
        return this.dialog.getByRole('checkbox', { name: new RegExp(label) });
    }

    /** The add dialog's Save button (label reflects the selected count). */
    get addContentSave(): Locator {
        return this.dialog.getByRole('button', { name: /^Add/ });
    }

    /** The per-row remove control in the granted list. */
    contentRemoveButton(label: string): Locator {
        return this.page.getByRole('button', { name: `Remove ${label}` });
    }

    /** The Remove button inside the remove-content confirm dialog. */
    get removeContentConfirm(): Locator {
        return this.dialog.getByRole('button', { name: 'Remove', exact: true });
    }

    /** The blocking warning alert shown when a type still has entries. */
    get removeBlockedAlert(): Locator {
        return this.dialog.getByRole('alert');
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

    /** The Delete button inside the delete confirm dialog. */
    get deleteConfirm(): Locator {
        return this.dialog.getByRole('button', { name: 'Delete workspace' });
    }

    /** The blocking warning alert shown when the workspace still has content. */
    get deleteBlockedAlert(): Locator {
        return this.dialog.getByRole('alert');
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
