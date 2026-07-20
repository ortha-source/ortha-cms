/** How long an invite token stays valid. */
export const INVITE_TOKEN_TTL_DAYS = 7;

/** Default page size for `GET /api/users`. */
export const DEFAULT_PAGE_SIZE = 10;

/** Upper bound on the requested page size (the largest option the UI offers). */
export const MAX_PAGE_SIZE = 100;

/**
 * Max length of the raw `?filter=` JSON string. A coarse first guard against
 * oversized payloads, ahead of the filter engine's node/depth caps.
 */
export const FILTER_MAX_LENGTH = 4096;
