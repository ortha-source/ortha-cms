/** A live session as the user-detail Sessions tab renders it. */
export type UserSession = {
    /** Revocation handle (the session row id). */
    id: string;
    /** Originating `User-Agent`, or `null` if it was never captured. */
    userAgent: string | null;
    /** Originating IP, or `null` if it was never captured. */
    ipAddress: string | null;
    /** When the session was opened. */
    createdAt: Date;
    /** Last authenticated request seen on this session. */
    lastSeenAt: Date;
    /** Absolute expiry. */
    expiresAt: Date;
    /** Whether this is the viewer's own session (never revocable from here). */
    current: boolean;
};
