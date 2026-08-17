import { expect, test } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import { mockWorkspaces } from '../support/api/workspaces';
import { mockInsightsApi } from '../support/api/insights';
import { expectNoA11yViolations } from '../support/a11y';

/** The workspace the suite opens (from the workspaces mock's default seed). */
const WORKSPACE_ID = 'ws_marketing';

/**
 * Accessibility of the Insights page.
 *
 * Scanned in **each** of its states, not just the loaded one: a dashboard's
 * colour-heavy widgets are exactly where contrast regressions hide, and the
 * loading and failed states render markup the happy path never shows.
 */
test.describe('Insights accessibility', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockWorkspaces(page);
    });

    test('has no axe violations once every widget has loaded', async ({
        page,
        insightsPage,
        makeAxe
    }) => {
        await mockInsightsApi(page);
        await insightsPage.goto(WORKSPACE_ID);
        await expect(insightsPage.card('When the work happens')).toBeVisible();
        await expect(insightsPage.anySkeleton()).toHaveCount(0);

        await expectNoA11yViolations(makeAxe());
    });

    test('has no axe violations while widgets are loading', async ({
        page,
        insightsPage,
        makeAxe
    }) => {
        await mockInsightsApi(page, { delayMs: 2000 });
        await insightsPage.goto(WORKSPACE_ID);
        await expect(insightsPage.cardSkeleton('Gone quiet')).toBeVisible();

        await expectNoA11yViolations(makeAxe());
    });

    test('has no axe violations with a failed widget on the page', async ({
        page,
        insightsPage,
        makeAxe
    }) => {
        await mockInsightsApi(page, {
            failing: ['content/stale', 'media/alt']
        });
        await insightsPage.goto(WORKSPACE_ID);

        // Wait for BOTH failures and a loaded neighbour, so the scan sees the
        // settled mixed state rather than a half-loaded one. Scanning on the
        // first error to appear caught a moment when every other card was still
        // a skeleton — which trips `scrollable-region-focusable` on the shell's
        // own scroll container, a pre-existing condition of any loading page in
        // this app and nothing to do with these widgets. The loading state has
        // its own case above.
        await expect(insightsPage.cardError('Gone quiet')).toBeVisible();
        await expect(
            insightsPage.cardError('Images missing alt text')
        ).toBeVisible();
        await expect(insightsPage.card('When the work happens')).toBeVisible();
        await expect(insightsPage.anySkeleton()).toHaveCount(0);

        await expectNoA11yViolations(makeAxe());
    });

    test('the range picker is reachable and operable by keyboard', async ({
        page,
        insightsPage
    }) => {
        await mockInsightsApi(page);
        await insightsPage.goto(WORKSPACE_ID);
        await expect(insightsPage.card('Gone quiet')).toBeVisible();

        // The control is arrow-navigated, not tabbed through. Radix's toggle
        // group moves *focus* on an arrow key and commits on Enter/Space —
        // it does not follow focus with selection — so both steps are asserted
        // rather than assuming the arrow alone changes the range.
        await insightsPage.rangeOption('30d').focus();
        await page.keyboard.press('ArrowRight');
        await expect(insightsPage.rangeOption('90d')).toBeFocused();
        await expect(insightsPage.rangeOption('90d')).toHaveAttribute(
            'aria-checked',
            'false'
        );

        await page.keyboard.press('Enter');
        await expect(insightsPage.rangeOption('90d')).toHaveAttribute(
            'aria-checked',
            'true'
        );
        await expect(insightsPage.rangeOption('30d')).toHaveAttribute(
            'aria-checked',
            'false'
        );
    });

    test('every chart carries a text alternative', async ({
        page,
        insightsPage
    }) => {
        await mockInsightsApi(page);
        await insightsPage.goto(WORKSPACE_ID);
        await expect(insightsPage.card('When the work happens')).toBeVisible();

        // Charts are `role="img"` with a label that states the series, so a
        // screen-reader user gets the shape of the data rather than silence.
        await expect(
            insightsPage
                .card('When the work happens')
                .getByRole('img', { name: /Editing activity by weekday/ })
        ).toBeVisible();
        await expect(
            insightsPage
                .card('Publishing velocity')
                .getByRole('img', { name: /Entries published over time/ })
        ).toBeVisible();
        await expect(
            insightsPage
                .card('Images missing alt text')
                .getByRole('img', { name: /% of images have alt text/ })
        ).toBeVisible();
    });
});
