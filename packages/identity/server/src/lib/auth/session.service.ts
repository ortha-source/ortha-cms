import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { InjectDatabase, type Database } from '@ortha-cms/database';
import type { IdentityPluginConfig } from '../types';
import { InjectIdentityConfig } from '../identity.tokens';
import { sessions } from '../schema';
import { HashingService } from './hashing.service';

/** Refresh `lastUsedAt` at most this often, so a read path isn't a write per hit. */
const LAST_USED_THROTTLE_MS = 60_000;

/** Optional client metadata captured at session creation (audit/display). */
export interface SessionContext {
    /** Originating `User-Agent`, if any. */
    userAgent?: string | null;
    /** Originating IP, if any. */
    ipAddress?: string | null;
}

/** A freshly created session: the opaque token for the client and its expiry. */
export interface CreatedSession {
    /**
     * Opaque random token handed to the client (the cookie value). Only its
     * **hash** is persisted, so this value never appears in the database.
     */
    token: string;
    /** Absolute expiry, derived from the configured TTL. */
    expiresAt: Date;
}

/**
 * Owns the lifecycle of server-side, revocable sessions (FR-4). A session is a
 * DB row whose primary key is the **SHA-256 of** a high-entropy random token;
 * the raw token is the only secret handed to the client and is never stored, so
 * a read-only DB/backup leak yields no usable tokens. Validity is decided per
 * request by the row's `revokedAt`/`expiresAt`, not by anything in the cookie —
 * so the cookie needs no signing.
 */
@Injectable()
export class SessionService {
    constructor(
        @InjectDatabase() private readonly db: Database,
        @InjectIdentityConfig() private readonly config: IdentityPluginConfig,
        private readonly hashing: HashingService
    ) {}

    /**
     * Opens a session for a user. The token is 256 bits of CSPRNG output
     * encoded base64url — application-generated, never derived from user data;
     * only its hash is written. Expiry is `now + ttlSeconds` from config.
     */
    async create(
        userId: string,
        context: SessionContext = {}
    ): Promise<CreatedSession> {
        const token = randomBytes(32).toString('base64url');
        const expiresAt = new Date(
            Date.now() + this.config.session.ttlSeconds * 1000
        );

        await this.db.insert(sessions).values({
            id: this.hashing.hashToken(token),
            userId,
            expiresAt,
            userAgent: context.userAgent ?? null,
            ipAddress: context.ipAddress ?? null
        });

        return { token, expiresAt };
    }

    /**
     * Resolves an opaque session token to its owner, or `null` when the session
     * is unknown, revoked, or past its expiry. Refreshes `lastUsedAt` on a hit,
     * but at most once per {@link LAST_USED_THROTTLE_MS} so an authenticated GET
     * doesn't issue a write on every request.
     */
    async findValid(token: string): Promise<{ userId: string } | null> {
        const id = this.hashing.hashToken(token);
        const now = new Date();
        const [session] = await this.db
            .select({
                userId: sessions.userId,
                lastUsedAt: sessions.lastUsedAt
            })
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

        if (
            now.getTime() - session.lastUsedAt.getTime() >
            LAST_USED_THROTTLE_MS
        ) {
            await this.db
                .update(sessions)
                .set({ lastUsedAt: now })
                .where(eq(sessions.id, id));
        }

        return { userId: session.userId };
    }

    /**
     * Revokes a single session by its opaque token, idempotently — an unknown
     * or already-revoked token is a no-op (the `revokedAt IS NULL` guard keeps
     * the original revoke time). Only the matching row is touched, so the
     * user's other sessions stay valid: this is a per-device logout, not a
     * global one.
     */
    async revoke(token: string): Promise<void> {
        const id = this.hashing.hashToken(token);
        await this.db
            .update(sessions)
            .set({ revokedAt: new Date() })
            .where(and(eq(sessions.id, id), isNull(sessions.revokedAt)));
    }
}
