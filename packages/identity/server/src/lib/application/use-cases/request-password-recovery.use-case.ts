import { createHash } from 'node:crypto';
import { Injectable, Logger, type OnApplicationShutdown } from '@nestjs/common';
import {
    RateLimiter,
    type RateLimitRule
} from '../../infrastructure/throttling/rate-limiter';
import { PasswordRecoveryRegistry } from '../password-recovery.registry';

/**
 * How many recovery messages one **address** may be sent. Over it a request is
 * dropped silently: answering `429` would be keyed on the address and could be
 * correlated with it. The per-source limit (the route's `ThrottlerGuard`) is
 * the one a person ever sees; this one is what stops the form from being a way
 * to mail-bomb a colleague or burn the sending domain's reputation.
 */
export const RECOVERY_ADDRESS_LIMIT: RateLimitRule = {
    limit: 3,
    windowMs: 60 * 60 * 1000
};

/**
 * Self-service password recovery — ADR-0018 phase 2, the public half of the
 * reset flow. Of the four rules `docs/design/mail.md` sets for it, this class
 * holds two and delegates two:
 *
 * 1. **No enumeration signal — here.** {@link submit} runs the work *after* the
 *    route has answered, so status, body and timing are the same whether or
 *    not an account uses the address. Every outcome below is a silent return.
 * 2. **Rate-limited by source and by address — here.** The source limit is the
 *    route's `ThrottlerGuard` (the same per-IP bucket every public auth route
 *    has); the address limit is {@link RECOVERY_ADDRESS_LIMIT}, keyed on a
 *    digest so `throttle_buckets` holds no list of typed addresses.
 * 3. **Only an active member gets a message — the issuer.** The users plugin
 *    checks it with the same aggregate guard its admin reset uses.
 * 4. **Absent without a provider — {@link isAvailable}.** No issuer, or one
 *    with no mailer behind it, and the route answers `404`.
 */
@Injectable()
export class RequestPasswordRecoveryUseCase implements OnApplicationShutdown {
    private readonly logger = new Logger(RequestPasswordRecoveryUseCase.name);
    /** Requests accepted but not finished, so shutdown can wait for them. */
    private readonly pending = new Set<Promise<void>>();

    constructor(
        private readonly registry: PasswordRecoveryRegistry,
        private readonly limiter: RateLimiter
    ) {}

    /** Whether this deployment can send a recovery message at all. */
    get isAvailable(): boolean {
        return this.registry.current()?.available ?? false;
    }

    /**
     * Accepts a request and runs it after returning. Failures are logged,
     * never surfaced — the caller has already been told what everyone is.
     */
    submit(email: string): void {
        const run = this.execute(email)
            .catch((error: unknown) => {
                this.logger.error(
                    'A password recovery request failed',
                    error instanceof Error ? error.stack : String(error)
                );
            })
            .finally(() => {
                this.pending.delete(run);
            });
        this.pending.add(run);
    }

    /**
     * The work for one request: count it against the address, then hand it to
     * the issuer. Resolves without doing anything when recovery is unavailable
     * or the address is over its limit.
     */
    async execute(email: string): Promise<void> {
        const issuer = this.registry.current();
        if (!issuer?.available) return;

        const address = email.trim().toLowerCase();
        const decision = await this.limiter.consume(
            `identity:recovery:address:${digest(address)}`,
            RECOVERY_ADDRESS_LIMIT
        );
        if (!decision.allowed) return;

        await issuer.issue(address);
    }

    /** Settles every request accepted so far. */
    async drain(): Promise<void> {
        await Promise.allSettled([...this.pending]);
    }

    /** Waits for accepted requests, so a deploy does not drop one mid-write. */
    async onApplicationShutdown(): Promise<void> {
        await this.drain();
    }
}

/** The address as a rate-limit key, hashed. */
function digest(address: string): string {
    return createHash('sha256').update(address).digest('hex');
}
