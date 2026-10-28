import { type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * The inbox (`/inbox`) — what the reader was told across every workspace —
 * and its two ways in: the Inbox row in the global sidebar, and the button in
 * a workspace sidebar's header.
 */
export class InboxPage extends BasePage {
    readonly heading: Locator;
    readonly tabs: Locator;
    readonly markAll: Locator;

    constructor(page: Page) {
        super(page);
        this.heading = page.getByRole('heading', {
            name: 'Inbox',
            exact: true,
            level: 1
        });
        this.tabs = page.getByRole('tablist', { name: 'Which items to show' });
        this.markAll = page.getByRole('button', { name: 'Mark all as read' });
    }

    async goto(query = '') {
        await this.page.goto(`/inbox${query}`);
    }

    tab(name: RegExp | string): Locator {
        return this.tabs.getByRole('tab', { name });
    }

    /** A day's section ("Today", "Earlier"). */
    section(name: string): Locator {
        return this.page.getByRole('region', { name });
    }

    /** The item whose sentence matches. */
    item(sentence: RegExp | string): Locator {
        return this.page.getByRole('listitem').filter({ hasText: sentence });
    }

    /** The global sidebar's Inbox row. */
    get navLink(): Locator {
        return this.page
            .getByRole('navigation', { name: 'Primary' })
            .getByRole('link', { name: /^Inbox/ });
    }

    /** The button in a workspace sidebar's header. */
    get headerButton(): Locator {
        return this.page.getByRole('link', { name: /^Inbox(, \d+ unread)?$/ });
    }

    get failure(): Locator {
        return this.page.getByRole('alert');
    }
}
