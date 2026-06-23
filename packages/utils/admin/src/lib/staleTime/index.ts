/**
 * Named TanStack Query `staleTime` presets (milliseconds), so call sites pass
 * `STALE_TIME.Standard` instead of a bare `60_000`. Centralised here because the
 * same handful of durations recur across every plugin's data hooks; one source
 * keeps "how long is reference data fresh?" a single decision.
 */
export const STALE_TIME = {
    /** Volatile data — always considered stale, refetch on every mount. */
    None: 0,
    /** Short-lived lookups (search, slug availability) — a few seconds. */
    Short: 30_000,
    /** Reference data that changes rarely (content schemas, option lists). */
    Standard: 60_000,
    /** Effectively immutable for the session (e.g. the current user). */
    Forever: Infinity
} as const;
