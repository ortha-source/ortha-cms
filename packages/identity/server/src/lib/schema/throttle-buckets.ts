import { index, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * One rate-limit bucket — the login (and invite / reset / SSO) throttle's
 * counter for one client on one route, shared by every instance of the API.
 *
 * It used to be `@nestjs/throttler`'s in-process `Map`, which made the limit
 * per **process**: behind N instances an attacker got N times the documented
 * attempts per window, and a restart forgot every block. A row here is what
 * every instance increments, in one statement, so the limit is the
 * deployment's rather than each process's.
 *
 * A fixed window: `hits` counts requests since the window opened and the
 * window ends at `window_ends_at`. Over the limit, `blocked_until` is set and
 * requests stop counting until it passes, at which point the bucket starts
 * over — the same blocking contract the in-memory store implements.
 */
export const throttleBuckets = pgTable(
    'throttle_buckets',
    {
        /**
         * The throttler's own key — a hash of the route, the throttler's name
         * and the tracker (`req.ip`). Opaque here.
         */
        key: text('key').primaryKey(),
        /** Requests counted in the current window. */
        hits: integer('hits').notNull(),
        /** When the current window closes and the count starts over. */
        windowEndsAt: timestamp('window_ends_at', {
            withTimezone: true
        }).notNull(),
        /** Set while the bucket is blocked; null otherwise. */
        blockedUntil: timestamp('blocked_until', { withTimezone: true })
    },
    (table) => [
        // The sweep of finished buckets.
        index('throttle_buckets_window_ends_at_idx').on(table.windowEndsAt)
    ]
);
