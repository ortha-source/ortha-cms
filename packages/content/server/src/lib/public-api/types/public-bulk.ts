import type { PublicEntry } from './public-entry';

/**
 * Wire contracts for the public API's **batch** writes — one request that saves,
 * publishes, unpublishes or deletes many entries of one content type.
 *
 * Shared by every surface that offers them: the public REST routes and the MCP
 * `content_bulk_*` tools. Defined once here so a client that learned a shape
 * from the OpenAPI document reads the tool's output without a second mapping.
 *
 * Only the **save** contract is new. Bulk publish / unpublish / delete answer in
 * the shapes the admin's own bulk routes already publish (`BulkPublishResult`,
 * `BulkActionResult`), because they run the very same use-cases — see
 * `PublicEntryWritesService`.
 */

/** What a bulk-save item does to the store. */
export const BULK_SAVE_OP = {
    /** Insert a new entry — a draft on a publishable type. */
    Create: 'create',
    /** Merge values onto an entry that already exists. */
    Update: 'update'
} as const;

/** One item's operation. */
export type BulkSaveOp = (typeof BULK_SAVE_OP)[keyof typeof BULK_SAVE_OP];

/**
 * Why one item of a batch did not go through.
 *
 * Carries the **status the equivalent single-entry call would have returned**
 * (404 for an entry that isn't there, 422 for values that don't validate, 400
 * for a malformed item) rather than a bulk-specific error vocabulary, so a
 * client already handling the single-entry API needs no new branch — and so a
 * per-item failure stays diagnosable at all, which a flattened boolean would
 * not be.
 */
export interface PublicBulkError {
    /** The HTTP status the same write would have failed with on its own. */
    status: number;
    /** The message, as the single-entry route would have phrased it. */
    message: string;
    /** The per-field issues of a 422, when there are any. */
    issues?: unknown;
}

/** What became of one submitted item, positionally matched to the request. */
export interface PublicBulkSaveItemResult {
    /** The item's 0-based position in the submitted `items` array. */
    index: number;
    /** Which operation the item resolved to. @see BULK_SAVE_OP */
    op: BulkSaveOp;
    /** Whether the write landed. */
    ok: boolean;
    /** The saved entry, in the same shape a single-entry write returns. */
    entry?: PublicEntry;
    /** Why it did not, when `ok` is false. */
    error?: PublicBulkError;
}

/**
 * The response of a bulk save: one result per submitted item, **in request
 * order**, plus the tallies.
 *
 * **Partial success is the contract**, not a degraded mode. The items are
 * written one transaction at a time (see `PublicEntryWritesService.bulkSave`),
 * so a batch cannot be rolled back as a unit — and rejecting 49 good entries
 * because the fiftieth names a missing relation would make the endpoint useless
 * for the imports it exists to serve. The response is therefore always a 200
 * with the per-item verdicts, exactly as the bulk-publish commit reports its
 * `skipped` ids, and a caller retries the failures it can fix.
 */
export interface PublicBulkSaveResult {
    /** One entry per submitted item, in request order. */
    items: PublicBulkSaveItemResult[];
    /** How many items were inserted. */
    created: number;
    /** How many existing entries were changed. */
    updated: number;
    /** How many items did not save. */
    failed: number;
}
