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
    /** The actor-email search box. */
    readonly emailSearch: Locator;
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
        this.emailSearch = page.getByRole('searchbox', {
            name: 'Search by actor email'
        });
        this.table = page.getByRole('table', { name: 'Activity log' });
    }

    async goto() {
        await this.page.goto('/activity');
    }

    /** A table row located by any visible text it contains (email, action…). */
    row(text: string): Locator {
        return this.page.getByRole('row').filter({ hasText: text });
    }

    /** The expand/collapse toggle inside a row matched by its visible text. */
    expandToggle(rowText: string): Locator {
        return this.row(rowText)
            .getByRole('button', { name: /details/i })
            .first();
    }

    /** Expands the first row containing `rowText` to reveal its details panel. */
    async expandRow(rowText: string) {
        await this.expandToggle(rowText).click();
    }

    /** Clicks a row's body (not the toggle button) to expand/collapse it. */
    async clickRowBody(rowText: string) {
        await this.row(rowText)
            .getByText(rowText, { exact: false })
            .first()
            .click();
    }

    /** The table loading skeleton — a `role="status"` region. */
    tableSkeleton(): Locator {
        return this.page
            .getByRole('status')
            .filter({ hasText: /Loading activity/ });
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
