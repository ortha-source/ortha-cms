/** Optional client metadata captured at session creation (audit/display). */
export interface SessionContext {
    /** Originating `User-Agent`, if any. */
    userAgent?: string | null;
    /** Originating IP, if any. */
    ipAddress?: string | null;
}

/** State the repository hands {@link Session.rehydrate} to reconstruct one. */
export interface SessionState {
    userId: string;
    expiresAt: Date;
    revokedAt: Date | null;
    lastUsedAt: Date;
}

/**
 * A server-side, revocable session as a domain entity — the rules a raw
 * `sessions` row cannot express. It carries no secret: the opaque token and its
 * hash are the infrastructure adapter's concern (`SessionRepository`), so this
 * entity models only validity and refresh timing, decided against a
 * {@link SessionPolicy}.
 *
 * Framework-free — used by the auth use-cases and unit-tested without a DB.
 */
export class Session {
    private constructor(
        private readonly _userId: string,
        private readonly _expiresAt: Date,
        private readonly _revokedAt: Date | null,
        private readonly _lastUsedAt: Date
    ) {}

    /** Reconstructs a session from a persisted {@link SessionState}. */
    static rehydrate(state: SessionState): Session {
        return new Session(
            state.userId,
            state.expiresAt,
            state.revokedAt,
            state.lastUsedAt
        );
    }

    /** The session owner's id. */
    get userId(): string {
        return this._userId;
    }

    /** Absolute expiry. */
    get expiresAt(): Date {
        return this._expiresAt;
    }

    /** When the session was last used. */
    get lastUsedAt(): Date {
        return this._lastUsedAt;
    }

    /** Whether the session has been revoked. */
    get isRevoked(): boolean {
        return this._revokedAt !== null;
    }

    /**
     * Whether the session is usable at `now`: neither revoked nor past its
     * expiry. Mirrors the `revoked_at IS NULL AND expires_at > now` predicate
     * the adapter enforces in SQL, expressed as a domain rule.
     */
    isActiveAt(now: Date): boolean {
        return !this.isRevoked && this._expiresAt.getTime() > now.getTime();
    }
}
