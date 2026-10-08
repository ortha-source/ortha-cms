import { type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page object for `@orthacms/publishing-admin` — the **Publish Manager**
 * (`/workspaces/:id/publish?type=…&ids=…`) and the two menu items that open it.
 *
 * Seed it with `mockI18n` (the localized collection, its translations, the
 * publish context and the bulk endpoints) plus `mockReviewStatus` from
 * `support/api/publishing` for the approval notes.
 */
export class PublishManagerPage extends BasePage {
    constructor(page: Page) {
        super(page);
    }

    /** Navigate straight to the manager for a set. */
    async goto(workspaceId: string, type: string, ids: string[]) {
        await this.page.goto(
            `/workspaces/${workspaceId}/publish?type=${type}&ids=${ids.join(',')}`
        );
    }

    /** The page heading. */
    get heading(): Locator {
        return this.page.getByRole('heading', {
            level: 1,
            name: 'Publish Manager'
        });
    }

    /** A titled list — the type's records, or "Linked drafts". */
    list(title: string): Locator {
        return this.page.getByRole('region', { name: title });
    }

    /** A locale chip — that locale for every record. */
    axisToggle(axis: string): Locator {
        return this.page.getByRole('checkbox', {
            name: `Publish ${axis} for every record`
        });
    }

    /** A record's checkbox — every entry of it that can publish. */
    recordToggle(record: string): Locator {
        return this.page.getByRole('checkbox', {
            name: `Publish everything picked for ${record}`
        });
    }

    /** One locale pill's checkbox. */
    cell(record: string, axis: string): Locator {
        return this.page.getByRole('checkbox', {
            name: new RegExp(`^Publish ${record}, ${axis} \\(`)
        });
    }

    /** The running summary — picked, and what needs attention. */
    get summary(): Locator {
        return this.page.getByRole('status').filter({
            hasText: /picked|Checking/
        });
    }

    /** Ask the dry run again. */
    get recheck(): Locator {
        return this.page.getByRole('button', { name: 'Re-check' });
    }

    /** "Publish N entries". */
    get publish(): Locator {
        return this.page.getByRole('button', { name: /^Publish \d+ entr/ });
    }

    /** The "Needs attention" list. */
    get attention(): Locator {
        return this.page.getByRole('region', { name: 'Needs attention' });
    }

    /** The commit's outcome callout. */
    get outcome(): Locator {
        return this.page
            .getByRole('alert')
            .filter({ hasText: /published|Nothing was published/ });
    }

    /** "Open in Publish Manager" in an open menu. */
    get openItem(): Locator {
        return this.page.getByRole('menuitem', {
            name: 'Open in Publish Manager',
            exact: true
        });
    }
}
