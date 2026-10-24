import { type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Workspace settings › **Publishing** (`/workspaces/:id/settings/protection`) —
 * protection's settings section: the publishable types with their rule in a
 * few words, and the rule editor dialog.
 */
export class PublishingSettingsPage extends BasePage {
    readonly heading: Locator;
    readonly dialog: Locator;

    constructor(page: Page) {
        super(page);
        this.heading = page.getByRole('heading', {
            name: 'Publishing',
            exact: true,
            level: 1
        });
        this.dialog = page.getByRole('dialog');
    }

    async goto(workspaceId: string) {
        await this.page.goto(`/workspaces/${workspaceId}/settings/protection`);
    }

    /** The section's entry in the settings side nav. */
    navLink(): Locator {
        return this.page.getByRole('link', { name: 'Publishing', exact: true });
    }

    /** One type's row in the list. */
    row(label: string): Locator {
        return this.page
            .getByRole('list', { name: 'Publishable types' })
            .getByRole('listitem')
            .filter({ hasText: label });
    }

    /** A type's Configure button. */
    configure(label: string): Locator {
        return this.page.getByRole('button', {
            name: `Configure protection for ${label}`
        });
    }

    switch(name: string | RegExp): Locator {
        return this.dialog.getByRole('switch', { name });
    }

    /** One of the 1 / 2 / 3 / Other… picks. */
    approvalsOption(name: string): Locator {
        return this.dialog
            .getByRole('radiogroup', { name: 'Approvals needed' })
            .getByRole('radio', { name, exact: true });
    }

    get otherCount(): Locator {
        return this.dialog.getByRole('spinbutton', {
            name: 'Number of approvals'
        });
    }

    /** The "In short:" sentence that reads the rule back. */
    get inShort(): Locator {
        return this.dialog.locator('p').filter({ hasText: /^In short:/ });
    }

    get save(): Locator {
        return this.dialog.getByRole('button', { name: 'Save' });
    }

    get removeRule(): Locator {
        return this.dialog.getByRole('button', { name: 'Remove rule' });
    }

    /** The one-member warning's live region. */
    get status(): Locator {
        return this.dialog.getByRole('status');
    }
}
