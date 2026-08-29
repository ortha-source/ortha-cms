import { test, expect } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import { mockWorkspaces } from '../support/api/workspaces';
import {
    mockWebhooksApi,
    REVEALED_SECRET,
    WEBHOOKS_SEED
} from '../support/api/webhooks';

/**
 * A failed query is not instant: the shared client retries a 5xx three times on
 * a backoff ladder before it settles, so an error state can take ~10s to reach
 * the screen. Assertions on one wait that long rather than racing it.
 */
const SETTLED = { timeout: 20_000 };

/**
 * The webhooks pages (`@orthacms/webhooks-admin`): the list's derived states,
 * the four page states, the editor's "All …" toggles, the one-time secret, and
 * the detail page's two tabs.
 */
test.describe('Webhooks', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockWorkspaces(page);
    });

    test.describe('the endpoint list', () => {
        test('renders every column the table promises', async ({
            page,
            webhooksPage
        }) => {
            await mockWebhooksApi(page);
            await webhooksPage.goto();
            await webhooksPage.table.waitFor();

            for (const header of [
                'Name',
                'URL',
                'Sends',
                'State',
                'Last delivery'
            ]) {
                await expect(
                    webhooksPage.table.getByRole('columnheader', {
                        name: header
                    })
                ).toBeVisible();
            }
        });

        test('reads an empty filter as "all", not as "none"', async ({
            page,
            webhooksPage
        }) => {
            await mockWebhooksApi(page);
            await webhooksPage.goto();
            await webhooksPage.table.waitFor();

            // The seed's first row has `eventKinds: []` and
            // `allWorkspaces: true`. Rendering that as "0 events" would be the
            // exact inversion of what the subscription model means.
            const row = webhooksPage.row('Rebuild the storefront');
            await expect(row).toContainText('All events');
            await expect(row).toContainText('All workspaces');
        });

        test('counts a named filter', async ({ page, webhooksPage }) => {
            await mockWebhooksApi(page);
            await webhooksPage.goto();
            await webhooksPage.table.waitFor();

            const row = webhooksPage.row('Search re-index');
            await expect(row).toContainText('2 events');
            await expect(row).toContainText('1 workspace');
            await expect(row).toContainText('1 type');
        });

        test('tells "paused" apart from "stopped after failures"', async ({
            page,
            webhooksPage
        }) => {
            await mockWebhooksApi(page);
            await webhooksPage.goto();
            await webhooksPage.table.waitFor();

            // Both are `enabled: false`; only one needs someone to do
            // something. Rendering them identically is the bug this asserts
            // against.
            await expect(webhooksPage.row('Search re-index')).toContainText(
                'Paused'
            );
            await expect(webhooksPage.row('Old staging preview')).toContainText(
                'Stopped after failures'
            );
        });

        test('shows the empty state with the create action', async ({
            page,
            webhooksPage
        }) => {
            await mockWebhooksApi(page, { endpoints: [] });
            await webhooksPage.goto();

            await expect(webhooksPage.emptyHeading()).toBeVisible();
            await expect(webhooksPage.newWebhookButton).toBeVisible();
        });

        test('shows an error state, never the empty one', async ({
            page,
            webhooksPage
        }) => {
            await mockWebhooksApi(page, { listFails: true });
            await webhooksPage.goto();

            // A failed load that reads as "nothing configured" would have an
            // operator adding a second copy of an endpoint that already exists.
            await expect(webhooksPage.errorAlert()).toBeVisible(SETTLED);
            await expect(webhooksPage.emptyHeading()).toBeHidden();
        });

        test('is reachable from the sidebar', async ({
            page,
            webhooksPage
        }) => {
            await mockWebhooksApi(page);
            await webhooksPage.goto();
            await expect(webhooksPage.navLink).toBeVisible();
        });
    });

    test.describe('permissions', () => {
        test('shows the no-access state without webhooks:read', async ({
            page,
            webhooksPage
        }) => {
            await mockSignedIn(page, {
                permissions: ['workspaces:read', 'content:read']
            });
            await mockWebhooksApi(page);
            await webhooksPage.goto();

            await expect(webhooksPage.noAccessHeading()).toBeVisible();
            await expect(webhooksPage.table).toBeHidden();
        });

        test('hides the create action without webhooks:manage', async ({
            page,
            webhooksPage
        }) => {
            await mockSignedIn(page, {
                permissions: ['workspaces:read', 'webhooks:read']
            });
            await mockWebhooksApi(page);
            await webhooksPage.goto();
            await webhooksPage.table.waitFor();

            await expect(webhooksPage.newWebhookButton).toBeHidden();
        });
    });

    test.describe('creating one', () => {
        test('submits no filter values when "all" is chosen', async ({
            page,
            webhooksPage
        }) => {
            await mockWebhooksApi(page);
            await webhooksPage.goto();
            await webhooksPage.table.waitFor();

            const posted = page.waitForRequest(
                (request) =>
                    request.url().endsWith('/api/webhooks') &&
                    request.method() === 'POST'
            );

            await webhooksPage.newWebhookButton.click();
            await webhooksPage.nameField().fill('Cache purge');
            await webhooksPage.urlField().fill('https://cdn.example.com/hooks');
            await webhooksPage.allWorkspacesToggle().click();
            await webhooksPage.submitButton().click();

            const body = (await posted).postDataJSON();
            // Empty arrays and the flag — not an enumerated list, which would
            // silently stop covering the next workspace or event kind.
            expect(body).toMatchObject({
                name: 'Cache purge',
                url: 'https://cdn.example.com/hooks',
                allWorkspaces: true,
                workspaceIds: [],
                eventKinds: []
            });
        });

        test('reveals the signing secret exactly once', async ({
            page,
            webhooksPage
        }) => {
            await mockWebhooksApi(page);
            await webhooksPage.goto();
            await webhooksPage.table.waitFor();

            await webhooksPage.newWebhookButton.click();
            await webhooksPage.nameField().fill('Cache purge');
            await webhooksPage.urlField().fill('https://cdn.example.com/hooks');
            await webhooksPage.allWorkspacesToggle().click();
            await webhooksPage.submitButton().click();

            // Readable and selectable without the Copy button, because the
            // clipboard can be refused and this is the only copy that exists.
            await expect(webhooksPage.secretField()).toHaveValue(
                REVEALED_SECRET
            );
            await expect(webhooksPage.copySecretButton()).toBeVisible();
        });

        test('asks before dismissing an uncopied secret', async ({
            page,
            webhooksPage
        }) => {
            await mockWebhooksApi(page);
            await webhooksPage.goto();
            await webhooksPage.table.waitFor();

            await webhooksPage.newWebhookButton.click();
            await webhooksPage.nameField().fill('Cache purge');
            await webhooksPage.urlField().fill('https://cdn.example.com/hooks');
            await webhooksPage.allWorkspacesToggle().click();
            await webhooksPage.submitButton().click();
            await expect(webhooksPage.secretField()).toBeVisible();

            // Esc is reached by reflex, and the secret cannot be shown again.
            await page.keyboard.press('Escape');
            await expect(webhooksPage.uncopiedWarning()).toBeVisible();
            await expect(webhooksPage.secretField()).toBeVisible();
        });

        test('shows a refused URL in the form and keeps it open', async ({
            page,
            webhooksPage
        }) => {
            const refusal =
                '127.0.0.1 is a private or reserved address. Webhooks may only reach public hosts.';
            await mockWebhooksApi(page, { createRejects: refusal });
            await webhooksPage.goto();
            await webhooksPage.table.waitFor();

            await webhooksPage.newWebhookButton.click();
            await webhooksPage.nameField().fill('Local');
            await webhooksPage.urlField().fill('https://127.0.0.1/hooks');
            await webhooksPage.allWorkspacesToggle().click();
            await webhooksPage.submitButton().click();

            // The server writes that message for whoever typed the URL, so it
            // belongs in the dialog — and the dialog stays open to be fixed.
            await expect(
                webhooksPage.dialog().getByText(refusal)
            ).toBeVisible();
            await expect(webhooksPage.dialog()).toBeVisible();
        });

        test('does not offer ping as something to subscribe to', async ({
            page,
            webhooksPage
        }) => {
            await mockWebhooksApi(page);
            await webhooksPage.goto();
            await webhooksPage.table.waitFor();

            await webhooksPage.newWebhookButton.click();
            // The picker only exists once "Every event" is switched off.
            await webhooksPage.openEventPicker();

            await expect(
                webhooksPage.eventOption('Entry published')
            ).toBeVisible();
            await expect(webhooksPage.eventOption('Test ping')).toBeHidden();
        });
    });

    test.describe('one endpoint', () => {
        test('opens on the delivery log', async ({ page, webhooksPage }) => {
            await mockWebhooksApi(page);
            await webhooksPage.gotoDetail(WEBHOOKS_SEED[0].id);

            // "Did it arrive?" is the question asked every time; "what does it
            // send?" is asked once, when it was created.
            await expect(webhooksPage.deliveriesTable()).toBeVisible();
            await expect(webhooksPage.deliveriesTable()).toContainText(
                'entry.published'
            );
        });

        test('shows only the secret hint, never the secret', async ({
            page,
            webhooksPage
        }) => {
            await mockWebhooksApi(page);
            await webhooksPage.gotoDetail(WEBHOOKS_SEED[0].id);
            await webhooksPage.settingsTab().click();

            await expect(webhooksPage.secretHint('a1b2')).toBeVisible();
            await expect(webhooksPage.anyText(REVEALED_SECRET)).toBeHidden();
        });

        test('says why an endpoint switched itself off', async ({
            page,
            webhooksPage
        }) => {
            await mockWebhooksApi(page);
            await webhooksPage.gotoDetail('wh_broken');

            await expect(webhooksPage.autoDisabledAlert()).toBeVisible();
            // And says what to do about it, which the list row cannot.
            await expect(webhooksPage.autoDisabledAlert()).toContainText(
                'switch the webhook back on'
            );
        });

        test('opens one delivery with the body that was sent', async ({
            page,
            webhooksPage
        }) => {
            await mockWebhooksApi(page);
            await webhooksPage.gotoDetail(WEBHOOKS_SEED[0].id);
            await webhooksPage.deliveriesTable().waitFor();

            await webhooksPage.firstDeliveryViewButton().click();

            const sheet = webhooksPage.deliverySheet();
            await expect(sheet).toContainText('entry.published');
            // The stored body, verbatim — the only version worth debugging
            // against.
            await expect(sheet).toContainText('"eventId": "evt_1"');
            await expect(sheet).toContainText('received');
        });
    });
});
