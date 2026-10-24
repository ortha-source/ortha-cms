import { test, expect } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import { mockWorkspaces } from '../support/api/workspaces';
import { mockApiTokensApi, REVEALED_SECRET } from '../support/api/apiTokens';
import type { BrowserGlobals, EvalInput } from '../support/browserGlobals';

/**
 * Keyboard operability for the API tokens page — the half axe cannot see. Two
 * things matter more here than on an ordinary list page: the one-time secret
 * must be reachable without a pointer (it is the only copy of a credential),
 * and a revoke must not strand focus, because the control it would return to is
 * unmounted by the very mutation that succeeded.
 */
test.describe('API tokens keyboard operability', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockWorkspaces(page);
        await mockApiTokensApi(page);
    });

    test('the create dialog opens with the Name field focused', async ({
        apiTokensPage,
        page
    }) => {
        await apiTokensPage.goto();
        await apiTokensPage.table.waitFor();
        await apiTokensPage.newTokenButton.press('Enter');
        await apiTokensPage.createDialog().waitFor();

        await expect(apiTokensPage.nameField()).toBeFocused();
        await expect(page.getByRole('dialog')).toBeVisible();
    });

    test('Escape closes the workspace popover without closing the dialog', async ({
        apiTokensPage,
        page
    }) => {
        await apiTokensPage.goto();
        await apiTokensPage.table.waitFor();
        await apiTokensPage.openCreate();

        await apiTokensPage.workspacesSelect().press('Enter');
        await expect(page.getByRole('listbox')).toBeVisible();

        await page.keyboard.press('Escape');
        await expect(page.getByRole('listbox')).toHaveCount(0);
        // Losing the whole form to a popover dismissal would throw away the
        // name the admin already typed.
        await expect(apiTokensPage.createDialog()).toBeVisible();
    });

    test('the secret is a tab stop, so it can be read and copied by hand', async ({
        apiTokensPage,
        page
    }) => {
        await apiTokensPage.goto();
        await apiTokensPage.table.waitFor();
        await apiTokensPage.createToken('Keyboard token');
        await apiTokensPage.secretField().waitFor();

        // Walk the dialog's tab ring and prove the secret is on it. Before the
        // fix the ring was Copy → Done → Close, and a failed clipboard write
        // left no way to obtain the credential at all.
        const stops: string[] = [];
        for (let index = 0; index < 4; index += 1) {
            stops.push(await apiTokensPage.focusedDescription());
            await page.keyboard.press('Tab');
        }
        expect(stops.join(' | ')).toContain('API token secret');
    });

    test('the whole secret is exposed, not just what fits on screen', async ({
        apiTokensPage,
        page
    }) => {
        await apiTokensPage.goto();
        await apiTokensPage.table.waitFor();
        await apiTokensPage.createToken('Full value');
        await apiTokensPage.secretField().waitFor();

        // The field may be visually truncated (it always is on a phone), so
        // the value — not the rendered text — is what assistive tech and
        // Ctrl+C have to carry.
        await expect(apiTokensPage.secretField()).toHaveValue(REVEALED_SECRET);
        await page.setViewportSize({ width: 360, height: 800 });
        const clipped = await page.evaluate(() => {
            const { document } = globalThis as unknown as BrowserGlobals;
            const input = document.querySelector(
                'input[readonly]'
            ) as EvalInput | null;
            return input ? input.scrollWidth > input.clientWidth : false;
        });
        expect(clipped).toBe(true);
        await expect(apiTokensPage.secretField()).toHaveValue(REVEALED_SECRET);
    });

    test('a revoke lands focus somewhere real instead of on the body [api-tokens:I-25]', async ({
        apiTokensPage,
        page
    }) => {
        await apiTokensPage.goto();
        await apiTokensPage.table.waitFor();

        await apiTokensPage.rowActions('Production website').focus();
        await page.keyboard.press('Enter');
        await page.getByRole('menuitem', { name: 'Revoke' }).press('Enter');
        await apiTokensPage.confirmDialog().waitFor();
        await apiTokensPage.confirmRevokeButton().press('Enter');

        // The revoked token leaves the Active view, kebab and all.
        await expect(apiTokensPage.row('Production website')).toHaveCount(0);
        // Radix restores focus to the kebab, which this mutation just unmounted
        // — so without an anchor the next Tab restarts above the app sidebar
        // (WCAG 2.4.3).
        await expect
            .poll(() => apiTokensPage.focusedDescription())
            .not.toBe('BODY');
    });

    test('closing the reveal dialog lands focus somewhere real too', async ({
        apiTokensPage
    }) => {
        await apiTokensPage.goto();
        await apiTokensPage.table.waitFor();
        await apiTokensPage.createToken('Focus after reveal');
        await apiTokensPage.secretField().waitFor();

        await apiTokensPage.doneButton().click();
        await apiTokensPage.closeWithoutCopyingButton().click();
        await expect(apiTokensPage.revealDialog()).toHaveCount(0);

        // This dialog is opened programmatically, with no `DialogTrigger`, and
        // the control that was focused when it opened — the create dialog's
        // submit — was unmounted in the same tick. Radix therefore has nothing
        // to restore to and focus fell to `<body>`: the keyboard user who was
        // just handed a credential is dropped at the top of the document, and
        // the next Tab restarts above the app sidebar (WCAG 2.4.3).
        await expect
            .poll(() => apiTokensPage.focusedDescription())
            .not.toBe('BODY');
    });

    test('the status chips are buttons a keyboard can press', async ({
        apiTokensPage,
        page
    }) => {
        await apiTokensPage.goto();
        await apiTokensPage.table.waitFor();

        await apiTokensPage.statusChip('Expired').focus();
        await page.keyboard.press('Enter');

        await expect(apiTokensPage.statusChip('Expired')).toHaveAttribute(
            'aria-pressed',
            'true'
        );
        await expect(apiTokensPage.row('Old preview build')).toBeVisible();
        // The chip keeps focus: the list swapped under it, the control did not.
        await expect(apiTokensPage.statusChip('Expired')).toBeFocused();
    });

    test('access and expiry are arrow-key radio groups', async ({
        apiTokensPage,
        page
    }) => {
        await apiTokensPage.goto();
        await apiTokensPage.table.waitFor();
        await apiTokensPage.openCreate();

        // Held, not pressed: Radix moves roving focus a tick after the
        // keydown and only checks the radio it lands on while the arrow is
        // still down — as it is for a person, and is not for an instant
        // `press`.
        await apiTokensPage.accessCard('Read-only').focus();
        await page.keyboard.down('ArrowRight');
        await expect(apiTokensPage.accessCard('Full access')).toBeChecked();
        await page.keyboard.up('ArrowRight');

        await apiTokensPage.expiryOption('30 days').focus();
        await page.keyboard.press('ArrowRight');
        await expect(apiTokensPage.expiryOption('90 days')).toBeFocused();
        await page.keyboard.press('Space');
        await expect(apiTokensPage.expiryOption('90 days')).toHaveAttribute(
            'aria-checked',
            'true'
        );
    });

    test('a picked workspace’s chip can be removed from the keyboard', async ({
        apiTokensPage,
        page
    }) => {
        await apiTokensPage.goto();
        await apiTokensPage.table.waitFor();
        await apiTokensPage.openCreate();
        await apiTokensPage.pickWorkspace('Marketing site');

        await apiTokensPage.removeWorkspaceChip('Marketing site').focus();
        await page.keyboard.press('Enter');

        await expect(
            apiTokensPage.removeWorkspaceChip('Marketing site')
        ).toHaveCount(0);
        await expect(apiTokensPage.createDialog()).toBeVisible();
    });

    test('the kebab is named per row, so a menu is never ambiguous', async ({
        apiTokensPage
    }) => {
        await apiTokensPage.goto();
        await apiTokensPage.table.waitFor();

        await expect(
            apiTokensPage.rowActions('Production website')
        ).toBeVisible();
        await expect(apiTokensPage.rowActions('Build pipeline')).toBeVisible();
    });
});
