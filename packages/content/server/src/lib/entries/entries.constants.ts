/** Pagination + filter limits for the entries list endpoint. */

/** Default rows per page when the client omits `pageSize`. */
export const DEFAULT_PAGE_SIZE = 25;

/** Hard cap on rows per page — bounds a single query's cost. */
export const MAX_PAGE_SIZE = 100;

/** Max length of the raw `?filter=` JSON (first line of defence before parsing). */
export const FILTER_MAX_LENGTH = 4096;

/** Max ids a single bulk action (`{ ids }`) may target — bounds the statement. */
export const BULK_MAX_IDS = 100;

/**
 * Max items a single bulk **save** may carry.
 *
 * Lower than {@link BULK_MAX_IDS} on purpose: a bulk action ships a list of
 * uuids, while a bulk save ships whole documents — rich-text bodies included —
 * and then performs one write transaction per item. The cap bounds the request
 * body and the time a single call can hold the workspace's content lock.
 */
export const BULK_MAX_SAVE_ITEMS = 50;
