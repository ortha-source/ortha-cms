import { expect, test } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import { mockWorkspaces } from '../support/api/workspaces';
import { mockInsightsApi } from '../support/api/insights';

/** The workspace the suite opens (from the workspaces mock's default seed). */
const WORKSPACE_ID = 'ws_marketing';

/**
 * The Insights page wired to the (mocked) Insights API.
 *
 * The page itself contributes no widgets — `content-admin` and `media-admin` do,
 * through `INSIGHTS_WIDGET_SLOT`. So these cases are as much about the **slot
 * system** as about any one chart: that contributed cards appear in the right
 * band, that each owns its own request, and that one failing card leaves the
 * others intact.
 */
test.describe('Insights', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockWorkspaces(page);
    });

    test('renders every contributed widget in its section', async ({
        page,
        insightsPage
    }) => {
        await mockInsightsApi(page);
        await insightsPage.goto(WORKSPACE_ID);

        await expect(insightsPage.heading()).toBeVisible();

        // The four bands the Insights plugin registers, each populated by a
        // package that owns the data behind its cards.
        await expect(insightsPage.section('Overview')).toBeVisible();
        await expect(insightsPage.section('Content')).toBeVisible();
        await expect(
            insightsPage.section('Localisation & media')
        ).toBeVisible();
        await expect(insightsPage.section('Team')).toBeVisible();

        await expect(insightsPage.card('Gone quiet')).toBeVisible();
        await expect(
            insightsPage.card('Draft and published, by type')
        ).toBeVisible();
        await expect(insightsPage.card('Publishing velocity')).toBeVisible();
        await expect(
            insightsPage.card("What's using the storage")
        ).toBeVisible();
        await expect(insightsPage.card('Uploads')).toBeVisible();
        await expect(
            insightsPage.card('Images missing alt text')
        ).toBeVisible();
        await expect(insightsPage.card('When the work happens')).toBeVisible();
    });

    test('each widget contributes its slot id to the grid', async ({
        page,
        insightsPage
    }) => {
        await mockInsightsApi(page);
        await insightsPage.goto(WORKSPACE_ID);

        // The ids are the slot contract — a widget is addressable by the id its
        // owning plugin registered, which is what a saved layout would key on.
        await expect(
            insightsPage.widget('insights.content.stale')
        ).toBeVisible();
        await expect(
            insightsPage.widget('insights.media.storageBreakdown')
        ).toBeVisible();
        await expect(
            insightsPage.widget('insights.content.punchcard')
        ).toBeVisible();
    });

    test('renders the headline figures from the API', async ({
        page,
        insightsPage
    }) => {
        await mockInsightsApi(page);
        await insightsPage.goto(WORKSPACE_ID);

        await expect(
            insightsPage.statTile('insights.content.entries')
        ).toContainText('1,284');
        await expect(
            insightsPage.statTile('insights.content.published')
        ).toContainText('1,046');

        // The Drafts tile carries a share of the total, not a change figure —
        // nothing records an entry moving back to draft, so a delta would be
        // invented. 238 / 1284 rounds to 19%.
        const drafts = insightsPage.statTile('insights.content.drafts');
        await expect(drafts).toContainText('238');
        await expect(drafts).toContainText('19%');
    });

    test('each widget calls its own endpoint', async ({
        page,
        insightsPage
    }) => {
        const spy = await mockInsightsApi(page);
        await insightsPage.goto(WORKSPACE_ID);
        await expect(insightsPage.card('Gone quiet')).toBeVisible();

        // One request per widget is the whole reason the endpoints are split;
        // the three content stat tiles share a query key, so `content/totals`
        // is fetched once for all three rather than three times.
        expect(spy.requested).toContain('content/totals');
        expect(spy.requested).toContain('content/stale');
        expect(spy.requested).toContain('content/pipeline');
        expect(spy.requested).toContain('content/velocity');
        expect(spy.requested).toContain('content/punchcard');
        expect(spy.requested).toContain('media/storage');
        expect(spy.requested).toContain('media/uploads');
        expect(spy.requested).toContain('media/alt');

        expect(
            spy.requested.filter((route) => route === 'content/totals')
        ).toHaveLength(1);
    });

    test('a failing widget does not take down the rest of the page', async ({
        page,
        insightsPage
    }) => {
        await mockInsightsApi(page, { failing: ['content/stale'] });
        await insightsPage.goto(WORKSPACE_ID);

        await expect(insightsPage.cardError('Gone quiet')).toBeVisible();

        // The failure has to read as a failure, never as "nothing to report" —
        // a dashboard that renders an unreachable count as an empty result is
        // stating the opposite of the truth.
        await expect(insightsPage.cardEmpty('Gone quiet')).toHaveCount(0);

        await expect(insightsPage.card('Publishing velocity')).toBeVisible();
        await expect(
            insightsPage.card("What's using the storage")
        ).toBeVisible();
    });

    test('a stat tile that cannot load shows no figure at all', async ({
        page,
        insightsPage
    }) => {
        await mockInsightsApi(page, { failing: ['content/totals'] });
        await insightsPage.goto(WORKSPACE_ID);

        // An em dash, not a zero: "we could not ask" and "there are none" are
        // opposite facts and must not look alike.
        const entries = insightsPage.statTile('insights.content.entries');
        await expect(entries).toContainText('—');
        await expect(entries).not.toContainText('0');
    });

    test('an empty workspace shows empty states, not errors', async ({
        page,
        insightsPage
    }) => {
        await mockInsightsApi(page, {
            empty: ['content/stale', 'content/pipeline']
        });
        await insightsPage.goto(WORKSPACE_ID);

        await expect(insightsPage.cardEmpty('Gone quiet')).toBeVisible();
        await expect(insightsPage.cardError('Gone quiet')).toHaveCount(0);
        await expect(
            insightsPage.cardEmpty('Draft and published, by type')
        ).toBeVisible();
    });

    test('shows a skeleton per widget while its request is open', async ({
        page,
        insightsPage
    }) => {
        await mockInsightsApi(page, { delayMs: 1500 });
        await insightsPage.goto(WORKSPACE_ID);

        await expect(insightsPage.cardSkeleton('Gone quiet')).toBeVisible();
        await expect(insightsPage.card('Gone quiet')).toContainText(
            'Published entries by time since last edit'
        );
    });

    test('changing the range refetches the range-dependent widgets', async ({
        page,
        insightsPage
    }) => {
        const spy = await mockInsightsApi(page);
        await insightsPage.goto(WORKSPACE_ID);
        await expect(insightsPage.card('Publishing velocity')).toBeVisible();

        expect(spy.days['content/velocity']).toBe('30');

        await insightsPage.selectRange('90 days');

        await expect.poll(() => spy.days['content/velocity']).toBe('90');
        await expect.poll(() => spy.days['media/uploads']).toBe('90');

        // `stale` is deliberately range-free — the buckets *are* the time axis,
        // so the answer must not change when the page's window does.
        expect(spy.days['content/stale']).toBeNull();
    });

    test('hides content widgets from a user without content:read', async ({
        page,
        insightsPage
    }) => {
        await mockSignedIn(page, { permissions: ['media:read'] });
        await mockInsightsApi(page);
        await insightsPage.goto(WORKSPACE_ID);

        await expect(
            insightsPage.card("What's using the storage")
        ).toBeVisible();
        await expect(insightsPage.card('Gone quiet')).toHaveCount(0);

        // A band whose every widget is gated out renders nothing at all — no
        // heading left sitting over an empty grid.
        await expect(insightsPage.section('Content')).toHaveCount(0);
        await expect(insightsPage.section('Team')).toHaveCount(0);
        await expect(
            insightsPage.section('Localisation & media')
        ).toBeVisible();
    });

    test('shows the empty page when no widget is visible', async ({
        page,
        insightsPage
    }) => {
        await mockSignedIn(page, { permissions: [] });
        await mockInsightsApi(page);
        await insightsPage.goto(WORKSPACE_ID);

        await expect(insightsPage.emptyPage()).toBeVisible();
    });

    test('offers a table view for the chart whose values are hover-only', async ({
        page,
        insightsPage
    }) => {
        await mockInsightsApi(page);
        await insightsPage.goto(WORKSPACE_ID);

        const velocity = insightsPage.card('Publishing velocity');
        await expect(velocity).toBeVisible();

        // The area chart's per-point values live in a hover crosshair, which is
        // unreachable by keyboard — so the same numbers exist as a table.
        await velocity.getByText('Table view').click();
        await expect(velocity.getByRole('cell', { name: '52' })).toBeVisible();
    });
});
