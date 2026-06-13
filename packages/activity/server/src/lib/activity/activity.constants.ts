/** Default page size for `GET /api/activity`. */
export const DEFAULT_PAGE_SIZE = 25;

/** Upper bound on the requested page size (the largest option the UI offers). */
export const MAX_PAGE_SIZE = 100;

/** Columns the read API permits sorting by (whitelist — keys are the wire values). */
export const SORTABLE_FIELDS = ['at', 'kind'] as const;

/** A field the read API may sort by. */
export type SortableField = (typeof SORTABLE_FIELDS)[number];

/** Sort directions the read API accepts. */
export const SORT_ORDERS = ['asc', 'desc'] as const;

/** A sort direction accepted by the read API. */
export type SortOrder = (typeof SORT_ORDERS)[number];
