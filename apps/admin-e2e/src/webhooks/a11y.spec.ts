import { test, expect } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import { mockWorkspaces } from '../support/api/workspaces';
import { mockContentSchema } from '../support/api/content';
import { mockWebhooksApi, WEBHOOKS_SEED } from '../support/api/webhooks';
import { expectNoA11yViolations } from '../support/a11y';

/** A retried 5xx settles on a backoff ladder; error states are waited out. */
const SETTLED = { timeout: 20_000 };

/**
 * Accessibility scans (axe, WCAG 2.1 A/AA) of the webhooks pages and their
 * dynamic states — the list, the error state, the editor dialog, the reveal-once
 * dialog, the detail page's two tabs and the delivery panel — plus the checks
 * axe cannot make: that the list scrolls rather than clips at 320 px, and that
 * the state filter has a real accessible name.
 *
 * A regression guard, not a conformance claim.
 */
test.describe('Webhooks accessibility (axe, WCAG 2.1 A/AA)', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockWorkspaces(page);
        await mockContentSchema(page);
    });

    test('list — populated', async ({ page, webhooksPage, makeAxe }) => {
        await mockWebhooksApi(page);
        await webhooksPage.goto();
        await webhooksPage.table.waitFor();
        await expectNoA11yViolations(makeAxe());
    });

    test('list — empty', async ({ page, webhooksPage, makeAxe }) => {
        await mockWebhooksApi(page, { endpoints: [] });
        await webhooksPage.goto();
        await webhooksPage.emptyHeading().waitFor();
        await expectNoA11yViolations(makeAxe());
    });

    test('list — error', async ({ page, webhooksPage, makeAxe }) => {
        await mockWebhooksApi(page, { listFails: true });
        await webhooksPage.goto();
        await webhooksPage.errorAlert().waitFor(SETTLED);
        await expectNoA11yViolations(makeAxe());
    });

    test('list — no access', async ({ page, webhooksPage, makeAxe }) => {
        await mockSignedIn(page, { permissions: ['workspaces:read'] });
        await mockWebhooksApi(page);
        await webhooksPage.goto();
        await webhooksPage.noAccessHeading().waitFor();
        await expectNoA11yViolations(makeAxe());
    });

    test('the editor dialog', async ({ page, webhooksPage, makeAxe }) => {
        await mockWebhooksApi(page);
        await webhooksPage.goto();
        await webhooksPage.table.waitFor();
        await webhooksPage.newWebhookButton.click();
        await webhooksPage.dialog().waitFor();
        await expectNoA11yViolations(makeAxe());
    });

    test('the editor dialog, every picker revealed', async ({
        page,
        webhooksPage,
        makeAxe
    }) => {
        await mockWebhooksApi(page);
        await webhooksPage.goto();
        await webhooksPage.table.waitFor();
        await webhooksPage.newWebhookButton.click();
        await webhooksPage.dialog().waitFor();
        // Each picker exists only while its "All …" toggle is off, so the
        // default scan above never sees two of the three controls — including
        // the free-entry field and its button. The type controls need a
        // workspace decision before they exist at all.
        await webhooksPage.allWorkspacesToggle().click();
        await webhooksPage.allEventsToggle().click();
        await webhooksPage.allContentTypesToggle().click();
        await webhooksPage.contentTypesPicker().waitFor();
        await expectNoA11yViolations(makeAxe());
    });

    test('the reveal-once dialog', async ({ page, webhooksPage, makeAxe }) => {
        await mockWebhooksApi(page);
        await webhooksPage.goto();
        await webhooksPage.table.waitFor();
        await webhooksPage.newWebhookButton.click();
        await webhooksPage.nameField().fill('Cache purge');
        await webhooksPage.urlField().fill('https://cdn.example.com/hooks');
        await webhooksPage.allWorkspacesToggle().click();
        await webhooksPage.submitButton().click();
        await webhooksPage.secretField().waitFor();
        // Let the "Webhook created" toast expire first. Sonner's own surface
        // fails contrast — a design-system issue, not this dialog's, and the
        // same reason the content suite waits it out — and it would otherwise
        // mask the state this case exists to scan.
        await page
            .locator('[data-sonner-toast]')
            .waitFor({ state: 'detached', timeout: 15_000 });
        await expectNoA11yViolations(makeAxe());
    });

    test('the delivery log', async ({ page, webhooksPage, makeAxe }) => {
        await mockWebhooksApi(page);
        await webhooksPage.gotoDetail(WEBHOOKS_SEED[0].id);
        await webhooksPage.deliveriesTable().waitFor();
        await expectNoA11yViolations(makeAxe());
    });

    test('the settings tab', async ({ page, webhooksPage, makeAxe }) => {
        await mockWebhooksApi(page);
        await webhooksPage.gotoDetail(WEBHOOKS_SEED[0].id);
        await webhooksPage.settingsTab().click();
        await expectNoA11yViolations(makeAxe());
    });

    test('one delivery, opened', async ({ page, webhooksPage, makeAxe }) => {
        await mockWebhooksApi(page);
        await webhooksPage.gotoDetail(WEBHOOKS_SEED[0].id);
        await webhooksPage.deliveriesTable().waitFor();
        await webhooksPage.firstDeliveryViewButton().click();
        await webhooksPage.deliverySheet().waitFor();
        await expectNoA11yViolations(makeAxe());
    });

    test('the state filter has an accessible name axe cannot infer', async ({
        page,
        webhooksPage
    }) => {
        await mockWebhooksApi(page);
        await webhooksPage.gotoDetail(WEBHOOKS_SEED[0].id);
        await webhooksPage.deliveriesTable().waitFor();

        // A `SelectTrigger` showing only its current value has no name of its
        // own; without the explicit label a screen-reader user hears "All
        // states, button" and nothing about what it filters.
        await expect(webhooksPage.stateFilter()).toBeVisible();
    });

    test('the list scrolls rather than clips at 320 px', async ({
        page,
        webhooksPage
    }) => {
        await page.setViewportSize({ width: 320, height: 800 });
        await mockWebhooksApi(page);
        await webhooksPage.goto();
        await webhooksPage.table.waitFor();

        // WCAG 1.4.10: content reflows without a horizontal scroll on the page
        // itself; the wide table earns its own scroll container instead. If it
        // clipped rather than scrolled, the Last delivery column — the one
        // reason to open this page — would be unreachable at this width.
        const geometry = await webhooksPage.reflowGeometry();
        expect(geometry.overflowX).toBe('auto');
        expect(geometry.wrapperScrolls).toBe(true);
        expect(geometry.pageScrollsSideways).toBe(false);
    });
});
