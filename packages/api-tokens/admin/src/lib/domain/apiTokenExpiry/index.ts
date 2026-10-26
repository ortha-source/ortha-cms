/**
 * How far ahead an active token's expiry counts as "expiring soon". Mirrors the
 * server's `EXPIRING_SOON_DAYS` (identity-server, `api-token-status.ts`), which
 * computes the page-wide summary; this copy drives the per-row badge.
 */
export const EXPIRING_SOON_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/** The expiry presets the create dialog offers, in days; `never` is none. */
export type ExpiryPreset = 'never' | '30' | '90' | '365';

/** Every preset, in the order the dialog shows them. */
export const EXPIRY_PRESETS: readonly ExpiryPreset[] = [
    'never',
    '30',
    '90',
    '365'
];

/** The preset a new token starts with — finite, so a forgotten token dies. */
export const DEFAULT_EXPIRY_PRESET: ExpiryPreset = '30';

/** The absolute expiry a preset resolves to from `now`, or `null` for never. */
export function expiryFromPreset(
    preset: ExpiryPreset,
    now: number = Date.now()
): Date | null {
    if (preset === 'never') {
        return null;
    }
    return new Date(now + Number(preset) * DAY_MS);
}

/**
 * Whether a live token's expiry falls inside the expiring-soon window. The
 * caller decides liveness (a revoked or expired token is past "soon").
 */
export function expiresWithinWindow(
    expiresAt: Date | null,
    now: number = Date.now()
): boolean {
    if (!expiresAt) {
        return false;
    }
    const left = expiresAt.getTime() - now;
    return left > 0 && left <= EXPIRING_SOON_DAYS * DAY_MS;
}

/**
 * Whole days until `date`, rounded up — "in 12 days" for anything between
 * eleven and twelve days away, so a token is never described as expiring
 * sooner than it does. Never less than zero.
 */
export function daysUntil(date: Date, now: number = Date.now()): number {
    return Math.max(0, Math.ceil((date.getTime() - now) / DAY_MS));
}
