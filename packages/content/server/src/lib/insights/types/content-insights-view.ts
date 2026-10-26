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
    /**
     * The content type holding the most entries in the `older` bucket — the
     * Needs-attention line's "most in Guides". `null` when nothing is that old.
     */
    olderTopType: { name: string; label: string } | null;
}

/**
 * The age bands the "Gone quiet" drill-down filters by. Coarser than the five
 * chart buckets on purpose: the panel answers "which records", and three bands
 * a reader can name ("over a year") beat five they have to decode.
 *
 * - `recent` — last edited 30–90 days ago (the chart's `d90` bucket)
 * - `months` — 90–365 days (`d180` + `d365`)
 * - `year` — over a year (`older`)
 */
export type StaleAge = 'recent' | 'months' | 'year';

/** One record behind an Insights figure, as the drill-down panel lists it. */
export interface InsightsRecordView {
    /** Entry id. */
    id: string;
    /** The content type's machine name — the admin builds the link from it. */
    type: string;
    /** The content type's display label. */
    typeLabel: string;
    /**
     * The entry's display title, or `null` when it has no title-eligible value
     * (the admin then names it by a fragment of its id, as the review queue
     * does).
     */
    title: string | null;
    /** ISO last-edit timestamp — the age the list is sorted by. */
    updatedAt: string;
    /**
     * Who saved the newest revision, as a user id, or `null` when unknown. The
     * API stays id-only; the admin resolves it against the workspace roster it
     * already holds.
     */
    editorId: string | null;
}

/** How many of a drill-down's records sit in one content type. */
export interface InsightsRecordTypeCountView {
    /** The type's machine name. */
    name: string;
    /** Its display label. */
    label: string;
    /** Matching records of this type. */
    count: number;
}

/**
 * The records behind one Needs-attention figure: the true total, where they
 * sit per type (so "open all in Records" can link each type's table with the
 * same filter), and the oldest `limit` of them.
 */
export interface ContentRecordsView {
    /** Every matching record, not just the listed ones. */
    total: number;
    /** Per type, biggest first. Types with none are omitted. */
    types: InsightsRecordTypeCountView[];
    /** The oldest matches first, capped at the requested limit. */
    records: InsightsRecordView[];
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
    /**
     * The drafts that are **live with pending edits** — `draft` with a
     * `published_at`, the admin's **Modified** badge. A subset of `drafts`, so
     * `drafts - modified` is what has never shipped.
     */
    modified: number;
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
    /**
     * The ISO weekday (1 = Monday … 7 = Sunday, UTC) with the most publishes in
     * the window, or `null` when nothing was published. Grouped database-side
     * because a week- or month-wide bucket cannot say which day it was.
     */
    busiestWeekday: number | null;
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
    /** Hour of day, 0–23, in the response's `timeZone`. */
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
    /**
     * The IANA zone the weekday and hour were computed in — the one the caller
     * asked for with `?tz=`, or `UTC` when it named none or one the database
     * does not know. Sent back so the caption can say which zone it is
     * reading, rather than claiming "your time zone" over UTC buckets.
     */
    timeZone: string;
}
