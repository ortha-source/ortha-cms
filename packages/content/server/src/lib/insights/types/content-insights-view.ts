/**
 * Read-side view shapes for the content Insights widgets.
 *
 * These are **transport contracts**, restated verbatim by `content-admin` (the
 * admin can't import a server package across the module boundary). Every one is
 * derived live from the collection tables — this plugin keeps no projection and
 * owns no insights schema.
 */

/** A single point on a time series. */
export interface InsightsSeriesPoint {
    /** Bucket start, `YYYY-MM-DD`. The client formats it. */
    bucket: string;
    /** Measured value for the bucket. */
    value: number;
}

/**
 * Headline counts for the stat tiles.
 *
 * `draftsDelta` is deliberately absent while `entriesDelta` and `publishedDelta`
 * are present. A draft's count changes when a row is *published*, and nothing
 * records when that transition happened in reverse — `published_at` tells us
 * when something went live, but a row that moved back to draft leaves no trace
 * on the collection table. Reporting a draft delta would mean inventing one.
 */
export interface ContentTotalsView {
    /** Every non-deleted entry in the workspace. */
    entries: number;
    /** Entries currently live. */
    published: number;
    /** Entries currently in draft. */
    drafts: number;
    /** Entries created within the window. */
    entriesDelta: number;
    /** Entries first published within the window. */
    publishedDelta: number;
    /** Cumulative entry count across the window, oldest bucket first. */
    entriesHistory: number[];
    /** Cumulative published count across the window, oldest bucket first. */
    publishedHistory: number[];
}

/** One age bucket of the staleness breakdown. */
export interface StaleBucketView {
    /** Bucket key — `d30`, `d90`, `d180`, `d365`, `older`. */
    id: string;
    /** Entries whose last edit falls in this bucket. */
    count: number;
}

/** Published entries grouped by how long ago they were last touched. */
export interface ContentStaleView {
    /** The buckets, freshest first. */
    buckets: StaleBucketView[];
    /** Total across all buckets, so the client needn't re-add them. */
    total: number;
}

/** Draft/published split for one content type. */
export interface PipelineTypeView {
    /** The type's machine name. */
    name: string;
    /** Its human label. */
    label: string;
    /** Entries currently live. */
    published: number;
    /** Entries currently in draft. */
    drafts: number;
}

/** Draft/published split across every content type in the workspace. */
export interface ContentPipelineView {
    /** One row per type that has at least one entry, biggest first. */
    types: PipelineTypeView[];
}

/** Entries published per time bucket. */
export interface ContentVelocityView {
    /** The series, oldest bucket first. */
    points: InsightsSeriesPoint[];
    /** Bucket width, so the client can label the axis correctly. */
    granularity: 'day' | 'week' | 'month';
}

/** Live-vs-unpublished-edits split for one content type. */
export interface UnshippedTypeView {
    /** The type's machine name. */
    name: string;
    /** Its human label. */
    label: string;
    /** Entries live with unpublished edits on top of what is live. */
    modified: number;
    /** Entries live and current — nothing pending. */
    published: number;
}

/**
 * Entries whose live version is behind what an editor has saved.
 *
 * The publish state is **two stored values that carry three meanings**, which is
 * the whole reason this endpoint exists: `status` alone cannot separate "never
 * published" from "published, then edited". `published_at` is stamped on the
 * first publish and cleared only by an unpublish, so `draft` + a timestamp is
 * live content with unpublished changes on top — the admin's **Modified** badge
 * — while `draft` + no timestamp is a draft nobody has ever shipped.
 */
export interface ContentUnshippedView {
    /** One row per publishable type holding at least one modified entry. */
    types: UnshippedTypeView[];
    /** Modified entries across the workspace — live, with edits pending. */
    modified: number;
    /** Entries with a live version at all (`modified` + fully published). */
    live: number;
    /** Drafts that have never gone live. */
    neverPublished: number;
}

/** One weekday × hour cell of the editing punchcard. */
export interface PunchcardCellView {
    /** ISO weekday, 1 = Monday … 7 = Sunday. */
    weekday: number;
    /** Hour of day, 0–23, in the database session's timezone (UTC). */
    hour: number;
    /** Revisions written in that slot. */
    count: number;
}

/**
 * Editing activity by weekday and hour.
 *
 * Only non-empty slots are returned — a full 7 × 24 grid is 168 cells and most
 * are zero, so the client fills the gaps. `max` comes with it because the client
 * needs the busiest value to normalise the ramp, and recomputing it from a
 * sparse list would give the wrong denominator whenever the grid is empty.
 */
export interface ContentPunchcardView {
    /** The non-empty cells. */
    cells: PunchcardCellView[];
    /** The busiest cell's count, or 0 when there is no activity. */
    max: number;
    /** Revisions across the whole window. */
    total: number;
}
