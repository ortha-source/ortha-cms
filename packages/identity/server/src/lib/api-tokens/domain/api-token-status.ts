/**
 * The three display states of a token. There is **no status column**: each is
 * derived from two independent facts, `revoked_at` and `expires_at`, and
 * revocation wins over expiry (a revoked token is `revoked` whatever its
 * expiry says).
 */
export const API_TOKEN_STATUSES = ['active', 'expired', 'revoked'] as const;

/** One of {@link API_TOKEN_STATUSES}. */
export type ApiTokenStatus = (typeof API_TOKEN_STATUSES)[number];

/**
 * How far ahead an active token's expiry counts as "expiring soon" — the window
 * in which the admin list flags it, so a build learns about it before it starts
 * failing with a 401. The admin mirrors this constant for its row badge; the
 * server is the source of the page-wide summary.
 */
export const EXPIRING_SOON_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/** The facts a status is derived from. */
export interface ApiTokenLifecycleFacts {
    expiresAt: Date | null;
    revokedAt: Date | null;
}

/**
 * Derives a token's status at `now`. Revocation is checked first, because a
 * revoked token may well carry an expiry in the future and must never read as
 * live.
 */
export function apiTokenStatusOf(
    token: ApiTokenLifecycleFacts,
    now: Date
): ApiTokenStatus {
    if (token.revokedAt) {
        return 'revoked';
    }
    if (token.expiresAt && token.expiresAt.getTime() <= now.getTime()) {
        return 'expired';
    }
    return 'active';
}

/** The instant before which an active token's expiry counts as "soon". */
export function expiringSoonCutoff(now: Date): Date {
    return new Date(now.getTime() + EXPIRING_SOON_DAYS * DAY_MS);
}

/**
 * Whether a token is live **and** expires within {@link EXPIRING_SOON_DAYS}. A
 * token that never expires is never "soon"; one already expired or revoked is
 * not either — it has already stopped working.
 */
export function isExpiringSoon(
    token: ApiTokenLifecycleFacts,
    now: Date
): boolean {
    return (
        apiTokenStatusOf(token, now) === 'active' &&
        token.expiresAt !== null &&
        token.expiresAt.getTime() <= expiringSoonCutoff(now).getTime()
    );
}
