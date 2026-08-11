import { type Page } from '@playwright/test';

/** JSON response helper, mirroring the other mock modules. */
const json = (body: unknown) => ({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(body)
});

/**
 * The seeded content totals. Chosen so the derived figures are checkable rather
 * than round: drafts / entries is exactly 19%, which is what the Drafts tile
 * renders in place of a change figure it has no data for.
 */
export const CONTENT_TOTALS_SEED = {
    entries: 1284,
    published: 1046,
    drafts: 238,
    entriesDelta: 48,
    publishedDelta: 31,
    entriesHistory: [1180, 1198, 1211, 1224, 1240, 1262, 1271, 1284],
    publishedHistory: [948, 967, 981, 996, 1008, 1029, 1038, 1046]
};

/** Staleness buckets. The `older` bucket drives the widget's warning chip. */
export const CONTENT_STALE_SEED = {
    buckets: [
        { id: 'd30', count: 412 },
        { id: 'd90', count: 306 },
        { id: 'd180', count: 221 },
        { id: 'd365', count: 189 },
        { id: 'older', count: 156 }
    ],
    total: 1284
};

/** Draft/published split per type, biggest first as the server sorts them. */
export const CONTENT_PIPELINE_SEED = {
    types: [
        { name: 'article', label: 'Article', published: 412, drafts: 88 },
        { name: 'changelog', label: 'Changelog', published: 401, drafts: 93 },
        {
            name: 'landing_page',
            label: 'Landing page',
            published: 96,
            drafts: 41
        },
        { name: 'case_study', label: 'Case study', published: 74, drafts: 12 },
        { name: 'author', label: 'Author', published: 63, drafts: 4 }
    ]
};

/** Weekly publishing velocity — twelve buckets, ending on the highest. */
export const CONTENT_VELOCITY_SEED = {
    granularity: 'week' as const,
    points: [
        { bucket: '2026-03-02', value: 18 },
        { bucket: '2026-03-09', value: 24 },
        { bucket: '2026-03-16', value: 21 },
        { bucket: '2026-03-23', value: 32 },
        { bucket: '2026-03-30', value: 27 },
        { bucket: '2026-04-06', value: 35 },
        { bucket: '2026-04-13', value: 29 },
        { bucket: '2026-04-20', value: 41 },
        { bucket: '2026-04-27', value: 38 },
        { bucket: '2026-05-04', value: 33 },
        { bucket: '2026-05-11', value: 46 },
        { bucket: '2026-05-18', value: 52 }
    ]
};

/**
 * Live records carrying unpublished edits.
 *
 * 94 of 1046 live is exactly 9%, and the per-type rows deliberately do **not**
 * add up to the workspace total: the server omits a type with nothing pending,
 * so a suite that summed the rows and expected the headline would be asserting
 * a bug rather than the contract.
 */
export const CONTENT_UNSHIPPED_SEED = {
    types: [
        { name: 'article', label: 'Article', modified: 51, published: 361 },
        { name: 'changelog', label: 'Changelog', modified: 28, published: 373 },
        {
            name: 'landing_page',
            label: 'Landing page',
            modified: 15,
            published: 81
        }
    ],
    modified: 94,
    live: 1046,
    neverPublished: 144
};

/**
 * Localization coverage. English is complete, German part-way, French barely
 * started — the three shapes the widget's figures have to tell apart.
 *
 * `localized` (18) + `notLocalized` (44) is deliberately less than `records`
 * (140): the two are not slices of a partition, and a fixture where they added
 * up would let a wrong reading of the contract pass.
 */
export const I18N_COVERAGE_SEED = {
    locales: [
        {
            locale: 'en',
            name: 'English',
            isDefault: true,
            translated: 140,
            missing: 0
        },
        {
            locale: 'de',
            name: 'Deutsch',
            isDefault: false,
            translated: 62,
            missing: 78
        },
        {
            locale: 'fr',
            name: 'Français',
            isDefault: false,
            translated: 21,
            missing: 119
        }
    ],
    records: 140,
    localized: 18,
    notLocalized: 44,
    requiresLocalization: 122,
    // The per-type rows partition the workspace figures — 12 + 4 + 2 = 18 and
    // 76 + 34 + 12 = 122 — which is what makes the card's two breakdowns tell
    // the same story rather than two. Ordered by records, as the server sorts.
    types: [
        {
            name: 'article',
            label: 'Article',
            records: 88,
            localized: 12,
            notLocalized: 30,
            requiresLocalization: 76
        },
        {
            name: 'changelog',
            label: 'Changelog',
            records: 38,
            localized: 4,
            notLocalized: 11,
            requiresLocalization: 34
        },
        {
            name: 'landing_page',
            label: 'Landing page',
            records: 14,
            localized: 2,
            notLocalized: 3,
            requiresLocalization: 12
        }
    ]
};

/**
 * A sparse punchcard, as the server sends it — only non-empty slots.
 *
 * Deliberately sparse in the fixture too: the widget rebuilds the dense 7 × 14
 * grid itself, and seeding a full grid would stop the suite from covering that.
 */
export const CONTENT_PUNCHCARD_SEED = {
    cells: [
        [1, 8, 3],
        [1, 9, 8],
        [1, 10, 9],
        [1, 11, 7],
        [1, 13, 5],
        [1, 14, 7],
        [1, 15, 6],
        [1, 16, 4],
        [1, 17, 2],
        [2, 8, 2],
        [2, 9, 6],
        [2, 10, 8],
        [2, 11, 9],
        [2, 13, 6],
        [2, 14, 8],
        [2, 15, 7],
        [2, 16, 5],
        [2, 17, 3],
        [3, 9, 5],
        [3, 10, 8],
        [3, 11, 7],
        [3, 12, 3],
        [3, 13, 4],
        [3, 14, 9],
        [3, 15, 5],
        [3, 16, 3],
        [4, 8, 2],
        [4, 9, 4],
        [4, 10, 6],
        [4, 11, 5],
        [4, 13, 3],
        [4, 14, 5],
        [4, 15, 4],
        [4, 16, 2],
        [5, 9, 3],
        [5, 10, 4],
        [5, 11, 3],
        [5, 13, 2],
        [5, 14, 2],
        [6, 11, 1],
        [7, 15, 1]
    ].map(([weekday, hour, count]) => ({ weekday, hour, count })),
    max: 9,
    total: 196
};

/**
 * Media storage. Video is first with the fewest assets and the most bytes —
 * the case the widget's footer is written to call out, and the reason bars are
 * scaled by bytes rather than count.
 */
export const MEDIA_STORAGE_SEED = {
    kinds: [
        { kind: 'video', count: 224, bytes: 11381663334 },
        { kind: 'image', count: 2481, bytes: 6657199308 },
        { kind: 'document', count: 596, bytes: 1181116006 },
        { kind: 'audio', count: 87, bytes: 429496730 },
        { kind: 'archive', count: 24, bytes: 107374182 }
    ],
    totalBytes: 19756849560,
    totalCount: 3412
};

/** Weekly uploads across the window. */
export const MEDIA_UPLOADS_SEED = {
    granularity: 'week' as const,
    points: [
        { bucket: '2026-04-13', value: 38 },
        { bucket: '2026-04-20', value: 44 },
        { bucket: '2026-04-27', value: 72 },
        { bucket: '2026-05-04', value: 58 },
        { bucket: '2026-05-11', value: 66 },
        { bucket: '2026-05-18', value: 81 }
    ],
    total: 359
};

/** Alt-text coverage — 794 of 2481 missing is exactly 32%. */
export const MEDIA_ALT_SEED = {
    images: 2481,
    withAlt: 1687,
    missing: 794
};

/** Every Insights route, keyed by the suffix after `/api/insights/`. */
const SEEDS: Record<string, unknown> = {
    'content/totals': CONTENT_TOTALS_SEED,
    'content/stale': CONTENT_STALE_SEED,
    'content/pipeline': CONTENT_PIPELINE_SEED,
    'content/velocity': CONTENT_VELOCITY_SEED,
    'content/punchcard': CONTENT_PUNCHCARD_SEED,
    'content/unshipped': CONTENT_UNSHIPPED_SEED,
    'media/storage': MEDIA_STORAGE_SEED,
    'media/uploads': MEDIA_UPLOADS_SEED,
    'media/alt': MEDIA_ALT_SEED,
    'i18n/coverage': I18N_COVERAGE_SEED
};

/** The empty answer each route gives for a workspace with nothing in it. */
const EMPTY: Record<string, unknown> = {
    'content/totals': {
        entries: 0,
        published: 0,
        drafts: 0,
        entriesDelta: 0,
        publishedDelta: 0,
        entriesHistory: [],
        publishedHistory: []
    },
    'content/stale': { buckets: [], total: 0 },
    'content/pipeline': { types: [] },
    'content/velocity': { granularity: 'week', points: [] },
    'content/punchcard': { cells: [], max: 0, total: 0 },
    'content/unshipped': {
        types: [],
        modified: 0,
        live: 0,
        neverPublished: 0
    },
    'media/storage': { kinds: [], totalBytes: 0, totalCount: 0 },
    'media/uploads': { granularity: 'week', points: [], total: 0 },
    'media/alt': { images: 0, withAlt: 0, missing: 0 },
    // The locale list survives an empty workspace — the locales are
    // configuration, not data, so a workspace with no content still has three
    // languages nobody has written in.
    'i18n/coverage': {
        locales: I18N_COVERAGE_SEED.locales.map((locale) => ({
            ...locale,
            translated: 0,
            missing: 0
        })),
        records: 0,
        localized: 0,
        notLocalized: 0,
        requiresLocalization: 0,
        // Empty, not a row of zeros per type: the server omits a type the
        // workspace has never used.
        types: []
    }
};

/** Records which Insights routes were requested, and with what `?days=`. */
export interface InsightsSpy {
    /** Route suffixes requested, in order (e.g. `content/totals`). */
    readonly requested: string[];
    /** The `days` query value seen per route suffix, latest wins. */
    readonly days: Record<string, string | null>;
}

/** Options for {@link mockInsightsApi}. */
export interface InsightsApiOptions {
    /** Route suffixes to fail with a 500 (e.g. `['content/stale']`). */
    failing?: string[];
    /** Route suffixes to answer with the empty shape rather than the seed. */
    empty?: string[];
    /** Hold every response open this long, to observe the widget skeletons. */
    delayMs?: number;
}

/**
 * Stub every Insights endpoint the page's widgets call.
 *
 * One helper for every route because the page's defining behaviour is that each
 * widget owns its **own** request: a suite has to be able to fail or empty
 * exactly one of them and assert the rest still render. `failing` and `empty`
 * take route suffixes for precisely that.
 */
export async function mockInsightsApi(
    page: Page,
    { failing = [], empty = [], delayMs }: InsightsApiOptions = {}
): Promise<InsightsSpy> {
    const spy: InsightsSpy = { requested: [], days: {} };

    await page.route('**/api/insights/**', async (route) => {
        const url = new URL(route.request().url());
        const suffix = url.pathname.replace(/^.*\/api\/insights\//, '');

        spy.requested.push(suffix);
        spy.days[suffix] = url.searchParams.get('days');

        if (delayMs) {
            await new Promise((resolve) => setTimeout(resolve, delayMs));
        }

        if (failing.includes(suffix)) {
            await route.fulfill({
                status: 500,
                contentType: 'application/json',
                body: JSON.stringify({ message: 'Aggregate failed' })
            });
            return;
        }

        const body = empty.includes(suffix) ? EMPTY[suffix] : SEEDS[suffix];
        if (body === undefined) {
            await route.fulfill({ status: 404, body: '{}' });
            return;
        }
        await route.fulfill(json(body));
    });

    return spy;
}
