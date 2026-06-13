import { type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page object for the Activity Log at `/activity` (from
 * `@ortha-cms/activity-admin`).
 *
 * Data comes from the `GET /api/activity` mock (`mockActivity`); tests also
 * need `mockSignedIn` for the shell's auth probe. The page (and its nav entry)
 * gate on the signed-in user's `activity:read` permission.
 */
export class ActivityLogPage extends BasePage {
    /** The page's `<h1>`. */
    readonly heading: Locator;
    /** The shell's primary nav — proof the gated layout wrapped the page. */
    readonly nav: Locator;
    /** The Activity entry in the primary nav (an icon button, labelled). */
    readonly navButton: Locator;
    /** The action (kind) filter select. */
    readonly kindFilter: Locator;
    /** The actor-email search box. */
    readonly emailSearch: Locator;
    /** The "From" date input. */
    readonly fromInput: Locator;
    /** The "To" date input. */
    readonly toInput: Locator;
    /** The audit-log table. */
    readonly table: Locator;

    constructor(page: Page) {
        super(page);
        this.heading = page.getByRole('heading', {
            name: 'Activity',
            level: 1
        });
        this.nav = page.getByRole('navigation', { name: 'Primary' });
        this.navButton = this.nav.getByRole('button', { name: 'Activity' });
        this.kindFilter = page.getByRole('combobox', {
            name: 'Filter by action'
        });
        this.emailSearch = page.getByRole('searchbox', {
            name: 'Search by actor email'
        });
        this.fromInput = page.getByLabel('From');
        this.toInput = page.getByLabel('To');
        this.table = page.getByRole('table', { name: 'Activity log' });
    }

    async goto() {
        await this.page.goto('/activity');
    }

    /** A table row located by any visible text it contains (email, action…). */
    row(text: string): Locator {
        return this.page.getByRole('row').filter({ hasText: text });
    }

    /** Opens the kind filter and selects the option with the given label. */
    async selectKind(label: string) {
        await this.kindFilter.click();
        await this.page.getByRole('option', { name: label, exact: true }).click();
    }

    /** The no-access empty state heading (shown without `activity:read`). */
    noAccessText(): Locator {
        return this.page.getByText('You don’t have access to the activity log');
    }

    /** The empty-state heading shown when filters match nothing. */
    emptyText(label: string): Locator {
        return this.page.getByText(label, { exact: true });
    }
}
