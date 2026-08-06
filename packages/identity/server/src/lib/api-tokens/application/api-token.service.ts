import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { HashingService } from '../../auth/services/hashing.service';
import type { ApiTokenScope } from '../domain/api-token-scope';
import {
    DrizzleApiTokenRepository,
    type ApiTokenRecord
} from '../infrastructure/persistence/drizzle-api-token.repository';

/** Human-readable prefix so a raw token is recognisable as an Ortha API key. */
const TOKEN_PREFIX = 'orthacms_';

/** Bytes of entropy in the secret portion of a token (256-bit). */
const TOKEN_ENTROPY_BYTES = 32;

/**
 * Characters of the raw token stored as the non-secret display prefix — the
 * literal `orthacms_` plus the first few secret chars, enough for an admin to
 * tell two tokens apart without ever seeing the secret again.
 */
const LOOKUP_PREFIX_LENGTH = TOKEN_PREFIX.length + 6;

/**
 * Only touch `last_used_at` when the recorded value is this many milliseconds
 * stale, so a burst of API calls doesn't write the row on every request.
 */
const LAST_USED_TOUCH_INTERVAL_MS = 60_000;

/** Input to {@link ApiTokenService.mint}. */
export interface MintApiTokenInput {
    name: string;
    /**
     * Every workspace the token may act in — at least one. Duplicates are
     * collapsed by {@link ApiTokenService.mint}; an empty list is rejected.
     */
    workspaceIds: readonly string[];
    scope: ApiTokenScope;
    /** Absolute expiry, or `null`/omitted for a token that never expires. */
    expiresAt?: Date | null;
    /** The user minting the token. */
    createdBy: string;
}

/** The metadata-only view of a token (never carries the secret). */
export interface ApiTokenView {
    id: string;
    name: string;
    /** Every workspace the token may act in — always at least one. */
    workspaceIds: string[];
    scope: ApiTokenScope;
    lookupPrefix: string;
    expiresAt: Date | null;
    lastUsedAt: Date | null;
    revokedAt: Date | null;
    createdAt: Date;
}

/** The mint result: the view plus the plaintext token, returned exactly once. */
export interface MintedApiToken {
    token: ApiTokenView;
    /** The raw bearer token — shown to the creator once, never persisted. */
    secret: string;
}

/**
 * Mints, verifies, lists, and revokes external-API bearer tokens.
 *
 * A token's secret is a 256-bit random string; only its SHA-256 hash is stored
 * (same primitive that backs session ids — {@link HashingService.hashToken}),
 * so a read-only DB/backup leak yields no usable tokens. The plaintext is
 * returned by {@link mint} once and never again. Verification hashes the
 * presented bearer, looks the row up by hash, and rejects revoked or expired
 * tokens — every failure mode reads as "no token" to the caller.
 */
@Injectable()
export class ApiTokenService {
    constructor(
        private readonly repo: DrizzleApiTokenRepository,
        private readonly hashing: HashingService
    ) {}

    /**
     * Generates a token, persists its hash and workspace bucket, and returns
     * the plaintext once. Duplicate workspace ids are collapsed, so the bucket
     * a caller sees back is the set it actually granted.
     */
    async mint(input: MintApiTokenInput): Promise<MintedApiToken> {
        const secret =
            TOKEN_PREFIX +
            randomBytes(TOKEN_ENTROPY_BYTES).toString('base64url');
        const row = await this.repo.insert({
            workspaceIds: [...new Set(input.workspaceIds)],
            name: input.name,
            tokenHash: this.hashing.hashToken(secret),
            lookupPrefix: secret.slice(0, LOOKUP_PREFIX_LENGTH),
            scope: input.scope,
            expiresAt: input.expiresAt ?? null,
            createdBy: input.createdBy
        });
        return { token: toView(row), secret };
    }

    /**
     * Resolves a raw bearer token to its live record — the row **plus its
     * workspace bucket**, which is what the caller scopes a request with — or
     * `null` if it is unknown, revoked, or expired. On a successful resolve it
     * also refreshes `last_used_at` (throttled, fire-and-forget) so the update
     * never blocks the request it is authenticating.
     */
    async verify(secret: string): Promise<ApiTokenRecord | null> {
        const row = await this.repo.findByHash(this.hashing.hashToken(secret));
        if (!row || row.revokedAt) {
            return null;
        }
        const now = new Date();
        if (row.expiresAt && row.expiresAt.getTime() <= now.getTime()) {
            return null;
        }
        this.maybeTouchLastUsed(row, now);
        return row;
    }

    /**
     * One page of token metadata for the management UI. `workspaceId` narrows
     * to the tokens whose bucket **contains** it — a multi-workspace token
     * shows up under each of its workspaces.
     */
    async list(options: {
        workspaceId?: string;
        page: number;
        pageSize: number;
    }): Promise<{
        items: ApiTokenView[];
        total: number;
        page: number;
        pageSize: number;
    }> {
        const { items, total } = await this.repo.list({
            workspaceId: options.workspaceId,
            limit: options.pageSize,
            offset: (options.page - 1) * options.pageSize
        });
        return {
            items: items.map(toView),
            total,
            page: options.page,
            pageSize: options.pageSize
        };
    }

    /** Revokes a token by id; `false` if it was unknown or already revoked. */
    revoke(id: string): Promise<boolean> {
        return this.repo.revoke(id);
    }

    /**
     * Refreshes `last_used_at` only when it is stale, and never awaits the
     * write — a failed touch must not fail the authenticated request.
     */
    private maybeTouchLastUsed(row: ApiTokenRecord, now: Date): void {
        const last = row.lastUsedAt?.getTime() ?? 0;
        if (now.getTime() - last < LAST_USED_TOUCH_INTERVAL_MS) {
            return;
        }
        void this.repo.touchLastUsed(row.id, now).catch(() => undefined);
    }
}

/** Projects a stored record to the secret-free view. */
function toView(row: ApiTokenRecord): ApiTokenView {
    return {
        id: row.id,
        name: row.name,
        workspaceIds: row.workspaceIds,
        scope: row.scope,
        lookupPrefix: row.lookupPrefix,
        expiresAt: row.expiresAt,
        lastUsedAt: row.lastUsedAt,
        revokedAt: row.revokedAt,
        createdAt: row.createdAt
    };
}
