import { Inject, Injectable } from '@nestjs/common';
import { SessionPolicy } from '../../domain/session-policy';
import {
    SESSION_REPOSITORY,
    type SessionRepository
} from '../../domain/session.repository';

/**
 * Resolves an opaque session token to its owner on the authenticated-request
 * hot path, refreshing `lastUsedAt` at most once per throttle window (the
 * {@link SessionPolicy} decides). Deliberately **not** wrapped in a unit of work:
 * the read is per request and the occasional write is a single throttled update,
 * exactly as the session read path behaved before — opening a transaction per
 * request would be a regression.
 */
@Injectable()
export class RefreshSessionUseCase {
    constructor(
        private readonly policy: SessionPolicy,
        @Inject(SESSION_REPOSITORY)
        private readonly sessions: SessionRepository
    ) {}

    /**
     * Returns the resolving session's owner id, or `null` when the token is
     * unknown, revoked, or expired. Touches `lastUsedAt` when the throttle
     * window has elapsed.
     */
    async execute(token: string): Promise<{ userId: string } | null> {
        const resolved = await this.sessions.resolveActive(token);
        if (!resolved) {
            return null;
        }

        const now = new Date();
        if (this.policy.shouldRefreshLastUsed(resolved.lastUsedAt, now)) {
            await this.sessions.touchLastUsed(token, now);
        }

        return { userId: resolved.userId };
    }
}
