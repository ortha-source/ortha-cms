/** Access level a bearer token grants to the external content API. */
export type ApiTokenScope = 'read' | 'full';

/** Display lifecycle of a token, derived from its expiry/revocation. */
export type ApiTokenStatus = 'active' | 'expired' | 'revoked';

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
};

/** The paginated list envelope. */
export type ApiTokenList = {
    items: ApiToken[];
    total: number;
    page: number;
    pageSize: number;
};

/**
 * A freshly minted token: the metadata plus the plaintext `secret`, which the
 * server returns exactly once. Held only until the reveal dialog is dismissed.
 */
export type CreatedApiToken = ApiToken & {
    /** The raw bearer token — shown once, never retrievable again. */
    secret: string;
};
