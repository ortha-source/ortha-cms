import { type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';
import type { BrowserGlobals } from '../browserGlobals';

/**
 * Page object for the webhooks pages (from `@orthacms/webhooks-admin`) — the
 * global directory surface that configures where this CMS posts when content
 * changes, and shows whether it arrived.
 *
 * Data comes from the `**\/api/webhooks**` mocks (`mockWebhooksApi`); the
 * editor's workspace picker reads `GET /api/workspaces` (`mockWorkspaces`).
 * Tests also need `mockSignedIn` for the shell's auth probe. Both pages gate on
 * `webhooks:read`, and every write control on `webhooks:manage` — unlike most
 * surfaces here, **both are administrator-only**, so withholding `webhooks:read`
 * is how a spec reaches the no-access state.
 */
export class WebhooksPage extends BasePage {
    /** The list page's `<h1>`. */
    readonly heading: Locator;
    /** The shell's primary nav — proof the gated layout wrapped the page. */
    readonly nav: Locator;
    /** The Webhooks entry in the primary nav. */
    readonly navLink: Locator;
    /** The endpoint table, named by its `sr-only` caption. */
    readonly table: Locator;
    /** The header action that opens the create dialog. */
    readonly newWebhookButton: Locator;

    constructor(page: Page) {
        super(page);
        this.heading = page.getByRole('heading', {
            name: 'Webhooks',
            level: 1
        });
        this.nav = page.getByRole('navigation', { name: 'Primary' });
        this.navLink = this.nav.getByRole('link', { name: 'Webhooks' });
        this.table = page.getByRole('table', {
            name: 'Configured webhook endpoints'
        });
        this.newWebhookButton = page.getByRole('button', {
            name: 'New webhook'
        });
    }

    async goto() {
        await this.page.goto('/webhooks');
    }

    /** Open one endpoint's detail page. */
    async gotoDetail(id: string) {
        await this.page.goto(`/webhooks/${id}`);
    }

    // --- list --------------------------------------------------------------

    /** One endpoint's row, found by its name. */
    row(name: string): Locator {
        return this.table.getByRole('row').filter({ hasText: name });
    }

    /** The list-failed alert — must never be the empty state. */
    errorAlert(): Locator {
        return this.page
            .getByRole('alert')
            .filter({ hasText: 'Couldn’t load webhooks' });
    }

    /** The empty state's heading. */
    emptyHeading(): Locator {
        return this.page.getByRole('heading', { name: 'No webhooks yet' });
    }

    /** The no-access state's heading. */
    noAccessHeading(): Locator {
        return this.page.getByRole('heading', {
            name: 'You don’t have access to webhooks'
        });
    }

    // --- the editor dialog -------------------------------------------------

    /** The create/edit dialog. */
    dialog(): Locator {
        return this.page.getByRole('dialog');
    }

    /** The dialog's name field. */
    nameField(): Locator {
        return this.dialog().getByLabel('Name');
    }

    /** The dialog's URL field. */
    urlField(): Locator {
        return this.dialog().getByLabel('URL');
    }

    /** The "All workspaces" toggle — the difference between "all" and "none". */
    allWorkspacesToggle(): Locator {
        return this.dialog().getByRole('checkbox', {
            name: /All workspaces/
        });
    }

    /** The "Every event" toggle. */
    allEventsToggle(): Locator {
        return this.dialog().getByRole('checkbox', { name: /Every event/ });
    }

    /** The "Every content type" toggle. */
    allContentTypesToggle(): Locator {
        return this.dialog().getByRole('checkbox', {
            name: /Every content type/
        });
    }

    /** The content-type picker, which only exists once that toggle is off. */
    contentTypesPicker(): Locator {
        return this.dialog().getByRole('combobox', { name: 'Content types' });
    }

    /** The free-entry field for a type the registry does not list. */
    contentTypeDraftField(): Locator {
        return this.dialog().getByLabel(/Add a type that isn/);
    }

    /** The button that commits what is typed in that field. */
    addContentTypeButton(): Locator {
        return this.dialog().getByRole('button', { name: 'Add' });
    }

    /** A selected filter value, as the picker's trigger shows it. */
    pickedValue(label: string): Locator {
        return this.dialog().getByText(label, { exact: true });
    }

    /** The dialog's submit button. */
    submitButton(): Locator {
        return this.dialog().getByRole('button', { name: 'Create webhook' });
    }

    // --- the one-time secret ------------------------------------------------

    /** The reveal dialog's read-only secret field. */
    secretField(): Locator {
        return this.page.getByLabel('Webhook signing secret');
    }

    /** The reveal dialog's copy button. */
    copySecretButton(): Locator {
        return this.page.getByRole('button', { name: 'Copy' });
    }

    // --- the detail page ----------------------------------------------------

    /** The delivery log's table. */
    deliveriesTable(): Locator {
        return this.page.getByRole('table', { name: 'Delivery log' });
    }

    /** The detail page's Edit action, which opens the editor on this endpoint. */
    editButton(): Locator {
        return this.page.getByRole('button', { name: 'Edit' });
    }

    /** The editor's submit button when editing rather than creating. */
    saveButton(): Locator {
        return this.dialog().getByRole('button', { name: 'Save' });
    }

    /** The Settings tab trigger. */
    settingsTab(): Locator {
        return this.page.getByRole('tab', { name: 'Settings' });
    }

    /** The Deliveries tab trigger. */
    deliveriesTab(): Locator {
        return this.page.getByRole('tab', { name: 'Deliveries' });
    }

    /** The auto-disabled banner on the detail page. */
    autoDisabledAlert(): Locator {
        return this.page
            .getByRole('alert')
            .filter({ hasText: 'Disabled automatically' });
    }

    /** The "View" action on the first delivery row. */
    firstDeliveryViewButton(): Locator {
        return this.page.getByRole('button', { name: 'View' }).first();
    }

    /** The delivery detail sheet. */
    deliverySheet(): Locator {
        return this.page.getByRole('dialog');
    }

    /** The delivery log's state filter — named explicitly, not by its value. */
    stateFilter(): Locator {
        return this.page.getByRole('combobox', { name: 'Filter by state' });
    }

    /** The event picker's option list, once the picker is open. */
    eventOption(label: string): Locator {
        return this.page.getByRole('option', { name: label });
    }

    /** Opens the event picker, which only exists once "Every event" is off. */
    async openEventPicker() {
        await this.allEventsToggle().click();
        // By name, not by position: the dialog holds three pickers now, and
        // which one is last depends on which "All …" toggles are off.
        await this.dialog().getByRole('combobox', { name: 'Events' }).click();
    }

    /**
     * Opens the content-type picker, which only exists once "Every content
     * type" is off.
     */
    async openContentTypePicker() {
        await this.allContentTypesToggle().click();
        await this.contentTypesPicker().click();
    }

    /** The reveal dialog's "you haven't copied it" guard. */
    uncopiedWarning(): Locator {
        return this.page
            .getByRole('alert')
            .filter({ hasText: 'haven’t copied' });
    }

    /** The secret hint shown on the Settings tab, e.g. "Ends in a1b2". */
    secretHint(hint: string): Locator {
        return this.page.getByText(`Ends in ${hint}`);
    }

    /** Any occurrence of `text` on the page — for proving a secret is absent. */
    anyText(text: string): Locator {
        return this.page.getByText(text);
    }

    /**
     * Whether the page itself scrolls sideways, and whether the table's own
     * wrapper takes the overflow instead (WCAG 1.4.10).
     *
     * Geometry, not a rule engine — axe cannot answer this, and it is exactly
     * what a wide table gets wrong.
     */
    async reflowGeometry() {
        return this.page.evaluate(() => {
            const { document, window, getComputedStyle } =
                globalThis as unknown as BrowserGlobals;
            const table = document.querySelector('table');
            const wrapper = table?.parentElement ?? null;
            return {
                overflowX: wrapper
                    ? getComputedStyle(wrapper).overflowX
                    : 'none',
                wrapperScrolls: wrapper
                    ? wrapper.scrollWidth > wrapper.clientWidth
                    : false,
                pageScrollsSideways:
                    document.documentElement.scrollWidth > window.innerWidth
            };
        });
    }
}
