import { type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page object for the content model (`@orthacms/schema-builder-admin`) — the
 * global, read-only view of the content types the server registers, one type
 * per URL. Data comes from `mockSchemaDocument`; the page gates on
 * `content:read`.
 */
export class ContentModelPage extends BasePage {
    /** The page's `<h1>`, present in every state. */
    readonly heading: Locator;
    /** The Content model entry in the primary nav. */
    readonly navLink: Locator;
    /** The skeleton's one announced region. */
    readonly loading: Locator;
    /** The rail of types. */
    readonly rail: Locator;
    /** The failed-load alert. */
    readonly errorAlert: Locator;
    /** The alert's retry button. */
    readonly retryButton: Locator;

    constructor(page: Page) {
        super(page);
        this.heading = page.getByRole('heading', {
            name: 'Content model',
            level: 1
        });
        this.navLink = page
            .getByRole('navigation', { name: 'Primary' })
            .getByRole('link', { name: 'Content model' });
        this.loading = page
            .getByRole('status')
            .filter({ hasText: 'Loading the content model…' });
        this.rail = page.getByRole('navigation', { name: 'Content types' });
        this.errorAlert = page
            .getByRole('alert')
            .filter({ hasText: 'Couldn’t load the content model' });
        this.retryButton = this.errorAlert.getByRole('button', {
            name: 'Retry'
        });
    }

    /** Open the page, optionally on one type. */
    async goto(typeName?: string) {
        await this.page.goto(
            typeName ? `/content-model/${typeName}` : '/content-model'
        );
    }

    /** One type's link in the rail. */
    railLink(label: string): Locator {
        return this.rail.getByRole('link', { name: new RegExp(`^${label}`) });
    }

    /** The rail link marked as the current page. */
    currentRailLink(): Locator {
        return this.rail.locator('[aria-current="page"]');
    }

    /** The selected type's heading. */
    typeHeading(label: string): Locator {
        return this.page.getByRole('heading', { name: label, level: 2 });
    }

    /** One built-in tab's block (General, Relations, Media). */
    tab(name: 'General' | 'Relations' | 'Media'): Locator {
        return this.page.getByRole('region', { name });
    }

    /** The machine names of the fields drawn on a tab, top to bottom. */
    async fieldNames(
        name: 'General' | 'Relations' | 'Media'
    ): Promise<string[]> {
        const rows = await this.tab(name).getByRole('listitem').all();
        const names: string[] = [];
        for (const row of rows) {
            if (await row.isVisible()) {
                names.push(
                    (await row.locator('.font-mono').first().textContent()) ??
                        ''
                );
            }
        }
        return names;
    }

    /** A General-tab group's accordion trigger. */
    groupTrigger(label: string): Locator {
        return this.tab('General').getByRole('button', {
            name: new RegExp(label)
        });
    }

    /** The page-wide read-only notice, by a phrase in it. */
    notice(text: string | RegExp): Locator {
        return this.page.getByText(text);
    }

    /** The no-access state's heading. */
    noAccessHeading(): Locator {
        return this.page.getByRole('heading', {
            name: 'You don’t have access to the content model'
        });
    }

    /** The empty state's heading. */
    emptyHeading(): Locator {
        return this.page.getByRole('heading', { name: 'No content types yet' });
    }
}
