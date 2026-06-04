import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { InjectDatabase, type Database } from '@ortha-cms/database';
import type { IdentityPluginConfig } from '../types';
import { InjectIdentityConfig } from '../identity.tokens';
import { sessions } from '../schema';

/** Optional client metadata captured at session creation (audit/display). */
export interface SessionContext {
    /** Originating `User-Agent`, if any. */
    userAgent?: string | null;
    /** Originating IP, if any. */
    ipAddress?: string | null;
}

/** A freshly created session: the opaque cookie value and its absolute expiry. */
export interface CreatedSession {
    /** Opaque random token — both the cookie value and the row's primary key. */
    id: string;
    /** Absolute expiry, derived from the configured TTL. */
    expiresAt: Date;
}

/**
 * Owns the lifecycle of server-side, revocable sessions (FR-4). A session is
 * a DB row keyed by a high-entropy random token; that token is the only
 * secret handed to the client. Validity is decided per request by the row's
 * `revokedAt`/`expiresAt`, not by anything carried in the cookie — so the
 * cookie needs no signing.
 */
@Injectable()
export class SessionService {
    constructor(
        @InjectDatabase() private readonly db: Database,
        @InjectIdentityConfig() private readonly config: IdentityPluginConfig
    ) {}

    /**
     * Opens a session for a user. The id is 256 bits of CSPRNG output encoded
     * base64url — application-generated, never derived from user data — and
     * expiry is `now + ttlSeconds` from config (no hardcoded lifetime).
     */
    async create(
        userId: string,
        context: SessionContext = {}
    ): Promise<CreatedSession> {
        const id = randomBytes(32).toString('base64url');
        const expiresAt = new Date(
            Date.now() + this.config.session.ttlSeconds * 1000
        );

        await this.db.insert(sessions).values({
            id,
            userId,
            expiresAt,
            userAgent: context.userAgent ?? null,
            ipAddress: context.ipAddress ?? null
        });

        return { id, expiresAt };
    }

    /**
     * Resolves an opaque session id to its owner, or `null` when the session
     * is unknown, revoked, or past its expiry. On a hit, refreshes
     * `lastUsedAt` so idle sessions are distinguishable from active ones.
     */
    async findValid(id: string): Promise<{ userId: string } | null> {
        const now = new Date();
        const [session] = await this.db
            .select({ userId: sessions.userId })
            .from(sessions)
            .where(
                and(
                    eq(sessions.id, id),
                    isNull(sessions.revokedAt),
                    gt(sessions.expiresAt, now)
                )
            );

        if (!session) {
            return null;
        }

        await this.db
            .update(sessions)
            .set({ lastUsedAt: now })
            .where(eq(sessions.id, id));

        return session;
    }
}
