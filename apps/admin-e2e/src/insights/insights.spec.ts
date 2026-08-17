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
        await expect(insightsPage.card('Waiting to go live')).toBeVisible();
        // Contributed by `i18n-admin` — the third package on the page, and the
        // only one whose card is not about a table it owns: coverage is a
        // question about the *configured* locale set.
        await expect(insightsPage.card('Translation coverage')).toBeVisible();
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
        await expect(
            insightsPage.widget('insights.content.unshipped')
        ).toBeVisible();
        await expect(
            insightsPage.widget('insights.i18n.coverage')
        ).toBeVisible();
    });

    test('renders each section band under its registered id', async ({
        page,
        insightsPage
    }) => {
        await mockInsightsApi(page);
        await insightsPage.goto(WORKSPACE_ID);
        await expect(insightsPage.card('Gone quiet')).toBeVisible();

        // Sections are slot contributions too — the Insights plugin registers
        // these four through the same slot any package would use, so a band is
        // addressable by the id its contribution carried.
        await expect(insightsPage.sectionBand('overview')).toBeVisible();
        await expect(insightsPage.sectionBand('content')).toBeVisible();
        await expect(insightsPage.sectionBand('reach')).toBeVisible();
        await expect(insightsPage.sectionBand('team')).toBeVisible();

        // Every widget names a registered section, so nothing should have
        // fallen through to the catch-all band.
        await expect(insightsPage.fallbackBand()).toHaveCount(0);
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

    test('counts live records carrying unpublished edits', async ({
        page,
        insightsPage
    }) => {
        await mockInsightsApi(page);
        await insightsPage.goto(WORKSPACE_ID);

        const card = insightsPage.card('Waiting to go live');
        await expect(card).toContainText('94');
        // The denominator is live records, not every record: "94 of 1,046 live
        // records" is a backlog someone can clear.
        await expect(card).toContainText('of 1,046 live records');
        // 94 / 1046 rounds to 9%.
        await expect(card).toContainText('9% of live');

        // Never-published drafts are a footnote, not part of the headline —
        // finishing a draft and pressing publish are different jobs.
        await expect(card).toContainText('144 never-published drafts');

        // Only types with something pending are rows; `author` and `case_study`
        // have none, so they are absent rather than permanently empty bars.
        await expect(card).toContainText('Article');
        await expect(card).not.toContainText('Case study');
    });

    test('separates translated, untranslated and part-way records', async ({
        page,
        insightsPage
    }) => {
        await mockInsightsApi(page);
        await insightsPage.goto(WORKSPACE_ID);

        const card = insightsPage.card('Translation coverage');

        // The three figures overlap on purpose — "not localized" is a subset of
        // "needs translation", not a second slice — so the seed's 18 + 44 does
        // not add up to 140 and the hints are what keep them readable.
        await expect(card).toContainText('in every language');
        await expect(card).toContainText('no translations started');
        await expect(card).toContainText('missing at least one');
        await expect(card).toContainText('122 to translate');

        // Every configured locale gets a row, including the one nobody has
        // taken far — an untouched language must be visible, not absent.
        await expect(card).toContainText('English (default)');
        await expect(card).toContainText('Deutsch');
        await expect(card).toContainText('Français');

        // Counts are records, not rows: 140 records, of which 21 exist in
        // French — 15%.
        await expect(card).toContainText('15%');
        await expect(card).toContainText('Across 140 localized records');
    });

    test('breaks translation coverage down by content type', async ({
        page,
        insightsPage
    }) => {
        const spy = await mockInsightsApi(page);
        await insightsPage.goto(WORKSPACE_ID);

        const card = insightsPage.card('Translation coverage');
        await expect(card).toContainText('Deutsch');

        await insightsPage
            .cardBreakdown('Translation coverage', 'By type')
            .click();

        // The bars now answer "which content type is the work in?" — the same
        // question the locale view cannot answer at all.
        await expect(card).toContainText('Article');
        await expect(card).toContainText('Changelog');
        await expect(card).toContainText('Landing page');
        await expect(card).not.toContainText('Deutsch');

        // The legend and the subtitle both move with the axis: the same blue
        // now means "fully localized records", not "records translated into a
        // language", and the old subtitle would describe a chart that is no
        // longer on screen.
        await expect(card).toContainText('Fully localized');
        await expect(card).toContainText(
            'Where the outstanding translation work sits'
        );

        // The headline figures are workspace-wide, so they stay put.
        await expect(card).toContainText('122 to translate');

        // A view swap over one payload, not a second request — which is the
        // reason this is one card with a toggle rather than two cards.
        expect(
            spy.requested.filter((route) => route === 'i18n/coverage')
        ).toHaveLength(1);
    });

    test('a workspace that has never published shows no pending backlog', async ({
        page,
        insightsPage
    }) => {
        await mockInsightsApi(page, { empty: ['content/unshipped'] });
        await insightsPage.goto(WORKSPACE_ID);

        // Nothing has gone live, so "0 pending edits" would be a claim about a
        // publishing habit the workspace does not have yet.
        await expect(
            insightsPage.cardEmpty('Waiting to go live')
        ).toBeVisible();
        await expect(insightsPage.cardError('Waiting to go live')).toHaveCount(
            0
        );
    });

    test('coverage shares never round a near-miss to 0% or 100%', async ({
        page,
        insightsPage
    }) => {
        // 608 of 609 translated is 99.8%, and 3 of 609 is 0.49% — plain
        // rounding prints "100%" over a record that has no English row and
        // "0%" beside a bar you can see. Both are the reading the figure
        // exists to prevent, so the boundaries are reserved for the real thing.
        await mockInsightsApi(page, {
            overrides: {
                'i18n/coverage': {
                    locales: [
                        {
                            locale: 'en',
                            name: 'English',
                            isDefault: true,
                            translated: 608,
                            missing: 1
                        },
                        {
                            locale: 'de',
                            name: 'Deutsch',
                            isDefault: false,
                            translated: 3,
                            missing: 606
                        },
                        {
                            locale: 'fr',
                            name: 'Français',
                            isDefault: false,
                            translated: 0,
                            missing: 609
                        }
                    ],
                    records: 609,
                    localized: 0,
                    notLocalized: 607,
                    requiresLocalization: 609,
                    types: [
                        {
                            name: 'article',
                            label: 'Article',
                            records: 609,
                            localized: 0,
                            notLocalized: 607,
                            requiresLocalization: 609
                        }
                    ]
                }
            }
        });
        await insightsPage.goto(WORKSPACE_ID);

        const card = insightsPage.card('Translation coverage');
        await expect(card).toContainText('609 to translate');
        await expect(card).toContainText('99%');
        await expect(card).toContainText('1%');
        // A genuine zero still reads 0% — French has nothing at all.
        await expect(card).toContainText('0%');
        await expect(card).not.toContainText('100%');
    });

    test('coverage states both series of every bar, not just the drawn one', async ({
        page,
        insightsPage
    }) => {
        await mockInsightsApi(page);
        await insightsPage.goto(WORKSPACE_ID);

        // The readout column prints the translated count and the share; the
        // outstanding half used to exist only as a hue and a native `title`,
        // so a screen-reader user heard "Deutsch 62 44%" and never the 78
        // records still to do.
        await expect(
            insightsPage.cardBar(
                'Translation coverage',
                /62 records translated.*78 records missing/
            )
        ).toBeVisible();
    });

    test('an untouched workspace is not congratulated for it', async ({
        page,
        insightsPage
    }) => {
        await mockInsightsApi(page, { empty: ['i18n/coverage'] });
        await insightsPage.goto(WORKSPACE_ID);

        const card = insightsPage.card('Translation coverage');
        // `requiresLocalization === 0` is true both when everything is
        // translated and when there is nothing to translate; only the first
        // earns a green all-clear.
        await expect(
            insightsPage.cardChip('Translation coverage', 'Fully translated')
        ).toHaveCount(0);
        // …and the copy does not name a period this widget doesn't have.
        await expect(
            insightsPage.cardEmpty('Translation coverage')
        ).toHaveCount(0);
        await expect(card).toContainText(
            'No localized content in this workspace yet.'
        );
    });

    test('a failing coverage read does not empty the localisation band', async ({
        page,
        insightsPage
    }) => {
        await mockInsightsApi(page, { failing: ['i18n/coverage'] });
        await insightsPage.goto(WORKSPACE_ID);

        await expect(
            insightsPage.cardError('Translation coverage')
        ).toBeVisible();
        await expect(
            insightsPage.cardEmpty('Translation coverage')
        ).toHaveCount(0);
        // The band's other three cards come from a different package and a
        // different endpoint, so they are untouched.
        await expect(
            insightsPage.card("What's using the storage")
        ).toBeVisible();
        await expect(
            insightsPage.card('Images missing alt text')
        ).toBeVisible();
    });

    test('neither new widget takes a time range', async ({
        page,
        insightsPage
    }) => {
        const spy = await mockInsightsApi(page);
        await insightsPage.goto(WORKSPACE_ID);
        await expect(insightsPage.card('Translation coverage')).toBeVisible();

        // A pending edit is pending whether it was made this morning or last
        // spring, and an untranslated record is untranslated regardless of when
        // it was written — a window could only hide part of either backlog.
        expect(spy.days['content/unshipped']).toBeNull();
        expect(spy.days['i18n/coverage']).toBeNull();
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
        expect(spy.requested).toContain('content/unshipped');
        expect(spy.requested).toContain('i18n/coverage');

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

        await insightsPage.selectRange('90d');

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
        // Coverage counts content, so it carries `content:read` even though it
        // is contributed by the i18n plugin and sits in the media band — a
        // reader who may not see entries must not learn how many there are by
        // counting the gaps.
        await expect(insightsPage.card('Translation coverage')).toHaveCount(0);

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
