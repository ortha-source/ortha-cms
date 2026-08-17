import { expect, test } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import { mockWorkspaces } from '../support/api/workspaces';
import { mockInsightsApi } from '../support/api/insights';

/** The workspace the suite opens (from the workspaces mock's default seed). */
const WORKSPACE_ID = 'ws_marketing';

/**
 * What the Insights page **says** rather than what it shows.
 *
 * Every case here is invisible to the existing suites by construction: axe
 * cannot tell that a region *should* have been a live region, `heading-order`
 * is a best-practice rule the harness's WCAG tag set excludes, and the state
 * assertions all key on visible text that was already correct. The defects
 * were in the half of the page a screen reader gets, and the harness only ever
 * looked at the other half.
 */
test.describe('Insights announcements and outline', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockWorkspaces(page);
    });

    /**
     * The design system's `Skeleton` JSDoc tells consumers to wrap placeholders
     * in a `role="status"` region with an `sr-only` label. `WidgetCard` is the
     * one place that can satisfy it for nine widgets at once, and it was a bare
     * `div` — so the page put nine cards into loading and announced nothing.
     */
    test('a loading widget announces itself, named by its title', async ({
        page,
        insightsPage
    }) => {
        await mockInsightsApi(page, { delayMs: 2000 });
        await insightsPage.goto(WORKSPACE_ID);

        const skeleton = insightsPage.cardSkeleton('Gone quiet');
        await expect(skeleton).toBeVisible();
        await expect(skeleton).toHaveRole('status');
        // Named, because nine of these announce at once and "Loading…" nine
        // times says nothing about which card is which.
        await expect(skeleton).toContainText('Loading Gone quiet');
    });

    /**
     * The ladder's whole reason for existing is telling "we couldn't ask" apart
     * from "there is nothing". The error branch announced and the empty branch
     * did not — so the one a screen-reader user heard about was the one they
     * could do least about.
     */
    test('an empty widget announces politely, as the failed one does assertively', async ({
        page,
        insightsPage
    }) => {
        await mockInsightsApi(page, {
            empty: ['content/stale'],
            failing: ['media/alt']
        });
        await insightsPage.goto(WORKSPACE_ID);

        await expect(insightsPage.cardEmpty('Gone quiet')).toHaveRole('status');
        // The failing neighbour still announces assertively, so the pair really
        // is distinguishable rather than both having been made polite.
        await expect(
            insightsPage.cardError('Images missing alt text')
        ).toContainText("This didn't load");
    });

    /**
     * The em dash is `aria-hidden` on purpose — a screen reader reads it as
     * nothing, or as "dash" — but nothing replaced it, so a failed tile
     * announced its label and no value at all. That is indistinguishable from a
     * tile whose value is simply absent, which is the exact confusion the em
     * dash was chosen to prevent for sighted readers.
     */
    test('a failed stat tile says its value is unavailable', async ({
        page,
        insightsPage
    }) => {
        await mockInsightsApi(page, { failing: ['content/totals'] });
        await insightsPage.goto(WORKSPACE_ID);

        const tile = insightsPage.statTile('insights.content.entries');
        await expect(tile).toContainText('Unavailable');
    });

    /**
     * `h1` → `h2` → `h4`. axe's `heading-order` is tagged best-practice and the
     * harness includes only `wcag2a/wcag2aa/wcag21a/wcag21aa`, so every scan
     * passed over it. Asserted as "no widget title is an h4" rather than on one
     * card, so moving a single heading cannot make this go green.
     */
    test('the document outline has no skipped heading level', async ({
        page,
        insightsPage
    }) => {
        await mockInsightsApi(page);
        await insightsPage.goto(WORKSPACE_ID);
        await expect(insightsPage.card('When the work happens')).toBeVisible();
        await expect(insightsPage.anySkeleton()).toHaveCount(0);

        const main = page.getByRole('main');
        // One page title, bands under it, widget titles under those — and
        // nothing at level 4, which is where every widget title used to sit
        // with no h3 anywhere between.
        await expect(main.locator('h1')).toHaveCount(1);
        expect(await main.locator('h2').count()).toBeGreaterThan(0);
        expect(await main.locator('h3').count()).toBeGreaterThan(0);
        await expect(main.locator('h4')).toHaveCount(0);
    });

    /**
     * `2.5.3 Label in Name`. The visible label was `90d` and the `aria-label`
     * *replaced* it with "90 days", so a speech-input user saying "click 90d"
     * matched nothing. `label-content-name-mismatch` is best-practice too, so
     * this was invisible to axe as well — and the a11y suite located options by
     * the accessible name, baking the divergence into the test rather than
     * catching it.
     */
    test('a range option is addressable by the label printed on it', async ({
        page,
        insightsPage
    }) => {
        await mockInsightsApi(page);
        await insightsPage.goto(WORKSPACE_ID);

        for (const [visible, unit] of [
            ['7d', 'days'],
            ['30d', 'days'],
            ['90d', 'days'],
            ['12m', 'months']
        ] as const) {
            const option = insightsPage.rangeOption(visible);
            // The accessible name still spells the unit out…
            await expect(option).toHaveAccessibleName(`${visible} ${unit}`);
            // …and still contains what is printed on the control.
            await expect(option).toContainText(visible);
        }
        // Nothing is left addressing the option by a name it no longer has.
        await expect(
            insightsPage.rangePicker().getByRole('radio', { name: '90 days' })
        ).toHaveCount(0);
    });

    /**
     * `role="img"` makes everything under it presentational, so the punchcard's
     * column headings, row labels and 168 cell values were all erased and a
     * summary sentence stood in for the entire dataset. `AreaTrend` already
     * solved this; the grid now ships the same `<details>`+`<table>`.
     */
    test('the heat grid exposes its values as a real table', async ({
        page,
        insightsPage
    }) => {
        await mockInsightsApi(page);
        await insightsPage.goto(WORKSPACE_ID);

        const card = insightsPage.card('When the work happens');
        await expect(card).toBeVisible();

        await card.getByText('Table view').click();
        const table = card.getByRole('table');
        await expect(table).toBeVisible();
        // Rows and columns are headers, not plain cells — the whole point is
        // that a cell can be read back with what it is a cell *of*.
        await expect(
            table.getByRole('rowheader', { name: 'Mon' })
        ).toBeVisible();
        await expect(table.getByRole('columnheader').first()).toBeVisible();
    });
});
