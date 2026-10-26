import { expect, test } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import { mockWorkspaces } from '../support/api/workspaces';
import { mockInsightsApi } from '../support/api/insights';

/** The workspace the suite opens (from the workspaces mock's default seed). */
const WORKSPACE_ID = 'ws_marketing';

/**
 * The Insights page wired to the (mocked) Insights API.
 *
 * The page itself contributes no widgets and no Needs-attention lines —
 * `content-admin`, `media-admin`, `i18n-admin` and `protection-admin` do,
 * through the insights slots. So these cases are as much about the **slot
 * system** as about any one chart: that contributed cards appear on the right
 * tab, that each owns its own request, and that one failing card leaves the
 * others intact.
 */
test.describe('Insights', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockWorkspaces(page);
    });

    test('renders every contributed widget on its section’s tab', async ({
        page,
        insightsPage
    }) => {
        await mockInsightsApi(page);
        await insightsPage.goto(WORKSPACE_ID);

        await expect(insightsPage.heading()).toBeVisible();
        await expect(
            page.getByText(
                'What changed in Marketing site over the last 30 days, and what needs you.'
            )
        ).toBeVisible();

        // The four bands the Insights plugin registers, as tabs.
        await expect(insightsPage.tab('Overview')).toHaveAttribute(
            'aria-selected',
            'true'
        );
        await expect(insightsPage.tab('Content')).toBeVisible();
        await expect(insightsPage.tab('Localisation & media')).toBeVisible();
        await expect(insightsPage.tab('Team')).toBeVisible();

        // Overview: the work first, then the charts.
        await expect(insightsPage.attention()).toBeVisible();
        await expect(insightsPage.card('Publishing velocity')).toBeVisible();
        await expect(insightsPage.card('By type')).toBeVisible();

        await insightsPage.openTab('Content');
        await expect(insightsPage.card('Gone quiet')).toBeVisible();
        await expect(insightsPage.card('Waiting to go live')).toBeVisible();

        await insightsPage.openTab('Localisation & media');
        // Contributed by `i18n-admin` — the only card not about a table its
        // package owns: coverage is a question about the *configured* locales.
        await expect(insightsPage.card('Translation coverage')).toBeVisible();
        await expect(insightsPage.card('Storage')).toBeVisible();
        await expect(insightsPage.card('Uploads')).toBeVisible();

        await insightsPage.openTab('Team');
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
            insightsPage.widget('insights.content.entries')
        ).toBeVisible();
        await expect(
            insightsPage.widget('insights.content.velocity')
        ).toBeVisible();
        await expect(insightsPage.signalLine('content.stale')).toBeVisible();

        await insightsPage.openTab('Content');
        await expect(
            insightsPage.widget('insights.content.stale')
        ).toBeVisible();
        await expect(
            insightsPage.widget('insights.content.unshipped')
        ).toBeVisible();

        await insightsPage.openTab('Localisation & media');
        await expect(
            insightsPage.widget('insights.media.storageBreakdown')
        ).toBeVisible();
        await expect(
            insightsPage.widget('insights.i18n.coverage')
        ).toBeVisible();

        await insightsPage.openTab('Team');
        await expect(
            insightsPage.widget('insights.content.punchcard')
        ).toBeVisible();
    });

    test('renders each section under its registered id', async ({
        page,
        insightsPage
    }) => {
        await mockInsightsApi(page);
        await insightsPage.goto(WORKSPACE_ID);

        // Sections are slot contributions too — a tab is addressable by the
        // id its contribution carried, and its panel by the same id.
        for (const id of ['overview', 'content', 'reach', 'team']) {
            await expect(page.locator(`[data-tab-id="${id}"]`)).toBeVisible();
        }
        await expect(insightsPage.sectionBand('overview')).toBeVisible();
        await insightsPage.openTab('Team');
        await expect(insightsPage.sectionBand('team')).toBeVisible();

        // Every widget names a registered section, so nothing should have
        // fallen through to the catch-all band.
        await expect(insightsPage.fallbackBand()).toHaveCount(0);
    });

    test('renders the headline figures, each compared to something', async ({
        page,
        insightsPage
    }) => {
        await mockInsightsApi(page);
        await insightsPage.goto(WORKSPACE_ID);

        const entries = insightsPage.statTile('insights.content.entries');
        await expect(entries).toContainText('1,284');
        // The delta names the period it is measured over.
        await expect(entries).toContainText('+48 this month');
        const published = insightsPage.statTile('insights.content.published');
        await expect(published).toContainText('1,046');
        await expect(published).toContainText('+31 this month');

        // The Drafts tile carries a share of the total, not a change figure —
        // nothing records an entry moving back to draft, so a delta would be
        // invented. 238 / 1284 rounds to 19%.
        const drafts = insightsPage.statTile('insights.content.drafts');
        await expect(drafts).toContainText('238');
        await expect(drafts).toContainText('19% of all entries');

        // The period follows the range.
        await insightsPage.selectRange('7d');
        await expect(entries).toContainText('this week');
        await expect(
            page.getByText(/over the last 7 days, and what needs you\./)
        ).toBeVisible();
    });

    test('leads with the lines that need someone, each with its comparison', async ({
        page,
        insightsPage
    }) => {
        await mockInsightsApi(page);
        await insightsPage.goto(WORKSPACE_ID);

        const card = insightsPage.attention();
        await expect(
            card.getByRole('heading', { name: 'Needs attention', level: 3 })
        ).toBeVisible();
        await expect(card).toContainText('click a line to see the records');

        // In the order the plugins registered them: 10, 20, 30, 40.
        const lines = card.getByRole('listitem');
        await expect(lines).toHaveCount(4);
        await expect(lines.nth(0)).toContainText('94');
        await expect(lines.nth(0)).toContainText(
            'Published records with edits nobody has published · 9% of live'
        );
        await expect(lines.nth(1)).toContainText('4');
        await expect(lines.nth(1)).toContainText(
            '1 overdue — Pricing FAQ, 5 days'
        );
        await expect(lines.nth(2)).toContainText('156');
        await expect(lines.nth(2)).toContainText(
            'Not touched in over a year · most in Article'
        );
        await expect(lines.nth(3)).toContainText('794');
        await expect(lines.nth(3)).toContainText(
            'In Media Library · 32% of 2,481 images'
        );
    });

    test('a line opens the records behind its count', async ({
        page,
        insightsPage
    }) => {
        const spy = await mockInsightsApi(page);
        await insightsPage.goto(WORKSPACE_ID);

        // Nothing is asked for until somebody opens the panel.
        await expect(insightsPage.signal('Gone quiet')).toBeVisible();
        expect(spy.requested).not.toContain('content/stale/records');

        await insightsPage.signal('Gone quiet').click();
        const drill = insightsPage.drill();
        await expect(drill).toHaveAccessibleName('Gone quiet · 156 records');
        await expect(
            insightsPage.signalBehindPanel('Gone quiet')
        ).toHaveAttribute('aria-expanded', 'true');
        expect(spy.params['content/stale/records']?.['age']).toBe('year');

        // Oldest first, each with its type, age and last editor.
        const first = drill.getByRole('link', {
            name: /A guide to content modelling/
        });
        await expect(first).toContainText('Article · last edited Aug 2024');
        await expect(first).toContainText('Last edited by Ada Lovelace');
        await expect(first).toHaveAttribute(
            'href',
            `/workspaces/${WORKSPACE_ID}/content/article/e0000001-0000-4000-8000-000000000001`
        );
        // An untitled record is named by its id.
        await expect(
            drill.getByRole('link', { name: /Untitled \(e0000002\)/ })
        ).toBeVisible();

        // Records tables are per type, so a set in two types links both,
        // each with the band's filter applied.
        const articles = drill.getByRole('link', {
            name: 'Open 101 in Article'
        });
        await expect(articles).toBeVisible();
        const href = (await articles.getAttribute('href')) ?? '';
        expect(href).toContain(`/workspaces/${WORKSPACE_ID}/content/article?`);
        const filter = JSON.parse(
            new URL(href, 'http://x').searchParams.get('filter') ?? '{}'
        );
        expect(filter.and[0]).toEqual({
            field: 'status',
            op: 'eq',
            value: 'published'
        });
        await expect(
            drill.getByRole('link', { name: 'Open 55 in Changelog' })
        ).toBeVisible();

        // The bands ask again.
        await drill.getByRole('radio', { name: '3–12 months' }).click();
        await expect
            .poll(() => spy.params['content/stale/records']?.['age'])
            .toBe('months');
    });

    test('the open panel is in the URL, and survives a reload', async ({
        page,
        insightsPage
    }) => {
        await mockInsightsApi(page);
        await insightsPage.goto(WORKSPACE_ID);

        await insightsPage.signal('Waiting to go live').click();
        await expect(insightsPage.drill()).toHaveAccessibleName(
            'Waiting to go live · 94 records'
        );
        await expect
            .poll(() => new URL(page.url()).searchParams.get('signal'))
            .toBe('content.unshipped');

        // One type: one "Open all", on the Modified chip's own conditions.
        const all = insightsPage
            .drill()
            .getByRole('link', { name: 'Open all 94 in Records' });
        const href = (await all.getAttribute('href')) ?? '';
        expect(decodeURIComponent(href)).toContain('"field":"publishedAt"');

        // A shared link opens on the same panel.
        await page.reload();
        await expect(insightsPage.drill()).toHaveAccessibleName(
            'Waiting to go live · 94 records'
        );

        await insightsPage
            .drill()
            .getByRole('button', { name: 'Close' })
            .click();
        await expect(insightsPage.drill()).toHaveCount(0);
        await expect
            .poll(() => new URL(page.url()).searchParams.get('signal'))
            .toBeNull();
    });

    test('Waiting on review opens the queue, oldest ask first', async ({
        page,
        insightsPage
    }) => {
        await mockInsightsApi(page);
        const day = 86_400_000;
        const ask = (id: string, title: string, by: string, age: number) => ({
            id,
            contentType: 'blog_post',
            contentTypeLabel: 'Blog posts',
            entryId: `entry-${id}`,
            entryTitle: title,
            requestedBy: by,
            reviewerIds: [],
            required: 1,
            given: 0,
            createdAt: new Date(Date.now() - age).toISOString()
        });
        await page.route('**/api/protection/queue*', (route) =>
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    // Newest first, as the server sends the queue.
                    items: [
                        ask('r2', 'Spring launch', 'u_grace', day),
                        ask('r1', 'Pricing FAQ', 'u_ada', 5 * day + 60_000)
                    ],
                    total: 2,
                    overdueAfterDays: 3
                })
            })
        );
        await insightsPage.goto(WORKSPACE_ID);

        await insightsPage.signal('Waiting on review').click();
        const drill = insightsPage.drill();
        await expect(drill).toHaveAccessibleName(
            'Waiting on review · 2 records'
        );
        const rows = drill.getByRole('listitem');
        await expect(rows.nth(0)).toContainText('Pricing FAQ');
        await expect(rows.nth(0)).toContainText(
            'Blog posts · waiting 5 days · overdue'
        );
        await expect(rows.nth(0)).toContainText('Requested by Ada Lovelace');
        await expect(rows.nth(1)).toContainText('Spring launch');
        await expect(
            drill.getByRole('link', { name: 'Open all 2 in Reviews' })
        ).toHaveAttribute('href', `/workspaces/${WORKSPACE_ID}/reviews`);
    });

    test('a line that cannot load says so instead of showing a count', async ({
        page,
        insightsPage
    }) => {
        await mockInsightsApi(page, { failing: ['content/unshipped'] });
        await insightsPage.goto(WORKSPACE_ID);

        const line = insightsPage.signalLine('content.unshipped');
        await expect(line.getByRole('alert')).toContainText("Couldn't load");
        // No button, so nothing to open over a figure nobody has.
        await expect(line.getByRole('button')).toHaveCount(0);
        // Its neighbours are unaffected.
        await expect(insightsPage.signal('Gone quiet')).toContainText('156');
    });

    test('a drill-down that cannot load is told apart from an empty one', async ({
        page,
        insightsPage
    }) => {
        await mockInsightsApi(page, {
            failing: ['media/alt/missing'],
            empty: ['content/stale/records']
        });
        await insightsPage.goto(WORKSPACE_ID);

        await insightsPage.signal('Images missing alt text').click();
        await expect(insightsPage.drill().getByRole('alert')).toContainText(
            "didn't load"
        );
        await insightsPage
            .drill()
            .getByRole('button', { name: 'Close' })
            .click();

        await insightsPage.signal('Gone quiet').click();
        await expect(insightsPage.drill()).toContainText(
            'Nothing published has gone this quiet.'
        );
        await expect(insightsPage.drill().getByRole('alert')).toHaveCount(0);
    });

    test('the selected tab is in the URL and keeps the range', async ({
        page,
        insightsPage
    }) => {
        await mockInsightsApi(page);
        await page.goto(`/workspaces/${WORKSPACE_ID}/insights?range=90d`);

        await insightsPage.openTab('Team');
        await expect
            .poll(() => new URL(page.url()).searchParams.get('tab'))
            .toBe('team');
        expect(new URL(page.url()).searchParams.get('range')).toBe('90d');

        await page.reload();
        await expect(insightsPage.tab('Team')).toHaveAttribute(
            'aria-selected',
            'true'
        );

        // Back to the first tab drops the param rather than writing it.
        await insightsPage.openTab('Overview');
        await expect
            .poll(() => new URL(page.url()).searchParams.get('tab'))
            .toBeNull();

        // A tab nobody offers opens the first one.
        await page.goto(`/workspaces/${WORKSPACE_ID}/insights?tab=nonsense`);
        await expect(insightsPage.tab('Overview')).toHaveAttribute(
            'aria-selected',
            'true'
        );
    });

    test('counts live records carrying unpublished edits', async ({
        page,
        insightsPage
    }) => {
        await mockInsightsApi(page);
        await insightsPage.goto(WORKSPACE_ID);
        await insightsPage.openTab('Content');

        const card = insightsPage.card('Waiting to go live');
        await expect(card).toContainText('94');
        // The denominator is live records, not every record.
        await expect(card).toContainText('of 1,046 live records');
        // 94 / 1046 rounds to 9%.
        await expect(card).toContainText('9% of live');

        // Never-published drafts are a footnote, not part of the headline.
        await expect(card).toContainText('144 never-published drafts');

        // Only types with something pending are rows.
        await expect(card).toContainText('Article');
        await expect(card).not.toContainText('Case study');
    });

    test('splits each type by publish state', async ({
        page,
        insightsPage
    }) => {
        await mockInsightsApi(page);
        await insightsPage.goto(WORKSPACE_ID);

        const card = insightsPage.card('By type');
        // The legend names all three states, the remainder included.
        await expect(card).toContainText('published');
        await expect(card).toContainText('modified');
        await expect(card).toContainText('draft');
        // Article: 412 published, 51 of its 88 drafts modified, 37 never
        // shipped — every segment named, so no state reaches a reader by hue
        // alone.
        await expect(
            insightsPage.cardBar(
                'By type',
                /Article — 412 published.*Article — 51 modified.*Article — 37 draft/
            )
        ).toBeVisible();
        await expect(card).toContainText('500');
    });

    test('shows publishing velocity as columns over the whole window', async ({
        page,
        insightsPage
    }) => {
        await mockInsightsApi(page);
        await insightsPage.goto(WORKSPACE_ID);

        const card = insightsPage.card('Publishing velocity');
        await expect(card).toContainText(/\d+ publishes · busiest Thursday/);
        // Daily buckets for 30 days: the quiet days the server left out are
        // columns of zero, not gaps the chart closes. The values are text too.
        await card.getByText('Table view').click();
        const rows = card.getByRole('table').getByRole('row');
        expect(await rows.count()).toBeGreaterThanOrEqual(31);
        await expect(card.getByRole('cell', { name: '52' })).toBeVisible();
        await expect(
            card.getByRole('cell', { name: '0', exact: true }).first()
        ).toBeVisible();
    });

    test('reads translation coverage as a share and what is missing', async ({
        page,
        insightsPage
    }) => {
        await mockInsightsApi(page);
        await insightsPage.goto(WORKSPACE_ID);
        await insightsPage.openTab('Localisation & media');

        const card = insightsPage.card('Translation coverage');
        // Counts are records, not rows.
        await expect(card).toContainText('of 140 localized records');
        // Every configured locale gets a row, including the one nobody has
        // taken far — an untouched language must be visible, not absent.
        await expect(card).toContainText('English (default)');
        await expect(card).toContainText('100% · 0 missing');
        await expect(card).toContainText('Deutsch');
        await expect(card).toContainText('44% · 78 missing');
        await expect(card).toContainText('Français');
        await expect(card).toContainText('15% · 119 missing');
    });

    test('breaks translation coverage down by content type', async ({
        page,
        insightsPage
    }) => {
        const spy = await mockInsightsApi(page);
        await insightsPage.goto(WORKSPACE_ID);
        await insightsPage.openTab('Localisation & media');

        const card = insightsPage.card('Translation coverage');
        await expect(card).toContainText('Deutsch');

        await insightsPage
            .cardBreakdown('Translation coverage', 'By type')
            .click();

        // The bars now answer "which content type is the work in?".
        await expect(card).toContainText('Article');
        await expect(card).toContainText('Changelog');
        await expect(card).toContainText('Landing page');
        await expect(card).not.toContainText('Deutsch');
        // 12 of 88 articles in every language — 14% — and 76 still to do.
        await expect(card).toContainText('14% · 76 to translate');

        // A view swap over one payload, not a second request.
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

        await expect(insightsPage.signal('Waiting to go live')).toContainText(
            'Nothing has gone live yet'
        );
        await insightsPage.openTab('Content');
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
        // "0%" beside a bar you can see.
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
        await insightsPage.openTab('Localisation & media');

        const card = insightsPage.card('Translation coverage');
        await expect(card).toContainText('99% · 1 missing');
        await expect(card).toContainText('1% · 606 missing');
        // A genuine zero still reads 0% — French has nothing at all.
        await expect(card).toContainText('0% · 609 missing');
        await expect(card).not.toContainText('100%');
    });

    test('coverage states both halves of every bar, not just the drawn one', async ({
        page,
        insightsPage
    }) => {
        await mockInsightsApi(page);
        await insightsPage.goto(WORKSPACE_ID);
        await insightsPage.openTab('Localisation & media');

        // The bar draws only the translated part over an empty track; its
        // text alternative names the missing records too.
        await expect(
            insightsPage.cardBar(
                'Translation coverage',
                /62 records translated, 78 records missing/
            )
        ).toBeVisible();
    });

    test('an untouched workspace is not congratulated for it', async ({
        page,
        insightsPage
    }) => {
        await mockInsightsApi(page, { empty: ['i18n/coverage'] });
        await insightsPage.goto(WORKSPACE_ID);
        await insightsPage.openTab('Localisation & media');

        const card = insightsPage.card('Translation coverage');
        // The copy does not name a period this widget doesn't have.
        await expect(
            insightsPage.cardEmpty('Translation coverage')
        ).toHaveCount(0);
        await expect(card).toContainText(
            'No localized content in this workspace yet.'
        );
        await expect(card).not.toContainText('100%');
    });

    test('a failing coverage read does not empty the localisation tab', async ({
        page,
        insightsPage
    }) => {
        await mockInsightsApi(page, { failing: ['i18n/coverage'] });
        await insightsPage.goto(WORKSPACE_ID);
        await insightsPage.openTab('Localisation & media');

        await expect(
            insightsPage.cardError('Translation coverage')
        ).toBeVisible();
        await expect(
            insightsPage.cardEmpty('Translation coverage')
        ).toHaveCount(0);
        // The tab's other cards come from a different package and a different
        // endpoint, so they are untouched.
        await expect(insightsPage.card('Storage')).toBeVisible();
        await expect(insightsPage.card('Uploads')).toBeVisible();
    });

    test('neither backlog takes a time range', async ({
        page,
        insightsPage
    }) => {
        const spy = await mockInsightsApi(page);
        await insightsPage.goto(WORKSPACE_ID);
        await insightsPage.openTab('Localisation & media');
        await expect(insightsPage.card('Translation coverage')).toBeVisible();

        // A pending edit is pending whether it was made this morning or last
        // spring, and an untranslated record is untranslated regardless of when
        // it was written — a window could only hide part of either backlog.
        expect(spy.days['content/unshipped']).toBeNull();
        expect(spy.days['i18n/coverage']).toBeNull();
    });

    test('each widget calls its own endpoint, on the tab that shows it [insights:I-15]', async ({
        page,
        insightsPage
    }) => {
        const spy = await mockInsightsApi(page);
        await insightsPage.goto(WORKSPACE_ID);
        await expect(insightsPage.card('Publishing velocity')).toBeVisible();
        await expect(insightsPage.anySkeleton()).toHaveCount(0);

        // The Overview tab: its tiles, its charts and its lines.
        for (const route of [
            'content/totals',
            'content/velocity',
            'content/pipeline',
            'content/unshipped',
            'content/stale',
            'media/storage',
            'media/alt',
            'protection/reviews'
        ]) {
            expect(spy.requested).toContain(route);
        }
        // A tab nobody opened costs nothing.
        expect(spy.requested).not.toContain('content/punchcard');
        expect(spy.requested).not.toContain('i18n/coverage');

        await insightsPage.openTab('Localisation & media');
        await expect.poll(() => spy.requested).toContain('i18n/coverage');
        await expect.poll(() => spy.requested).toContain('media/uploads');
        await insightsPage.openTab('Team');
        await expect.poll(() => spy.requested).toContain('content/punchcard');

        // The three content stat tiles share a query key.
        expect(
            spy.requested.filter((route) => route === 'content/totals')
        ).toHaveLength(1);
    });

    test('a failing widget does not take down the rest of the page [insights:I-10]', async ({
        page,
        insightsPage
    }) => {
        await mockInsightsApi(page, { failing: ['content/stale'] });
        await insightsPage.goto(WORKSPACE_ID);

        await expect(
            insightsPage.signalLine('content.stale').getByRole('alert')
        ).toBeVisible();
        await expect(insightsPage.card('Publishing velocity')).toBeVisible();

        await insightsPage.openTab('Content');
        await expect(insightsPage.cardError('Gone quiet')).toBeVisible();
        // The failure has to read as a failure, never as "nothing to report".
        await expect(insightsPage.cardEmpty('Gone quiet')).toHaveCount(0);
        await expect(insightsPage.card('Waiting to go live')).toBeVisible();
    });

    test('a stat tile that cannot load shows no figure at all [insights:I-11]', async ({
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

        await expect(insightsPage.cardEmpty('By type')).toBeVisible();
        await insightsPage.openTab('Content');
        await expect(insightsPage.cardEmpty('Gone quiet')).toBeVisible();
        await expect(insightsPage.cardError('Gone quiet')).toHaveCount(0);
    });

    test('shows a skeleton per widget and per line while its request is open', async ({
        page,
        insightsPage
    }) => {
        await mockInsightsApi(page, { delayMs: 1500 });
        await insightsPage.goto(WORKSPACE_ID);

        await expect(
            insightsPage.cardSkeleton('Publishing velocity')
        ).toBeVisible();
        await expect(
            insightsPage
                .signalLine('content.stale')
                .getByTestId('signal-skeleton')
        ).toBeVisible();
        await expect(insightsPage.card('Publishing velocity')).toContainText(
            /busiest Thursday/
        );
    });

    test('changing the range refetches the range-dependent widgets [insights:I-17]', async ({
        page,
        insightsPage
    }) => {
        const spy = await mockInsightsApi(page);
        await insightsPage.goto(WORKSPACE_ID);
        await expect(insightsPage.card('Publishing velocity')).toBeVisible();

        expect(spy.days['content/velocity']).toBe('30');

        await insightsPage.selectRange('90d');
        await expect.poll(() => spy.days['content/velocity']).toBe('90');

        await insightsPage.openTab('Localisation & media');
        await expect.poll(() => spy.days['media/uploads']).toBe('90');

        // `stale` is deliberately range-free — the buckets *are* the time axis,
        // so the answer must not change when the page's window does.
        expect(spy.days['content/stale']).toBeNull();
    });

    test('the selected range is in the URL, so the view can be shared [insights:I-18]', async ({
        page,
        insightsPage
    }) => {
        await mockInsightsApi(page);
        await insightsPage.goto(WORKSPACE_ID);
        await expect(insightsPage.card('Publishing velocity')).toBeVisible();

        // The default stays out of the query string.
        expect(new URL(page.url()).searchParams.get('range')).toBeNull();

        await insightsPage.selectRange('90d');
        await expect
            .poll(() => new URL(page.url()).searchParams.get('range'))
            .toBe('90d');

        // Survives a reload — the state is in the URL, not in the component.
        await page.reload();
        await expect(insightsPage.rangeOption('90d')).toHaveAttribute(
            'aria-checked',
            'true'
        );

        // And back to the default drops the param rather than writing `30d`.
        await insightsPage.selectRange('30d');
        await expect
            .poll(() => new URL(page.url()).searchParams.get('range'))
            .toBeNull();
    });

    test('opens on the range a shared link names', async ({
        page,
        insightsPage
    }) => {
        const spy = await mockInsightsApi(page);
        await page.goto(`/workspaces/${WORKSPACE_ID}/insights?range=7d`);

        await expect(insightsPage.rangeOption('7d')).toHaveAttribute(
            'aria-checked',
            'true'
        );
        // The widgets open on that window too, not on the default.
        await expect.poll(() => spy.days['content/velocity']).toBe('7');
    });

    test('a range the page does not offer falls back to the default', async ({
        page,
        insightsPage
    }) => {
        const spy = await mockInsightsApi(page);
        // A hand-edited or stale link must still show numbers.
        await page.goto(`/workspaces/${WORKSPACE_ID}/insights?range=nonsense`);

        await expect(insightsPage.rangeOption('30d')).toHaveAttribute(
            'aria-checked',
            'true'
        );
        await expect.poll(() => spy.days['content/velocity']).toBe('30');
    });

    test('groups the punchcard in the reader’s own time zone', async ({
        page,
        insightsPage
    }) => {
        const spy = await mockInsightsApi(page);
        await insightsPage.goto(WORKSPACE_ID);
        await insightsPage.openTab('Team');

        const card = insightsPage.card('When the work happens');
        await expect(card).toContainText('saves per hour, your time zone');
        const zone = await page.evaluate(
            () => Intl.DateTimeFormat().resolvedOptions().timeZone
        );
        expect(spy.params['content/punchcard']?.['tz']).toBe(zone);
    });

    test('hides content widgets and lines from a user without content:read [insights:I-04] [insights:I-09]', async ({
        page,
        insightsPage
    }) => {
        await mockSignedIn(page, { permissions: ['media:read'] });
        await mockInsightsApi(page);
        await insightsPage.goto(WORKSPACE_ID);

        // The media tile and the media line are all Overview holds for them.
        await expect(
            insightsPage.widget('insights.media.storage')
        ).toBeVisible();
        await expect(
            insightsPage.attention().getByRole('listitem')
        ).toHaveCount(1);
        await expect(
            insightsPage.signal('Images missing alt text')
        ).toBeVisible();
        await expect(
            insightsPage.widget('insights.content.entries')
        ).toHaveCount(0);

        // A band whose every widget is gated out has no tab at all.
        await expect(insightsPage.tab('Content')).toHaveCount(0);
        await expect(insightsPage.tab('Team')).toHaveCount(0);
        await insightsPage.openTab('Localisation & media');
        await expect(insightsPage.card('Storage')).toBeVisible();
        // Coverage counts content, so it carries `content:read` even though it
        // is contributed by the i18n plugin and sits in the media band.
        await expect(insightsPage.card('Translation coverage')).toHaveCount(0);
    });

    test('shows the empty page when no widget is visible', async ({
        page,
        insightsPage
    }) => {
        await mockSignedIn(page, { permissions: [] });
        await mockInsightsApi(page);
        await insightsPage.goto(WORKSPACE_ID);

        await expect(insightsPage.emptyPage()).toBeVisible();
        await expect(insightsPage.attention()).toHaveCount(0);
    });
});
