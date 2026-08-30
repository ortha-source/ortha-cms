import { test, expect } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import {
    mockWorkspaces,
    mockWorkspacesUnavailable
} from '../support/api/workspaces';
import { mockApiTokensApi, manyApiTokens } from '../support/api/apiTokens';
import { expectNoA11yViolations } from '../support/a11y';
import type { BrowserGlobals } from '../support/browserGlobals';

/** A retried 5xx settles on a backoff ladder; error states are waited out. */
const SETTLED = { timeout: 20_000 };

/**
 * Accessibility scans (axe, WCAG 2.1 A/AA) of the API tokens page and its
 * dynamic states — the table, the loading skeleton, the error state, the create
 * dialog, the reveal-once dialog and the revoke confirm — plus the checks axe
 * cannot make: that the table scrolls rather than clips at a 320 px viewport,
 * and that the two selects have real accessible names.
 *
 * A regression guard, not a conformance claim.
 */
test.describe('API tokens accessibility (axe, WCAG 2.1 A/AA)', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockWorkspaces(page);
    });

    test('table — initial', async ({ page, apiTokensPage, makeAxe }) => {
        await mockApiTokensApi(page);
        await apiTokensPage.goto();
        await apiTokensPage.table.waitFor();
        await expectNoA11yViolations(makeAxe());
    });

    test('table — loading skeleton', async ({
        page,
        apiTokensPage,
        makeAxe
    }) => {
        await mockApiTokensApi(page, { delayMs: 30_000 });
        await apiTokensPage.goto();
        await apiTokensPage.skeleton().waitFor();
        await expectNoA11yViolations(makeAxe());
    });

    test('list error state', async ({ page, apiTokensPage, makeAxe }) => {
        await mockApiTokensApi(page, { listStatus: 500 });
        await apiTokensPage.goto();
        await apiTokensPage.errorAlert().waitFor(SETTLED);
        await expectNoA11yViolations(makeAxe());
    });

    test('empty state', async ({ page, apiTokensPage, makeAxe }) => {
        await mockApiTokensApi(page, { tokens: [] });
        await apiTokensPage.goto();
        await apiTokensPage.emptyHeading().waitFor();
        await expectNoA11yViolations(makeAxe());
    });

    test('create dialog — open', async ({ page, apiTokensPage, makeAxe }) => {
        await mockApiTokensApi(page);
        await apiTokensPage.goto();
        await apiTokensPage.table.waitFor();
        await apiTokensPage.openCreate();
        await expectNoA11yViolations(makeAxe());
    });

    // The workspace selector's **open** popover is deliberately not scanned:
    // Radix gives a `PopoverContent` `role="dialog"`, the design-system
    // `MultiSelect` passes it no name, and `aria-dialog-name` would fire on it
    // in every consumer at once. The fix belongs in the component (the Content
    // Library's column picker already does it with `aria-labelledby`); add the
    // scan here in the same change.

    test('create dialog — the two selects carry real names', async ({
        page,
        apiTokensPage
    }) => {
        await mockApiTokensApi(page);
        await apiTokensPage.goto();
        await apiTokensPage.table.waitFor();
        await apiTokensPage.openCreate();

        // A `<Label>` with no `htmlFor` labels nothing: both triggers used to
        // announce only their current value ("Read-only", "Never"), leaving no
        // way to tell the access control from the expiry one — and the choice
        // decides whether the credential can publish and delete content.
        await expect(apiTokensPage.accessSelect()).toBeVisible();
        await expect(apiTokensPage.expiresSelect()).toBeVisible();
    });

    test('create dialog — workspace fetch failed', async ({
        page,
        apiTokensPage,
        makeAxe
    }) => {
        await mockApiTokensApi(page);
        await mockWorkspacesUnavailable(page);
        await apiTokensPage.goto();
        await apiTokensPage.heading.waitFor();
        await apiTokensPage.openCreate();
        await apiTokensPage.workspacesError().waitFor(SETTLED);
        await expectNoA11yViolations(makeAxe());
    });

    test('reveal dialog — secret shown', async ({
        page,
        apiTokensPage,
        makeAxe
    }) => {
        await mockApiTokensApi(page);
        await apiTokensPage.goto();
        await apiTokensPage.table.waitFor();
        await apiTokensPage.createToken('Scanned token');
        await apiTokensPage.secretField().waitFor();
        await expectNoA11yViolations(makeAxe());
    });

    test('reveal dialog — confirming an uncopied close', async ({
        page,
        apiTokensPage,
        makeAxe
    }) => {
        await mockApiTokensApi(page);
        await apiTokensPage.goto();
        await apiTokensPage.table.waitFor();
        await apiTokensPage.createToken('Scanned guard');
        await apiTokensPage.secretField().waitFor();
        await apiTokensPage.doneButton().click();
        await apiTokensPage.uncopiedWarning().waitFor();

        // The one state in this unit that exists only while a credential is at
        // risk: a second alert appears inside an open dialog and the footer
        // swaps one button for two. Whoever has to read that alert to keep
        // their token is exactly the user least able to recover from it being
        // unannounced.
        await expectNoA11yViolations(makeAxe());
    });

    test('revoke confirm — open', async ({ page, apiTokensPage, makeAxe }) => {
        await mockApiTokensApi(page);
        await apiTokensPage.goto();
        await apiTokensPage.table.waitFor();
        await apiTokensPage.chooseRevoke('Production website');
        await expectNoA11yViolations(makeAxe());
    });

    test('no-access state', async ({ page, apiTokensPage, makeAxe }) => {
        await mockSignedIn(page, { permissions: ['workspaces:read'] });
        await mockApiTokensApi(page);
        await apiTokensPage.goto();
        await apiTokensPage.noAccessHeading().waitFor();
        await expectNoA11yViolations(makeAxe());
    });

    test('the eight-column table scrolls rather than clips at 320 px', async ({
        page,
        apiTokensPage
    }) => {
        await mockApiTokensApi(page);
        await page.setViewportSize({ width: 320, height: 800 });
        await apiTokensPage.goto();
        await apiTokensPage.table.waitFor();

        // WCAG 1.4.10: wide content must scroll in its own container, and the
        // page itself must not scroll sideways. If the widest table in the
        // admin clipped instead, the kebab column — and with it revocation —
        // would be unreachable at this width.
        const geometry = await page.evaluate(() => {
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

        expect(geometry.overflowX).toBe('auto');
        expect(geometry.wrapperScrolls).toBe(true);
        expect(geometry.pageScrollsSideways).toBe(false);
    });

    test('the pager is reachable at 320 px too', async ({
        page,
        apiTokensPage
    }) => {
        await mockApiTokensApi(page, { tokens: manyApiTokens(26) });
        await page.setViewportSize({ width: 320, height: 800 });
        await apiTokensPage.goto();
        await apiTokensPage.table.waitFor();

        await expect(apiTokensPage.nextButton()).toBeVisible();
        await apiTokensPage.nextButton().click();
        await expect(apiTokensPage.pageIndicator()).toHaveText('Page 2 of 2');
    });
});
