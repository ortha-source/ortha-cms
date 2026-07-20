/**
 * Parse a query-string integer with a default and inclusive bounds. A missing or
 * non-numeric `raw` falls back to `fallback`; a numeric one is truncated and
 * clamped into `[min, maxValue]`. Handy for pagination params (`?page=`,
 * `?pageSize=`) where the caller wants a safe integer regardless of input.
 */
export function clampInt(
    raw: string | undefined,
    fallback: number,
    min: number,
    maxValue: number
): number {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(maxValue, Math.max(min, Math.trunc(parsed)));
}
