/**
 * Named HTTP status codes used across the admin app, so call sites read
 * `HTTP_STATUS.UNAUTHORIZED` instead of a bare `401`. Extend as new flows need
 * more codes — keep it to codes the UI actually branches on.
 */
export const HTTP_STATUS = {
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    TOO_MANY_REQUESTS: 429
} as const;
