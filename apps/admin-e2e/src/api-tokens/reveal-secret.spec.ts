import { test, expect } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import { mockWorkspaces } from '../support/api/workspaces';
import { mockApiTokensApi, REVEALED_SECRET } from '../support/api/apiTokens';
import type {
    BrowserGlobals,
    EvalFiber,
    EvalInput,
    EvalQueryClient
} from '../support/browserGlobals';

/**
 * The reveal-once dialog — the highest-stakes interaction in the unit. The
 * server returns the plaintext exactly once and can never return it again, so
 * every path out of this dialog either captures the credential or destroys it.
 *
 * Three properties are pinned here because losing any one of them silently
 * costs a live credential: the secret is reachable **without** the Copy button,
 * a refused clipboard write says so, and a bare dismissal asks first. A fourth
 * is pinned for the opposite reason — the plaintext must not linger anywhere
 * after the dialog is gone.
 */
test.describe('API token reveal-once dialog', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockWorkspaces(page);
        await mockApiTokensApi(page);
    });

    test('shows the secret in a labelled, focusable field', async ({
        apiTokensPage
    }) => {
        await apiTokensPage.goto();
        await apiTokensPage.table.waitFor();
        await apiTokensPage.createToken('Reveal me');

        await expect(apiTokensPage.revealDialog()).toBeVisible();
        await expect(apiTokensPage.revealDialog()).toContainText(
            'This is the only time the token is shown.'
        );
        // A bare `<code>` block would be unreachable by keyboard and clipped by
        // `truncate` with no way to scroll it — the credential would exist only
        // behind the Copy button.
        await expect(apiTokensPage.secretField()).toHaveValue(REVEALED_SECRET);
        await expect(apiTokensPage.secretField()).toBeEditable({
            editable: false
        });
    });

    test('focusing the secret selects it, so Ctrl+C is a real fallback', async ({
        apiTokensPage,
        page
    }) => {
        await apiTokensPage.goto();
        await apiTokensPage.table.waitFor();
        await apiTokensPage.createToken('Selectable');
        await apiTokensPage.secretField().waitFor();

        await apiTokensPage.secretField().focus();
        const selected = await page.evaluate(() => {
            const { document } = globalThis as unknown as BrowserGlobals;
            const input = document.activeElement as EvalInput | null;
            return input?.value.slice(
                input.selectionStart ?? 0,
                input.selectionEnd ?? 0
            );
        });
        expect(selected).toBe(REVEALED_SECRET);
    });

    test('a copy that works confirms it', async ({
        apiTokensPage,
        context
    }) => {
        await context.grantPermissions(['clipboard-read', 'clipboard-write']);
        await apiTokensPage.goto();
        await apiTokensPage.table.waitFor();
        await apiTokensPage.createToken('Copyable');
        await apiTokensPage.secretField().waitFor();
        await apiTokensPage.copyButton().click();

        await expect(apiTokensPage.toast('Copied to clipboard')).toBeVisible();
    });

    test('a refused clipboard write says so instead of failing silently', async ({
        apiTokensPage
    }) => {
        // Denied permission, an insecure origin and an unfocused document all
        // reject the same way. Unhandled, the button simply appears dead — and
        // this is the only chance to capture the credential.
        await apiTokensPage.denyClipboard();
        await apiTokensPage.goto();
        await apiTokensPage.table.waitFor();
        await apiTokensPage.createToken('Uncopyable');
        await apiTokensPage.secretField().waitFor();
        await apiTokensPage.copyButton().click();

        await expect(
            apiTokensPage.toast(
                'Couldn’t reach the clipboard. Select the token above and copy it manually.'
            )
        ).toBeVisible();
        // And the dialog stays put, so the field is still there to select.
        await expect(apiTokensPage.secretField()).toBeVisible();
    });

    test('Done asks before discarding an uncopied secret [api-tokens:I-04]', async ({
        apiTokensPage
    }) => {
        await apiTokensPage.goto();
        await apiTokensPage.table.waitFor();
        await apiTokensPage.createToken('Nearly lost');
        await apiTokensPage.secretField().waitFor();

        await apiTokensPage.doneButton().click();
        await expect(apiTokensPage.uncopiedWarning()).toBeVisible();
        await expect(apiTokensPage.revealDialog()).toBeVisible();

        await apiTokensPage.keepOpenButton().click();
        await expect(apiTokensPage.uncopiedWarning()).toHaveCount(0);
        await expect(apiTokensPage.secretField()).toHaveValue(REVEALED_SECRET);

        await apiTokensPage.doneButton().click();
        await apiTokensPage.closeWithoutCopyingButton().click();
        await expect(apiTokensPage.revealDialog()).toHaveCount(0);
    });

    test('Escape asks too — every dismissal path funnels through the guard [api-tokens:I-04]', async ({
        apiTokensPage,
        page
    }) => {
        await apiTokensPage.goto();
        await apiTokensPage.table.waitFor();
        await apiTokensPage.createToken('Escaped');
        await apiTokensPage.secretField().waitFor();

        await page.keyboard.press('Escape');
        await expect(apiTokensPage.uncopiedWarning()).toBeVisible();
        await expect(apiTokensPage.revealDialog()).toBeVisible();
    });

    test('the backdrop asks too — a stray click must not cost a credential [api-tokens:I-04]', async ({
        apiTokensPage
    }) => {
        await apiTokensPage.goto();
        await apiTokensPage.table.waitFor();
        await apiTokensPage.createToken('Clicked away');
        await apiTokensPage.secretField().waitFor();

        // The easiest dismissal to reach by accident: the dialog is centred and
        // the backdrop is the whole rest of the viewport. It reaches
        // `onOpenChange(false)` exactly like Done and Escape, so it has to hit
        // the same guard — a click 5 px from the corner cannot be allowed to
        // destroy the only copy of a token.
        await apiTokensPage.clickBackdrop();

        await expect(apiTokensPage.uncopiedWarning()).toBeVisible();
        await expect(apiTokensPage.revealDialog()).toBeVisible();
        await expect(apiTokensPage.secretField()).toHaveValue(REVEALED_SECRET);
    });

    test('the corner X asks too, so no exit is unguarded [api-tokens:I-04]', async ({
        apiTokensPage
    }) => {
        await apiTokensPage.goto();
        await apiTokensPage.table.waitFor();
        await apiTokensPage.createToken('Closed by X');
        await apiTokensPage.secretField().waitFor();

        // The fourth and last way out. `DialogContent` renders this button
        // itself, so it is easy to forget it exists — and it is the one exit
        // that looks like the *intended* way to leave a dialog.
        await apiTokensPage.revealCloseButton().click();

        await expect(apiTokensPage.uncopiedWarning()).toBeVisible();
        await expect(apiTokensPage.revealDialog()).toBeVisible();
        await expect(apiTokensPage.secretField()).toHaveValue(REVEALED_SECRET);

        // And the guard is answerable from here as well, not a dead end.
        await apiTokensPage.keepOpenButton().click();
        await expect(apiTokensPage.uncopiedWarning()).toHaveCount(0);
    });

    test('once copied, the dialog closes without argument', async ({
        apiTokensPage,
        context
    }) => {
        await context.grantPermissions(['clipboard-read', 'clipboard-write']);
        await apiTokensPage.goto();
        await apiTokensPage.table.waitFor();
        await apiTokensPage.createToken('Captured');
        await apiTokensPage.secretField().waitFor();

        await apiTokensPage.copyButton().click();
        await apiTokensPage.toast('Copied to clipboard').waitFor();
        await apiTokensPage.doneButton().click();

        await expect(apiTokensPage.revealDialog()).toHaveCount(0);
    });

    test('a second mint does not inherit the first one’s “copied”', async ({
        apiTokensPage,
        context
    }) => {
        await context.grantPermissions(['clipboard-read', 'clipboard-write']);
        await apiTokensPage.goto();
        await apiTokensPage.table.waitFor();

        await apiTokensPage.createToken('First mint');
        await apiTokensPage.secretField().waitFor();
        await apiTokensPage.copyButton().click();
        await apiTokensPage.toast('Copied to clipboard').waitFor();
        await apiTokensPage.doneButton().click();
        await expect(apiTokensPage.revealDialog()).toHaveCount(0);

        // The dialog stays mounted between mints — only `secret` changes — so a
        // `copied` flag left standing from the first token would wave the second
        // one straight out of the door, and that one really has not been copied.
        await apiTokensPage.createToken('Second mint');
        await apiTokensPage.secretField().waitFor();
        await expect(apiTokensPage.secretField()).toHaveValue(REVEALED_SECRET);

        await apiTokensPage.doneButton().click();
        await expect(apiTokensPage.uncopiedWarning()).toBeVisible();
        await expect(apiTokensPage.revealDialog()).toBeVisible();
    });

    test('the plaintext is gone from the client once the dialog is dismissed [api-tokens:I-03]', async ({
        apiTokensPage,
        page
    }) => {
        await apiTokensPage.goto();
        await apiTokensPage.table.waitFor();
        await apiTokensPage.createToken('Forget me');
        await apiTokensPage.secretField().waitFor();
        await apiTokensPage.doneButton().click();
        await apiTokensPage.closeWithoutCopyingButton().click();
        await expect(apiTokensPage.revealDialog()).toHaveCount(0);

        // The dialog's own copy says the token is gone. That has to be true of
        // the *client* too — the create mutation's cached result carries the
        // secret, and TanStack keeps a settled mutation for its `gcTime`, so at
        // the default it would outlive the dialog by five minutes and follow the
        // user across the SPA. Read the whole client back and assert it isn't
        // there.
        const lingering = await page.evaluate((secret) => {
            const { document, localStorage, sessionStorage, location } =
                globalThis as unknown as BrowserGlobals;

            const root = document.getElementById('root');
            if (!root) return 'no-root';
            const fiberKey = Object.keys(root).find(
                (key) =>
                    key.startsWith('__reactContainer$') ||
                    key.startsWith('__reactFiber$')
            );
            if (!fiberKey) return 'no-fiber';

            // Nothing exposes the app's QueryClient, so walk the fiber tree for
            // the object carrying the two caches.
            let client: EvalQueryClient | null = null;
            const looksLikeClient = (
                value: unknown
            ): value is EvalQueryClient =>
                typeof (value as EvalQueryClient | null)?.getMutationCache ===
                'function';
            const visit = (fiber: EvalFiber | null, depth: number): void => {
                if (!fiber || depth > 300 || client) return;
                for (const prop of [
                    'memoizedProps',
                    'memoizedState',
                    'stateNode'
                ]) {
                    const value = fiber[prop] as
                        | { client?: unknown }
                        | undefined;
                    if (!value || typeof value !== 'object') continue;
                    if (looksLikeClient(value)) client = value;
                    else if (looksLikeClient(value.client))
                        client = value.client;
                }
                visit(fiber.child ?? null, depth + 1);
                visit(fiber.sibling ?? null, depth + 1);
            };
            const container = root[fiberKey] as
                | (EvalFiber & { current?: EvalFiber })
                | undefined;
            visit(container?.current ?? container ?? null, 0);
            if (!client) return 'no-client';
            const found: EvalQueryClient = client;

            const has = (state: unknown) =>
                JSON.stringify(state ?? null).includes(secret);
            const holders: string[] = [];
            if (
                found
                    .getMutationCache()
                    .getAll()
                    .some((m) => has(m.state))
            ) {
                holders.push('mutation-cache');
            }
            if (
                found
                    .getQueryCache()
                    .getAll()
                    .some((q) => has(q.state))
            ) {
                holders.push('query-cache');
            }
            if (
                Object.keys(localStorage).some((key) =>
                    (localStorage.getItem(key) ?? '').includes(secret)
                )
            ) {
                holders.push('localStorage');
            }
            if (
                Object.keys(sessionStorage).some((key) =>
                    (sessionStorage.getItem(key) ?? '').includes(secret)
                )
            ) {
                holders.push('sessionStorage');
            }
            if (location.href.includes(secret)) holders.push('url');
            if (document.documentElement.innerHTML.includes(secret)) {
                holders.push('dom');
            }
            return holders.join(',');
        }, REVEALED_SECRET);

        expect(lingering).toBe('');
    });

    test('reloading after a create leaves the token but not its secret', async ({
        apiTokensPage,
        page
    }) => {
        await apiTokensPage.goto();
        await apiTokensPage.table.waitFor();
        await apiTokensPage.createToken('Survivor');
        await apiTokensPage.secretField().waitFor();

        await page.reload();
        await apiTokensPage.table.waitFor();

        await expect(apiTokensPage.row('Survivor')).toBeVisible();
        await expect(apiTokensPage.row('Survivor')).not.toContainText(
            REVEALED_SECRET
        );
        await expect(apiTokensPage.revealDialog()).toHaveCount(0);
    });
});
