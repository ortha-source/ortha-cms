/**
 * The content Insights read models, restated from the server's view contracts.
 *
 * Restated rather than imported: the admin can't reach across the app boundary
 * into `@orthacms/content-server`, exactly as it restates every other wire type
 * in this package.
 */

/** A single point on a time series. */
export type InsightsSeriesPoint = {
    /** Bucket start, `YYYY-MM-DD`. */
    bucket: string;
    /** Measured value for the bucket. */
    value: number;
};

/**
 * Headline counts for the stat tiles.
 *
 * There is no draft delta, and that is the server's shape, not an omission
 * here: nothing records when an entry moved *back* to draft, so a change figure
 * for drafts could only be invented.
 */
export type ContentTotals = {
    entries: number;
    published: number;
    drafts: number;
    entriesDelta: number;
    publishedDelta: number;
    entriesHistory: number[];
    publishedHistory: number[];
};

/** One age bucket of the staleness breakdown. */
export type StaleBucket = {
    /** `d30` · `d90` · `d180` · `d365` · `older`. */
    id: string;
    count: number;
};

/** Published entries grouped by how long ago they were last touched. */
export type ContentStale = {
    buckets: StaleBucket[];
    total: number;
    /** The type holding most of the `older` bucket — "most in Guides". */
    olderTopType: { name: string; label: string } | null;
};

/**
 * The age bands of the "Gone quiet" drill-down: 30–90 days, 3–12 months,
 * over a year — the stale chart's own edges, coarsened to three.
 */
export type StaleAge = 'recent' | 'months' | 'year';

/** One record behind an Insights figure. */
export type InsightsRecord = {
    id: string;
    /** The content type's machine name. */
    type: string;
    typeLabel: string;
    /** `null` when the entry has no title-eligible value. */
    title: string | null;
    /** ISO last-edit timestamp. */
    updatedAt: string;
    /** Who saved the newest revision — resolved against the roster. */
    editorId: string | null;
};

/** The records behind a Needs-attention line: total, per type, oldest few. */
export type ContentRecords = {
    total: number;
    types: { name: string; label: string; count: number }[];
    records: InsightsRecord[];
};

/** Draft/published split for one content type. */
export type PipelineType = {
    name: string;
    label: string;
    published: number;
    /** Every draft, modified ones included. */
    drafts: number;
    /** Drafts with live content behind them — a subset of `drafts`. */
    modified: number;
};

/** Draft/published split across the workspace's content types. */
export type ContentPipeline = {
    types: PipelineType[];
};

/** Live-vs-unpublished-edits split for one content type. */
export type UnshippedType = {
    name: string;
    label: string;
    /** Entries live with unpublished edits on top of what is live. */
    modified: number;
    /** Entries live and current. */
    published: number;
};

/**
 * Entries whose live version is behind what an editor has saved.
 *
 * `notLocalized`'s counterpart on the content side of the same idea: `status`
 * alone cannot separate a never-shipped draft from live content carrying
 * pending edits, which is why the server reads `publishedAt` too. `live` counts
 * only **publishable** types — an always-live singleton has nothing to ship, so
 * folding it into the denominator would make the share meaningless.
 */
export type ContentUnshipped = {
    /** One row per type holding at least one modified entry, biggest first. */
    types: UnshippedType[];
    modified: number;
    live: number;
    neverPublished: number;
};

/** Entries published per time bucket. */
export type ContentVelocity = {
    points: InsightsSeriesPoint[];
    granularity: 'day' | 'week' | 'month';
    /** ISO weekday (1 = Monday) with the most publishes, or `null`. */
    busiestWeekday: number | null;
};

/** One weekday x hour cell of the editing punchcard. */
export type PunchcardCell = {
    /** ISO weekday, 1 = Monday ... 7 = Sunday. */
    weekday: number;
    /** Hour of day, 0-23, in the response's `timeZone`. */
    hour: number;
    count: number;
};

/**
 * Editing activity by weekday and hour. Only non-empty slots are sent — most of
 * a 7 x 24 grid is zero — so the client fills the gaps, and `max` rides along
 * because normalising from a sparse list would give the wrong denominator.
 */
export type ContentPunchcard = {
    cells: PunchcardCell[];
    max: number;
    total: number;
    /** The zone the grid was grouped in — the one asked for, or `UTC`. */
    timeZone: string;
};

/**
 * The port over the content Insights endpoints.
 *
 * One method per widget, mirroring one endpoint per widget: the Insights page
 * mounts every card at once and each owns its own request, so a slow aggregate
 * degrades one card rather than blanking the dashboard.
 * {@link httpContentInsightsGateway} is the HTTP implementation.
 */
export type ContentInsightsGateway = {
    /** `GET /insights/content/totals` — counts, deltas and sparkline history. */
    totals(days: number): Promise<ContentTotals>;
    /** `GET /insights/content/stale` — published entries by last-edit age. */
    stale(): Promise<ContentStale>;
    /** `GET /insights/content/pipeline` — draft/published split per type. */
    pipeline(): Promise<ContentPipeline>;
    /** `GET /insights/content/unshipped` — live entries with pending edits. */
    unshipped(): Promise<ContentUnshipped>;
    /** `GET /insights/content/velocity` — entries published per bucket. */
    velocity(days: number): Promise<ContentVelocity>;
    /** `GET /insights/content/punchcard` — edits by weekday and hour. */
    punchcard(days: number, timeZone: string): Promise<ContentPunchcard>;
    /** `GET /insights/content/stale/records` — the records in one age band. */
    staleRecords(age: StaleAge, limit: number): Promise<ContentRecords>;
    /** `GET /insights/content/unshipped/records` — live records with edits. */
    unshippedRecords(limit: number): Promise<ContentRecords>;
};
