/** Pagination + filter limits for the entries list endpoint. */

/** Default rows per page when the client omits `pageSize`. */
export const DEFAULT_PAGE_SIZE = 25;

/** Hard cap on rows per page — bounds a single query's cost. */
export const MAX_PAGE_SIZE = 100;

/**
 * Max length of the raw `?filter=` JSON string — a coarse first guard against
 * oversized payloads, ahead of the filter engine's own budgets.
 *
 * Re-exported rather than declared: the number belongs to the engine that
 * enforces the rest of the filter's limits, and four packages each declaring
 * their own copy is how one of them (`alarms`) came to say 8192 while the other
 * three said 4096. See `filters/budgets.ts` in `@orthacms/utils-server`.
 */
export { FILTER_MAX_LENGTH } from '@orthacms/utils-server';

/** Max ids a single bulk action (`{ ids }`) may target — bounds the statement. */
export const BULK_MAX_IDS = 100;

/**
 * Most linked drafts the publish context reports **per requested entry**. A
 * many-relation can hold thousands of links; the Publish Manager offers the
 * drafts among them as a convenience, and a list longer than this is a job for
 * the target type's own records view. Past the cap the entry says it was
 * truncated rather than pretending the list is whole.
 */
export const PUBLISH_CONTEXT_MAX_LINKED = 50;

/**
 * Max items a single bulk **save** may carry.
 *
 * Lower than {@link BULK_MAX_IDS} on purpose: a bulk action ships a list of
 * uuids, while a bulk save ships whole documents — rich-text bodies included —
 * and then performs one write transaction per item. The cap bounds the request
 * body and the time a single call can hold the workspace's content lock.
 */
export const BULK_MAX_SAVE_ITEMS = 50;
