import { Injectable } from '@nestjs/common';
import { and, count, desc, eq, isNull } from 'drizzle-orm';
import { InjectDatabase, type Database } from '@ortha-cms/database';
import { apiTokens } from '../../../schema';
import type { ApiTokenScope } from '../../domain/api-token-scope';

/** A stored `api_tokens` row. */
export type ApiTokenRow = typeof apiTokens.$inferSelect;

/** The fields required to insert a freshly minted token. */
export interface NewApiToken {
    workspaceId: string;
    name: string;
    tokenHash: string;
    lookupPrefix: string;
    scope: ApiTokenScope;
    expiresAt: Date | null;
    createdBy: string;
}

/** Filter/paginate options for the management list. */
export interface ListApiTokensOptions {
    /** Restrict to a single workspace's tokens; omit for all workspaces. */
    workspaceId?: string;
    limit: number;
    offset: number;
}

/**
 * Drizzle-backed store for `api_tokens`. Runs against the base connection
 * (`@InjectDatabase()`), not the request unit of work — minting and revoking a
 * token are standalone writes, not part of another aggregate's transaction.
 * Only the SHA-256 hash is ever persisted; the raw token is minted and returned
 * once by {@link ApiTokenService}, never stored.
 */
@Injectable()
export class DrizzleApiTokenRepository {
    constructor(@InjectDatabase() private readonly db: Database) {}

    /** Inserts a minted token; returns the created row. */
    async insert(token: NewApiToken): Promise<ApiTokenRow> {
        const [row] = await this.db
            .insert(apiTokens)
            .values(token)
            .returning();
        return row;
    }

    /**
     * Looks a token up by its hash — the verification path. Returns the row
     * regardless of revoked/expired state; the service decides validity so it
     * can treat "no such token", "revoked", and "expired" identically (a flat
     * 401, no enumeration signal).
     */
    async findByHash(tokenHash: string): Promise<ApiTokenRow | null> {
        const [row] = await this.db
            .select()
            .from(apiTokens)
            .where(eq(apiTokens.tokenHash, tokenHash));
        return row ?? null;
    }

    /** One token by id, or null. */
    async findById(id: string): Promise<ApiTokenRow | null> {
        const [row] = await this.db
            .select()
            .from(apiTokens)
            .where(eq(apiTokens.id, id));
        return row ?? null;
    }

    /** One page of tokens (newest first) plus the total, sharing the filter. */
    async list(
        options: ListApiTokensOptions
    ): Promise<{ items: ApiTokenRow[]; total: number }> {
        const where = options.workspaceId
            ? eq(apiTokens.workspaceId, options.workspaceId)
            : undefined;
        const [[{ total }], items] = await Promise.all([
            this.db
                .select({ total: count() })
                .from(apiTokens)
                .where(where),
            this.db
                .select()
                .from(apiTokens)
                .where(where)
                .orderBy(desc(apiTokens.createdAt))
                .limit(options.limit)
                .offset(options.offset)
        ]);
        return { items, total };
    }

    /**
     * Revokes a live token by id. Idempotent — the `revoked_at IS NULL` guard
     * means a second revoke is a no-op that returns `false`.
     */
    async revoke(id: string): Promise<boolean> {
        const [row] = await this.db
            .update(apiTokens)
            .set({ revokedAt: new Date() })
            .where(and(eq(apiTokens.id, id), isNull(apiTokens.revokedAt)))
            .returning({ id: apiTokens.id });
        return row != null;
    }

    /** Records the last time a token authenticated a request. */
    async touchLastUsed(id: string, at: Date): Promise<void> {
        await this.db
            .update(apiTokens)
            .set({ lastUsedAt: at })
            .where(eq(apiTokens.id, id));
    }
}
