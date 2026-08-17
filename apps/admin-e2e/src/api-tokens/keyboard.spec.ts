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

        // The field is visually truncated by design, so the value — not the
        // rendered text — is what assistive tech and Ctrl+C have to carry.
        await expect(apiTokensPage.secretField()).toHaveValue(REVEALED_SECRET);
        const clipped = await page.evaluate(() => {
            const { document } = globalThis as unknown as BrowserGlobals;
            const input = document.querySelector(
                'input[readonly]'
            ) as EvalInput | null;
            return input ? input.scrollWidth > input.clientWidth : false;
        });
        expect(clipped).toBe(true);
    });

    test('a revoke lands focus somewhere real instead of on the body', async ({
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

        await expect(apiTokensPage.rowStatus('Production website')).toHaveText(
            'Revoked'
        );
        // Radix restores focus to the kebab, which this mutation just unmounted
        // — so without an anchor the next Tab restarts above the app sidebar
        // (WCAG 2.4.3).
        await expect
            .poll(() => apiTokensPage.focusedDescription())
            .not.toBe('BODY');
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
