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

    /** The running summary — picked, ready, needing fixes. */
    get summary(): Locator {
        return this.page.getByRole('status').filter({
            hasText: /picked|Nothing picked|Checking/
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

    /** "Expand all" / "Collapse all". */
    toggleAll(label: 'Expand all' | 'Collapse all'): Locator {
        return this.page.getByRole('button', { name: label, exact: true });
    }

    /** One record card's fold toggle. */
    cardToggle(record: string, action: 'Show' | 'Hide'): Locator {
        return this.page.getByRole('button', {
            name: `${action} the entries of ${record}`
        });
    }

    /** One record card, by its record name. */
    card(record: string): Locator {
        return this.page
            .locator('[data-state]')
            .filter({
                has: this.page.getByRole('checkbox', {
                    name: `Publish everything picked for ${record}`
                })
            })
            .first();
    }

    /** The failing fields of one entry ("{record}, {axis}"), always on screen. */
    failing(entry: string): Locator {
        return this.page.getByRole('list', {
            name: `What ${entry} is missing`
        });
    }

    /** The toggle opening one entry's full field checklist. */
    allChecks(entry: string): Locator {
        return this.page.getByRole('button', {
            name: new RegExp(`^Show all \\d+ field checks? for ${entry}$`)
        });
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
