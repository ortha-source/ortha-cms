import { Logger } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';
import type { Database } from '@orthacms/database';
import { and, isNull, lt, or, sql } from 'drizzle-orm';
import { throttleBuckets as bucket } from '../../schema/throttle-buckets';

/** What the throttler reads back from one increment. */
type ThrottlerStorageRecord = Awaited<
    ReturnType<ThrottlerStorage['increment']>
>;

/** How often, at most, one process sweeps finished buckets. */
const SWEEP_INTERVAL_MS = 60_000;

/**
 * `@nestjs/throttler`'s storage, in Postgres — so a rate limit means the same
 * thing on one instance and on ten.
 *
 * The library's default is a `Map` in the process. With several instances
 * behind a load balancer each kept its own count, so the login limit was N
 * times looser than configured, and a restart lifted every block.
 *
 * **One statement per request.** `INSERT … ON CONFLICT DO UPDATE … RETURNING`
 * reads, decides and writes the bucket under the row lock the upsert takes,
 * so two instances counting the same client at the same moment serialise on
 * the row instead of both reading `limit - 1` and both letting a request
 * through — the count-then-write shape this repository has been bitten by
 * before. There is no read beforehand and no transaction around it.
 *
 * The decision mirrors the in-memory store's contract: a request counts while
 * the bucket is not blocked; the hit that takes it past `limit` blocks it for
 * `blockDuration`; a blocked bucket stops counting; once the block or the
 * window has passed, the bucket starts over at this request. (The window is
 * fixed rather than the default store's per-hit sliding expiry, which is what
 * every shared store does and is the stricter of the two at a window edge.)
 *
 * Finished buckets are deleted by a sweep run at most once a minute per
 * process, off the request path. Nothing depends on it for correctness — an
 * expired bucket restarts on its next hit either way — it only keeps one row
 * per client who ever tried from accumulating.
 */
export class PostgresThrottlerStorage implements ThrottlerStorage {
    private readonly logger = new Logger(PostgresThrottlerStorage.name);
    private lastSweptAt = 0;

    constructor(private readonly db: Database) {}

    async increment(
        key: string,
        ttl: number,
        limit: number,
        // The fifth argument, the throttler's name, is already part of `key`.
        blockDuration: number
    ): Promise<ThrottlerStorageRecord> {
        // Milliseconds, as the throttler hands them over.
        const window = sql`(${ttl}::double precision * interval '1 millisecond')`;
        const block = sql`(${blockDuration}::double precision * interval '1 millisecond')`;
        const max = sql`${limit}::int`;

        // The stored row's state, as the upsert's `SET` sees it.
        const blocked = sql`(${bucket.blockedUntil} is not null and ${bucket.blockedUntil} > now())`;
        const restarts = sql`((${bucket.blockedUntil} is not null and ${bucket.blockedUntil} <= now()) or ${bucket.windowEndsAt} <= now())`;
        const hits = sql`case when ${blocked} then ${bucket.hits} when ${restarts} then 1 else ${bucket.hits} + 1 end`;

        const [row] = await this.db
            .insert(bucket)
            .values({
                key,
                hits: 1,
                windowEndsAt: sql`now() + ${window}`,
                blockedUntil: sql`case when 1 > ${max} then now() + ${block} end`
            })
            .onConflictDoUpdate({
                target: bucket.key,
                set: {
                    hits,
                    windowEndsAt: sql`case when not ${blocked} and ${restarts} then now() + ${window} else ${bucket.windowEndsAt} end`,
                    blockedUntil: sql`case when ${blocked} then ${bucket.blockedUntil} when ${hits} > ${max} then now() + ${block} end`
                }
            })
            .returning({
                totalHits: bucket.hits,
                timeToExpire: sql<number>`greatest(ceil(extract(epoch from (${bucket.windowEndsAt} - now()))), 0)::int`,
                isBlocked: sql<boolean>`coalesce(${bucket.blockedUntil} > now(), false)`,
                timeToBlockExpire: sql<number>`coalesce(greatest(ceil(extract(epoch from (${bucket.blockedUntil} - now()))), 0), 0)::int`
            });

        this.sweepIfDue();
        return row;
    }

    /**
     * Deletes buckets whose window and block have both passed, at most once a
     * minute. Fire-and-forget: a failed sweep costs only some stale rows, and
     * must not fail the request that happened to trigger it.
     */
    private sweepIfDue(): void {
        if (Date.now() - this.lastSweptAt < SWEEP_INTERVAL_MS) return;
        this.lastSweptAt = Date.now();
        this.db
            .delete(bucket)
            .where(
                and(
                    lt(bucket.windowEndsAt, sql`now()`),
                    or(
                        isNull(bucket.blockedUntil),
                        lt(bucket.blockedUntil, sql`now()`)
                    )
                )
            )
            .then(
                () => undefined,
                (error: unknown) =>
                    this.logger.warn(
                        `Sweeping expired rate-limit buckets failed: ${
                            error instanceof Error
                                ? error.message
                                : String(error)
                        }`
                    )
            );
    }
}
