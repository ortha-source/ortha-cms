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

    /** One content type's section, by its heading. */
    section(typeLabel: string): Locator {
        return this.page.getByRole('region', { name: typeLabel, exact: true });
    }

    /** A section's own toggle — everything in that type. */
    sectionToggle(typeLabel: string): Locator {
        return this.page.getByRole('checkbox', {
            name: `Publish everything picked in ${typeLabel}`
        });
    }

    /** A column's toggle — one axis (a locale) for every record of a type. */
    axisToggle(axis: string, typeLabel: string): Locator {
        return this.page.getByRole('checkbox', {
            name: `Publish ${axis} for every ${typeLabel} record`
        });
    }

    /** A record's toggle — every entry of it that can publish. */
    recordToggle(record: string): Locator {
        return this.page.getByRole('checkbox', {
            name: `Publish everything picked for ${record}`
        });
    }

    /** One (record, axis) cell's checkbox. */
    cell(record: string, axis: string): Locator {
        return this.page.getByRole('checkbox', {
            name: new RegExp(`^Publish ${record}, ${axis} \\(`)
        });
    }

    /** One of the quick picks ("Everything", "Selected only", "Clear"). */
    preset(label: string): Locator {
        return this.page.getByRole('button', { name: label, exact: true });
    }

    /** The running count / check summary. */
    get summary(): Locator {
        return this.page.getByRole('status').filter({
            hasText: /picked|ready to publish|can publish|Nothing picked/
        });
    }

    /** The first step: "Check N entries". */
    get check(): Locator {
        return this.page.getByRole('button', { name: /^Check \d+ entr/ });
    }

    /** The second step: "Publish N entries". */
    get publish(): Locator {
        return this.page.getByRole('button', { name: /^Publish \d+ entr/ });
    }

    /** The list of entries the last check refused. */
    get problems(): Locator {
        return this.page.getByRole('region', { name: /can’t publish yet/ });
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
