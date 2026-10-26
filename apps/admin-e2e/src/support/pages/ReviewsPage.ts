import { type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * The Reviews page (`/workspaces/:id/reviews`) — the reviewer's queue, its
 * three tabs, and the side panel Review opens beside the table.
 */
export class ReviewsPage extends BasePage {
    readonly heading: Locator;
    readonly tabs: Locator;
    readonly waitingTab: Locator;
    readonly mineTab: Locator;
    readonly approvedTab: Locator;
    /** The open queue tab's table. */
    readonly queueTable: Locator;
    /** The "Recently approved" table. */
    readonly approvedTable: Locator;
    /** The side panel. */
    readonly panel: Locator;

    constructor(page: Page) {
        super(page);
        this.heading = page.getByRole('heading', {
            name: 'Reviews',
            exact: true,
            level: 1
        });
        this.tabs = page.getByRole('tablist', {
            name: 'Which requests to show'
        });
        this.waitingTab = this.tabs.getByRole('tab', {
            name: /waiting on me/i
        });
        this.mineTab = this.tabs.getByRole('tab', { name: /my requests/i });
        this.approvedTab = this.tabs.getByRole('tab', {
            name: /recently approved/i
        });
        this.queueTable = page.getByRole('table', { name: 'Review requests' });
        this.approvedTable = page.getByRole('table', {
            name: 'Recently approved'
        });
        this.panel = page.getByRole('dialog');
    }

    async goto(workspaceId: string) {
        await this.page.goto(`/workspaces/${workspaceId}/reviews`);
    }

    /** The failed-read banner. */
    get failure(): Locator {
        return this.page.getByRole('alert');
    }

    /** Body rows of the visible queue table. */
    get queueRows(): Locator {
        return this.queueTable.locator('tbody tr');
    }

    /** The row naming `title`, in whichever list table is showing. */
    row(title: string): Locator {
        return this.page
            .getByRole('table', {
                name: /^(Review requests|Recently approved)$/
            })
            .getByRole('row')
            .filter({ hasText: title });
    }

    /** A row's Review button, by the record it is named for. */
    reviewButton(title: string): Locator {
        return this.page.getByRole('button', { name: `Review ${title}` });
    }

    /** Opens the side panel for `title`. */
    async review(title: string) {
        await this.reviewButton(title).click();
    }

    /** The panel's title — the record's name. */
    get panelTitle(): Locator {
        return this.panel.getByRole('heading').first();
    }

    get approveButton(): Locator {
        return this.panel.getByRole('button', { name: 'Approve' });
    }

    get openRecordLink(): Locator {
        return this.panel.getByRole('link', { name: 'Open record' });
    }

    get closeButton(): Locator {
        return this.panel.getByRole('button', { name: 'Close' });
    }

    /** The panel's comparison table. */
    get changesTable(): Locator {
        return this.panel.getByRole('table', {
            name: 'Changes since it was last published'
        });
    }

    /** A changed field's row in the comparison, by its label. */
    changeRow(field: string): Locator {
        return this.changesTable.getByRole('row').filter({
            has: this.page.getByRole('rowheader', { name: field })
        });
    }

    /** Empty-state text, in whichever tab is showing. */
    emptyText(text: RegExp | string): Locator {
        return this.page.getByText(text);
    }
}
