import { Injectable } from '@nestjs/common';
import { InjectDatabase, type Database } from '@orthacms/database';
import { PostgresThrottlerStorage } from './postgres-throttler.storage';

/** How many hits a key may make, and over what window. */
export interface RateLimitRule {
    /** Hits allowed per window. A positive integer. */
    limit: number;
    /** The window, in milliseconds. A hit past `limit` blocks the key this long. */
    windowMs: number;
}

/** What one {@link RateLimiter.consume} decided. */
export interface RateLimitDecision {
    /** Whether this hit may proceed. */
    allowed: boolean;
    /** When refused, how long until the key may try again. `0` when allowed. */
    retryAfterMs: number;
}

/**
 * A rate limit keyed by **any string**, counted in the same `throttle_buckets`
 * table the login throttle uses — so a limit means the same thing on one
 * instance and on ten, and survives a restart.
 *
 * `ThrottlerGuard` keys by `req.ip`, which is right for an unauthenticated
 * login and wrong for anything behind a session: two colleagues behind one
 * office NAT would share a bucket, and one person on two networks would get
 * two. A caller that knows who is asking passes its own key
 * (`copilot:runs:<userId>`) and decides what a refusal looks like itself.
 *
 * A thin wrapper by design: the counting — one upsert that reads, decides and
 * writes under the row's lock — is {@link PostgresThrottlerStorage}'s, and is
 * not restated here.
 */
@Injectable()
export class RateLimiter {
    private readonly storage: PostgresThrottlerStorage;

    constructor(@InjectDatabase() db: Database) {
        this.storage = new PostgresThrottlerStorage(db);
    }

    /**
     * Counts one hit against `key` and says whether it may proceed.
     *
     * Callers namespace their keys (`<plugin>:<what>:<who>`); the guard's own
     * keys are hashes, so a namespaced key cannot collide with one.
     */
    async consume(
        key: string,
        rule: RateLimitRule
    ): Promise<RateLimitDecision> {
        const record = await this.storage.increment(
            key,
            rule.windowMs,
            rule.limit,
            rule.windowMs
        );
        if (!record.isBlocked) {
            return { allowed: true, retryAfterMs: 0 };
        }
        // Seconds from the store, rounded up there; at least one so a client
        // honouring `Retry-After` never retries in the same instant.
        return {
            allowed: false,
            retryAfterMs: Math.max(record.timeToBlockExpire, 1) * 1000
        };
    }
}
