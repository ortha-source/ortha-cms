/** Access level a bearer token grants to the external content API. */
export type ApiTokenScope = 'read' | 'full';

/** Display lifecycle of a token, derived from its expiry/revocation. */
export type ApiTokenStatus = 'active' | 'expired' | 'revoked';

/** Who minted a token, as the list names them. */
export type ApiTokenCreator = {
    id: string;
    /** Display name, or `null` when the member never set one. */
    name: string | null;
    email: string;
};

/** A token as the management table renders it (secret-free). */
export type ApiToken = {
    /** Stable token id (the revoke handle). */
    id: string;
    /** Human label. */
    name: string;
    /** Every workspace this token can read — always at least one. */
    workspaceIds: string[];
    /** Read-only or full content access. */
    scope: ApiTokenScope;
    /** Non-secret leading characters, shown so a token is recognisable. */
    lookupPrefix: string;
    /** Absolute expiry, or `null` when the token never expires. */
    expiresAt: Date | null;
    /** Last time the token authenticated a request, or `null` if never used. */
    lastUsedAt: Date | null;
    /** When the token was revoked, or `null` while live. */
    revokedAt: Date | null;
    /** When the token was minted. */
    createdAt: Date;
    /** Derived display status (`active` / `expired` / `revoked`). */
    status: ApiTokenStatus;
    /**
     * Live and expiring inside the expiring-soon window — flagged in the list
     * before it stops a build. Always `false` unless `status` is `active`.
     */
    expiringSoon: boolean;
    /** Who minted the token, or `null` when the server could not say. */
    createdBy: ApiTokenCreator | null;
};

/**
 * Per-status totals and the expiring-soon figures, over every token (not just
 * the current filter) — what the status chips and the subtitle read.
 */
export type ApiTokenSummary = {
    active: number;
    expired: number;
    revoked: number;
    /** Active tokens expiring inside the expiring-soon window. */
    expiringSoon: number;
    /** The soonest of those expiries, or `null` when none is coming up. */
    nextExpiresAt: Date | null;
};

/** The paginated list envelope. */
export type ApiTokenList = {
    items: ApiToken[];
    /** Tokens matching the current filters, across all pages. */
    total: number;
    page: number;
    pageSize: number;
    summary: ApiTokenSummary;
};

/**
 * A freshly minted token: the metadata plus the plaintext `secret`, which the
 * server returns exactly once. Held only until the reveal dialog is dismissed.
 */
export type CreatedApiToken = ApiToken & {
    /** The raw bearer token — shown once, never retrievable again. */
    secret: string;
};
