import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import { InjectDatabase, type Database } from '@ortha-cms/database';
import type { IdentityPluginConfig } from '../../types';
import { InjectIdentityConfig } from '../../identity.tokens';
import { sessions } from '../../schema';
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

/**
 * The query surface `create`/`revoke` accept: the root client or an open
 * transaction. Typed so the auth flows can record an audit row in the **same**
 * transaction that opens or revokes the session.
 */
export type SessionExecutor = Pick<Database, 'insert' | 'update'>;

/**
 * One live session as the admin user-detail "Sessions" tab renders it. Carries
 * only display/audit metadata — never the token or its hash beyond the opaque
 * row `id`, which the client treats as a handle for revocation.
 */
export interface UserSessionView {
    /** The session row id (SHA-256 of the token); a revocation handle. */
    id: string;
    /** Originating `User-Agent`, if captured. */
    userAgent: string | null;
    /** Originating IP, if captured. */
    ipAddress: string | null;
    /** When the session was opened. */
    createdAt: Date;
    /** Last authenticated request seen on this session. */
    lastUsedAt: Date;
    /** Absolute expiry. */
    expiresAt: Date;
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
        context: SessionContext = {},
        executor: SessionExecutor = this.db
    ): Promise<CreatedSession> {
        const token = randomBytes(32).toString('base64url');
        const expiresAt = new Date(
            Date.now() + this.config.session.ttlSeconds * 1000
        );

        await executor.insert(sessions).values({
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
     * global one. Returns the revoked session's owner so the caller can record
     * the sign-out, or `null` when nothing was revoked (unknown/already-revoked
     * token), keeping the audit trail free of phantom logout events.
     */
    async revoke(
        token: string,
        executor: SessionExecutor = this.db
    ): Promise<{ userId: string } | null> {
        const id = this.hashing.hashToken(token);
        const [revoked] = await executor
            .update(sessions)
            .set({ revokedAt: new Date() })
            .where(and(eq(sessions.id, id), isNull(sessions.revokedAt)))
            .returning({ userId: sessions.userId });
        return revoked ?? null;
    }

    /**
     * Lists a user's currently-valid sessions (not revoked, not expired),
     * most-recently-used first, for the admin "Sessions" tab. Returns display
     * metadata only — never the raw token. Expired/revoked rows are filtered so
     * the admin sees the same "live" set the user's own device list would.
     */
    async listForUser(userId: string): Promise<UserSessionView[]> {
        const now = new Date();
        return this.db
            .select({
                id: sessions.id,
                userAgent: sessions.userAgent,
                ipAddress: sessions.ipAddress,
                createdAt: sessions.createdAt,
                lastUsedAt: sessions.lastUsedAt,
                expiresAt: sessions.expiresAt
            })
            .from(sessions)
            .where(
                and(
                    eq(sessions.userId, userId),
                    isNull(sessions.revokedAt),
                    gt(sessions.expiresAt, now)
                )
            )
            .orderBy(desc(sessions.lastUsedAt));
    }

    /**
     * Revokes one of a user's sessions by its row id, idempotently. Scoped to
     * `userId` so an admin can only revoke sessions that belong to the target
     * member — a mismatched (id, userId) pair touches nothing. Returns whether
     * a live session was revoked (`false` for unknown/already-revoked/wrong
     * owner), so the caller can stay silent rather than emit a phantom event.
     */
    async revokeById(userId: string, sessionId: string): Promise<boolean> {
        const [revoked] = await this.db
            .update(sessions)
            .set({ revokedAt: new Date() })
            .where(
                and(
                    eq(sessions.id, sessionId),
                    eq(sessions.userId, userId),
                    isNull(sessions.revokedAt)
                )
            )
            .returning({ id: sessions.id });
        return revoked != null;
    }
}
