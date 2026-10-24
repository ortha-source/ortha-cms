import { test, expect } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import { mockWorkspaces } from '../support/api/workspaces';
import {
    mockApiTokensApi,
    API_TOKENS_SEED,
    REVEALED_SECRET
} from '../support/api/apiTokens';

/**
 * The R7 redesign of `/api-tokens`, board by board: the list that says who made
 * each token and what is about to expire (TokensList), creation with access as
 * cards and the expiry as a date (TokensCreate), the one-time secret with a
 * ready request (TokensSecret), and a revoke that says what will break
 * (TokensRevoke).
 */
test.describe('API tokens — redesigned list', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockWorkspaces(page);
    });

    test('the subtitle says how many are live and what expires next', async ({
        page,
        apiTokensPage
    }) => {
        await mockApiTokensApi(page);
        await apiTokensPage.goto();
        await apiTokensPage.table.waitFor();

        await expect(apiTokensPage.subtitle()).toHaveText(
            'Bearer tokens for the content API · 4 active, 1 expires in 12 days'
        );
    });

    test('each token says who created it, falling back to their email', async ({
        page,
        apiTokensPage
    }) => {
        await mockApiTokensApi(page);
        await apiTokensPage.goto();
        await apiTokensPage.table.waitFor();

        await expect(apiTokensPage.row('Production website')).toContainText(
            'by Ada Lovelace · Jan 1'
        );
        await expect(apiTokensPage.row('Orphaned bucket')).toContainText(
            'by ops@orthacms.dev'
        );
    });

    test('a live token expiring within thirty days is flagged', async ({
        page,
        apiTokensPage
    }) => {
        await mockApiTokensApi(page);
        await apiTokensPage.goto();
        await apiTokensPage.table.waitFor();

        await expect(apiTokensPage.rowStatus('Docs search index')).toHaveText(
            'Expires soon'
        );
        await expect(apiTokensPage.rowExpires('Docs search index')).toHaveText(
            'in 12 days'
        );
        // The control: a far-off expiry is a plain date and a plain Active.
        await expect(apiTokensPage.rowStatus('Build pipeline')).toHaveText(
            'Active'
        );
        await expect(apiTokensPage.rowExpires('Build pipeline')).toHaveText(
            'Jan 1, 2099'
        );
    });

    test('opens on Active, with every chip counting what it would show', async ({
        page,
        apiTokensPage
    }) => {
        const api = await mockApiTokensApi(page);
        await apiTokensPage.goto();
        await apiTokensPage.table.waitFor();

        await expect(apiTokensPage.statusChip('Active')).toHaveAttribute(
            'aria-pressed',
            'true'
        );
        await expect(apiTokensPage.statusChip('Active')).toHaveAccessibleName(
            'Active, 4 tokens'
        );
        await expect(apiTokensPage.statusChip('Expired')).toHaveAccessibleName(
            'Expired, 1 token'
        );
        await expect(apiTokensPage.statusChip('Revoked')).toHaveAccessibleName(
            'Revoked, 2 tokens'
        );
        // Revoked and expired are out of the way, not gone.
        await expect(apiTokensPage.row('Leaked laptop token')).toHaveCount(0);
        expect(api.lastListParams?.status).toBe('active');
    });

    test('the chosen chip lives in the URL and survives a reload', async ({
        page,
        apiTokensPage
    }) => {
        const api = await mockApiTokensApi(page);
        await apiTokensPage.goto();
        await apiTokensPage.table.waitFor();

        await apiTokensPage.showStatus('Revoked');
        await expect(page).toHaveURL(/[?&]status=revoked/);
        await expect(apiTokensPage.row('Leaked laptop token')).toBeVisible();
        expect(api.lastListParams?.status).toBe('revoked');

        await page.reload();
        await apiTokensPage.table.waitFor();
        await expect(apiTokensPage.statusChip('Revoked')).toHaveAttribute(
            'aria-pressed',
            'true'
        );
        await expect(apiTokensPage.row('Leaked laptop token')).toBeVisible();

        // Back to the default view, which keeps no `?status=` of its own.
        await apiTokensPage.showStatus('Active');
        await expect(page).not.toHaveURL(/status=/);
    });

    test('search narrows the list on the server and lives in the URL', async ({
        page,
        apiTokensPage
    }) => {
        const api = await mockApiTokensApi(page);
        await apiTokensPage.goto();
        await apiTokensPage.table.waitFor();

        await apiTokensPage.searchBox().fill('docs');

        await expect(page).toHaveURL(/[?&]q=docs/);
        await expect(apiTokensPage.row('Docs search index')).toBeVisible();
        await expect(apiTokensPage.row('Production website')).toHaveCount(0);
        expect(api.lastListParams?.q).toBe('docs');
        // The chips still count every token, not the search result.
        await expect(apiTokensPage.statusChip('Active')).toHaveAccessibleName(
            'Active, 4 tokens'
        );
    });

    test('a search with no match says so and offers the way back', async ({
        page,
        apiTokensPage
    }) => {
        await mockApiTokensApi(page);
        await apiTokensPage.goto();
        await apiTokensPage.table.waitFor();

        await apiTokensPage.searchBox().fill('zzz');

        await expect(
            apiTokensPage.noMatchHeading('No tokens match “zzz”')
        ).toBeVisible();
        // Not the first-token empty state: tokens exist, this view is empty.
        await expect(apiTokensPage.emptyHeading()).toHaveCount(0);

        await apiTokensPage.clearSearchButton().click();
        await expect(apiTokensPage.row('Production website')).toBeVisible();
        await expect(apiTokensPage.searchBox()).toHaveValue('');
    });

    test('an empty Active view is not mistaken for no tokens at all [api-tokens:I-23]', async ({
        page,
        apiTokensPage
    }) => {
        await mockApiTokensApi(page, {
            tokens: API_TOKENS_SEED.filter(
                (token) =>
                    token.revokedAt !== null || token.id === 'tok_expired'
            )
        });
        await apiTokensPage.goto();

        await expect(
            apiTokensPage.noMatchHeading('No active tokens')
        ).toBeVisible();
        // "No API tokens yet" here would invite minting a duplicate of a key
        // that only needs replacing.
        await expect(apiTokensPage.emptyHeading()).toHaveCount(0);
        await expect(apiTokensPage.statusChip('Revoked')).toBeVisible();
    });

    test('New token lives in the top bar', async ({ page, apiTokensPage }) => {
        await mockApiTokensApi(page);
        await apiTokensPage.goto();
        await apiTokensPage.table.waitFor();

        await expect(
            page
                .locator('[data-slot="top-bar"]')
                .getByRole('button', { name: 'New token' })
        ).toBeVisible();
    });
});

test.describe('API tokens — redesigned create', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockWorkspaces(page);
    });

    test('access is two cards that say what each allows', async ({
        page,
        apiTokensPage
    }) => {
        await mockApiTokensApi(page);
        await apiTokensPage.goto();
        await apiTokensPage.table.waitFor();
        await apiTokensPage.openCreate();

        await expect(apiTokensPage.accessCard('Read-only')).toBeChecked();
        await expect(apiTokensPage.accessGroup()).toContainText(
            'Published records only. Right for websites.'
        );
        await expect(apiTokensPage.accessGroup()).toContainText(
            'Create, update and publish. For trusted servers.'
        );
        // The card is the target, not only its radio.
        await apiTokensPage
            .accessGroup()
            .getByText('Create, update and publish. For trusted servers.')
            .click();
        await expect(apiTokensPage.accessCard('Full access')).toBeChecked();
    });

    test('the expiry preset turns into a date', async ({
        page,
        apiTokensPage
    }) => {
        await mockApiTokensApi(page);
        await apiTokensPage.goto();
        await apiTokensPage.table.waitFor();
        await apiTokensPage.openCreate();

        const inAYear = await page.evaluate(() =>
            new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(
                new Date(Date.now() + 365 * 86_400_000)
            )
        );
        await apiTokensPage.expiryOption('1 year').click();
        await expect(apiTokensPage.expiryHint()).toHaveText(
            `On ${inAYear}. We flag it 30 days before.`
        );

        await apiTokensPage.expiryOption('Never').click();
        await expect(apiTokensPage.expiryHint()).toHaveText(
            'It keeps working until someone revokes it.'
        );
    });

    test('workspaces are chips that can be taken back out', async ({
        page,
        apiTokensPage
    }) => {
        const api = await mockApiTokensApi(page);
        await apiTokensPage.goto();
        await apiTokensPage.table.waitFor();
        await apiTokensPage.openCreate();
        await apiTokensPage.nameField().fill('Two then one');

        await apiTokensPage.pickWorkspace('Marketing site');
        await apiTokensPage.pickWorkspace('Product docs');
        await expect(
            apiTokensPage.removeWorkspaceChip('Marketing site')
        ).toBeVisible();
        await expect(
            apiTokensPage.removeWorkspaceChip('Product docs')
        ).toBeVisible();

        await apiTokensPage.removeWorkspaceChip('Marketing site').click();
        await expect(
            apiTokensPage.removeWorkspaceChip('Marketing site')
        ).toHaveCount(0);

        await apiTokensPage.submitCreateButton().click();
        await apiTokensPage.revealDialog().waitFor();
        expect(api.lastCreateBody).toMatchObject({ workspaceIds: ['ws_docs'] });
    });

    test('the name cannot run past the server’s 120 characters', async ({
        page,
        apiTokensPage
    }) => {
        await mockApiTokensApi(page);
        await apiTokensPage.goto();
        await apiTokensPage.table.waitFor();
        await apiTokensPage.openCreate();

        await apiTokensPage.nameField().fill('x'.repeat(130));

        await expect(apiTokensPage.nameField()).toHaveValue('x'.repeat(120));
    });
});

test.describe('API tokens — redesigned reveal', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockWorkspaces(page);
        await mockApiTokensApi(page);
    });

    test('the secret comes with a ready request carrying both headers', async ({
        apiTokensPage
    }) => {
        await apiTokensPage.goto();
        await apiTokensPage.table.waitFor();
        await apiTokensPage.createToken('Docs search');
        await apiTokensPage.secretField().waitFor();

        const block = apiTokensPage.tryItBlock();
        await expect(block).toContainText('/api/v1/content-types');
        await expect(block).toContainText(
            'Authorization: Bearer orthacms_e2eFAK…'
        );
        // The part people miss.
        await expect(block).toContainText('X-Workspace-Id: ws_marketing');
        // Shown elided: the field above is where the secret is read.
        await expect(block).not.toContainText(REVEALED_SECRET);
        await expect(apiTokensPage.revealDialog()).toContainText(
            'Lost it? Revoke this token and create a new one'
        );
    });

    test('a summary line says what was just minted', async ({
        apiTokensPage
    }) => {
        await apiTokensPage.goto();
        await apiTokensPage.table.waitFor();
        await apiTokensPage.createToken('Summed up');
        await apiTokensPage.secretField().waitFor();

        await expect(apiTokensPage.revealDialog()).toContainText(
            /Summed up · Read-only · Marketing site · expires \w{3} \d{1,2}/
        );
    });

    test('copying the request copies the whole secret, and counts as copying it', async ({
        apiTokensPage,
        context,
        page
    }) => {
        await context.grantPermissions(['clipboard-read', 'clipboard-write']);
        await apiTokensPage.goto();
        await apiTokensPage.table.waitFor();
        await apiTokensPage.createToken('Request copied');
        await apiTokensPage.secretField().waitFor();

        await apiTokensPage.copyRequestButton().click();
        await expect(
            apiTokensPage.toast('Request copied, token included')
        ).toBeVisible();
        const clipboard = await page.evaluate(() =>
            (
                globalThis as unknown as {
                    navigator: { clipboard: { readText(): Promise<string> } };
                }
            ).navigator.clipboard.readText()
        );
        expect(clipboard).toContain(`Authorization: Bearer ${REVEALED_SECRET}`);
        expect(clipboard).toContain('X-Workspace-Id: ws_marketing');

        // The credential left the dialog, so Done closes without the guard.
        await apiTokensPage.doneButton().click();
        await expect(apiTokensPage.revealDialog()).toHaveCount(0);
    });

    test('the secret’s Copy turns into Copied', async ({
        apiTokensPage,
        context
    }) => {
        await context.grantPermissions(['clipboard-read', 'clipboard-write']);
        await apiTokensPage.goto();
        await apiTokensPage.table.waitFor();
        await apiTokensPage.createToken('Copied label');
        await apiTokensPage.secretField().waitFor();

        await apiTokensPage.copyButton().click();

        await expect(
            apiTokensPage
                .revealDialog()
                .getByRole('button', { name: 'Copied', exact: true })
        ).toBeVisible();
    });
});

test.describe('API tokens — redesigned revoke', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockWorkspaces(page);
    });

    test('says when it was last used, where, and that writes stop too', async ({
        page,
        apiTokensPage
    }) => {
        await mockApiTokensApi(page);
        await apiTokensPage.goto();
        await apiTokensPage.table.waitFor();

        await apiTokensPage.chooseRevoke('Build pipeline');

        const dialog = apiTokensPage.confirmDialog();
        await expect(dialog).toHaveAccessibleName('Revoke “Build pipeline”?');
        await expect(dialog).toContainText(
            'Anything using it stops at once — it was last used'
        );
        await expect(dialog).toContainText(
            'on Marketing site and Product docs'
        );
        await expect(dialog).toContainText('It has full access');
        await expect(dialog).toContainText('This can’t be undone.');
    });

    test('says so when a token was never used', async ({
        page,
        apiTokensPage
    }) => {
        await mockApiTokensApi(page);
        await apiTokensPage.goto();
        await apiTokensPage.table.waitFor();

        await apiTokensPage.chooseRevoke('Production website');

        await expect(apiTokensPage.confirmDialog()).toContainText(
            'It has never been used, so nothing should break — it covers Marketing site.'
        );
        await expect(apiTokensPage.confirmDialog()).not.toContainText(
            'full access'
        );
    });

    test('cannot be fired twice while the revoke is in flight', async ({
        page,
        apiTokensPage
    }) => {
        const api = await mockApiTokensApi(page, { revokeDelayMs: 1_000 });
        await apiTokensPage.goto();
        await apiTokensPage.table.waitFor();

        await apiTokensPage.chooseRevoke('Production website');
        await apiTokensPage.confirmRevokeButton().click();

        await expect(apiTokensPage.confirmRevokeButton()).toBeDisabled();
        await expect(apiTokensPage.toast('Token revoked')).toBeVisible();
        expect(api.revokeCalls).toBe(1);
    });
});
