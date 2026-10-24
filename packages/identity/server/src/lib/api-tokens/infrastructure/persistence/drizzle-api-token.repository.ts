import { Injectable } from '@nestjs/common';
import {
    and,
    count,
    desc,
    eq,
    gt,
    ilike,
    inArray,
    isNotNull,
    isNull,
    lte,
    or,
    sql,
    type SQL
} from 'drizzle-orm';
import { UnitOfWork } from '@orthacms/database';
import { apiTokens, apiTokenWorkspaces, users } from '../../../schema';
import type { ApiTokenScope } from '../../domain/api-token-scope';
import {
    expiringSoonCutoff,
    type ApiTokenStatus
} from '../../domain/api-token-status';

/** A stored `api_tokens` row. */
export type ApiTokenRow = typeof apiTokens.$inferSelect;

/**
 * A token row plus its **workspace bucket** — the `api_token_workspaces` rows
 * joined in. Every read returns this shape: the bucket is part of a token's
 * identity (it is what the token may act on), not an optional expansion.
 */
export interface ApiTokenRecord extends ApiTokenRow {
    /** Every workspace the token may act in — always at least one. */
    workspaceIds: string[];
}

/** The fields required to insert a freshly minted token. */
export interface NewApiToken {
    /** The workspaces the token may act in — at least one, already deduped. */
    workspaceIds: readonly string[];
    name: string;
    tokenHash: string;
    lookupPrefix: string;
    scope: ApiTokenScope;
    expiresAt: Date | null;
    createdBy: string;
}

/** Filter/paginate options for the management list. */
export interface ListApiTokensOptions {
    /**
     * Restrict to tokens whose bucket **contains** this workspace; omit for
     * every token. A multi-workspace token matches each of its workspaces.
     */
    workspaceId?: string;
    /** Restrict to one derived status, measured at {@link now}. */
    status?: ApiTokenStatus;
    /**
     * Case-insensitive substring of the token's name or its non-secret
     * `lookup_prefix` (people paste the prefix they see in a log). LIKE
     * wildcards in it are matched literally.
     */
    search?: string;
    /** The instant statuses are derived at. Defaults to the current time. */
    now?: Date;
    limit: number;
    offset: number;
}

/** Filter options for {@link DrizzleApiTokenRepository.summarize}. */
export interface SummarizeApiTokensOptions {
    /** Same bucket-membership filter as the list; omit for every token. */
    workspaceId?: string;
    /** The instant statuses are derived at. Defaults to the current time. */
    now?: Date;
}

/**
 * Per-status totals for the management page's filter chips, plus the
 * "what is about to break" figures for its subtitle. Counted over the
 * workspace filter only — never the status or search — so each chip shows
 * how many tokens it would reveal.
 */
export interface ApiTokenSummary {
    active: number;
    expired: number;
    revoked: number;
    /** Active tokens whose expiry falls inside the expiring-soon window. */
    expiringSoon: number;
    /** The soonest of those expiries, or `null` when none is coming up. */
    nextExpiresAt: Date | null;
}

/** Who minted a token, as the management list names them. */
export interface ApiTokenCreator {
    id: string;
    /** Display name, or `null` when the account never set one. */
    name: string | null;
    email: string;
}

/** Escapes LIKE's metacharacters so a search term matches literally. */
function escapeLikePattern(term: string): string {
    return term.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/**
 * The SQL form of a derived status at `now` — the same rule as
 * `apiTokenStatusOf`: revocation first, then expiry.
 */
export function statusPredicate(status: ApiTokenStatus, now: Date): SQL {
    switch (status) {
        case 'revoked':
            return isNotNull(apiTokens.revokedAt);
        case 'expired':
            return and(
                isNull(apiTokens.revokedAt),
                isNotNull(apiTokens.expiresAt),
                lte(apiTokens.expiresAt, now)
            ) as SQL;
        case 'active':
            return and(
                isNull(apiTokens.revokedAt),
                or(isNull(apiTokens.expiresAt), gt(apiTokens.expiresAt, now))
            ) as SQL;
    }
}

/**
 * Drizzle-backed store for `api_tokens` and its `api_token_workspaces` bucket.
 * Only the SHA-256 hash is ever persisted; the raw token is minted and returned
 * once by {@link ApiTokenService}, never stored.
 *
 * A token and its bucket are written in **one transaction**, and every read
 * returns them together as an {@link ApiTokenRecord} — so no caller can observe
 * a token with an empty bucket (which would read as "scoped to nothing").
 *
 * Every statement runs through {@link UnitOfWork.current}, so a write joins the
 * caller's transaction when there is one and runs against the base connection
 * when there is not. `ApiTokenService` wraps mint and revoke in a unit of work
 * so the token row and its audit event commit together: a minted token that
 * failed to audit would be a credential nobody can account for. `insert` keeps
 * its own inner transaction (a savepoint when nested) so a direct caller still
 * cannot land a bucket-less token.
 */
@Injectable()
export class DrizzleApiTokenRepository {
    constructor(private readonly uow: UnitOfWork) {}

    /** Inserts a minted token and its bucket; returns the created record. */
    async insert(token: NewApiToken): Promise<ApiTokenRecord> {
        const { workspaceIds, ...columns } = token;
        return this.uow.current().transaction(async (tx) => {
            const [row] = await tx
                .insert(apiTokens)
                .values(columns)
                .returning();
            await tx.insert(apiTokenWorkspaces).values(
                workspaceIds.map((workspaceId) => ({
                    tokenId: row.id,
                    workspaceId
                }))
            );
            return { ...row, workspaceIds: [...workspaceIds] };
        });
    }

    /**
     * Looks a token up by its hash — the verification path. Returns the record
     * regardless of revoked/expired state; the service decides validity so it
     * can treat "no such token", "revoked", and "expired" identically (a flat
     * 401, no enumeration signal).
     */
    async findByHash(tokenHash: string): Promise<ApiTokenRecord | null> {
        const [row] = await this.uow
            .current()
            .select()
            .from(apiTokens)
            .where(eq(apiTokens.tokenHash, tokenHash));
        if (!row) {
            return null;
        }
        const buckets = await this.bucketsFor([row.id]);
        return { ...row, workspaceIds: buckets.get(row.id) ?? [] };
    }

    /** One token by id (with its bucket), or null. */
    async findById(id: string): Promise<ApiTokenRecord | null> {
        const [row] = await this.uow
            .current()
            .select()
            .from(apiTokens)
            .where(eq(apiTokens.id, id));
        if (!row) {
            return null;
        }
        const buckets = await this.bucketsFor([row.id]);
        return { ...row, workspaceIds: buckets.get(row.id) ?? [] };
    }

    /** One page of tokens (newest first) plus the total, sharing the filter. */
    async list(
        options: ListApiTokensOptions
    ): Promise<{ items: ApiTokenRecord[]; total: number }> {
        const now = options.now ?? new Date();
        const search = options.search?.trim();
        const where = and(
            this.workspaceFilter(options.workspaceId),
            options.status ? statusPredicate(options.status, now) : undefined,
            search
                ? or(
                      ilike(apiTokens.name, `%${escapeLikePattern(search)}%`),
                      ilike(
                          apiTokens.lookupPrefix,
                          `%${escapeLikePattern(search)}%`
                      )
                  )
                : undefined
        );
        const [[{ total }], rows] = await Promise.all([
            this.uow
                .current()
                .select({ total: count() })
                .from(apiTokens)
                .where(where),
            this.uow
                .current()
                .select()
                .from(apiTokens)
                .where(where)
                .orderBy(desc(apiTokens.createdAt))
                .limit(options.limit)
                .offset(options.offset)
        ]);
        // One batched bucket read for the whole page, never one per row.
        const buckets = await this.bucketsFor(rows.map((row) => row.id));
        return {
            items: rows.map((row) => ({
                ...row,
                workspaceIds: buckets.get(row.id) ?? []
            })),
            total
        };
    }

    /**
     * The per-status totals and the expiring-soon figures, in **one** statement
     * of filtered aggregates — so the chips and the subtitle are a single
     * consistent snapshot rather than four reads that can disagree.
     */
    async summarize(
        options: SummarizeApiTokensOptions = {}
    ): Promise<ApiTokenSummary> {
        const now = options.now ?? new Date();
        const active = statusPredicate('active', now);
        const soon = and(
            active,
            isNotNull(apiTokens.expiresAt),
            lte(apiTokens.expiresAt, expiringSoonCutoff(now))
        );
        const [row] = await this.uow
            .current()
            .select({
                active: sql<number>`count(*) filter (where ${active})`.mapWith(
                    Number
                ),
                expired:
                    sql<number>`count(*) filter (where ${statusPredicate('expired', now)})`.mapWith(
                        Number
                    ),
                revoked:
                    sql<number>`count(*) filter (where ${statusPredicate('revoked', now)})`.mapWith(
                        Number
                    ),
                expiringSoon:
                    sql<number>`count(*) filter (where ${soon})`.mapWith(
                        Number
                    ),
                nextExpiresAt:
                    sql<Date | null>`min(${apiTokens.expiresAt}) filter (where ${soon})`.mapWith(
                        apiTokens.expiresAt
                    )
            })
            .from(apiTokens)
            .where(this.workspaceFilter(options.workspaceId));
        return {
            active: row?.active ?? 0,
            expired: row?.expired ?? 0,
            revoked: row?.revoked ?? 0,
            expiringSoon: row?.expiringSoon ?? 0,
            nextExpiresAt: row?.nextExpiresAt ?? null
        };
    }

    /**
     * The minting users behind `userIds`, keyed by id — one batched read for a
     * whole page, like {@link bucketsFor}. A user with no row is simply absent
     * (`created_by` cascades, so that is not expected to happen).
     */
    async creatorsFor(
        userIds: readonly string[]
    ): Promise<Map<string, ApiTokenCreator>> {
        const creators = new Map<string, ApiTokenCreator>();
        const unique = [...new Set(userIds)];
        if (unique.length === 0) {
            return creators;
        }
        const rows = await this.uow
            .current()
            .select({ id: users.id, name: users.name, email: users.email })
            .from(users)
            .where(inArray(users.id, unique));
        for (const row of rows) {
            creators.set(row.id, row);
        }
        return creators;
    }

    /**
     * Revokes a live token by id. Idempotent — the `revoked_at IS NULL` guard
     * means a second revoke is a no-op that returns `false`.
     */
    async revoke(id: string): Promise<boolean> {
        const [row] = await this.uow
            .current()
            .update(apiTokens)
            .set({ revokedAt: new Date() })
            .where(and(eq(apiTokens.id, id), isNull(apiTokens.revokedAt)))
            .returning({ id: apiTokens.id });
        return row != null;
    }

    /** Records the last time a token authenticated a request. */
    async touchLastUsed(id: string, at: Date): Promise<void> {
        await this.uow
            .current()
            .update(apiTokens)
            .set({ lastUsedAt: at })
            .where(eq(apiTokens.id, id));
    }

    /**
     * "Covers this workspace" is a bucket-membership test, so the filter is an
     * `id IN (…)` over the join table rather than a join — a token with three
     * workspaces must still appear exactly once in the page.
     */
    private workspaceFilter(workspaceId: string | undefined): SQL | undefined {
        if (!workspaceId) {
            return undefined;
        }
        return inArray(
            apiTokens.id,
            this.uow
                .current()
                .select({ tokenId: apiTokenWorkspaces.tokenId })
                .from(apiTokenWorkspaces)
                .where(eq(apiTokenWorkspaces.workspaceId, workspaceId))
        );
    }

    /**
     * The workspace bucket of each of `tokenIds`, keyed by token id. One query
     * for the whole set, so a page of tokens costs a constant two reads.
     */
    private async bucketsFor(
        tokenIds: readonly string[]
    ): Promise<Map<string, string[]>> {
        const buckets = new Map<string, string[]>();
        if (tokenIds.length === 0) {
            return buckets;
        }
        const rows = await this.uow
            .current()
            .select()
            .from(apiTokenWorkspaces)
            .where(inArray(apiTokenWorkspaces.tokenId, [...tokenIds]));
        for (const row of rows) {
            const bucket = buckets.get(row.tokenId);
            if (bucket) {
                bucket.push(row.workspaceId);
            } else {
                buckets.set(row.tokenId, [row.workspaceId]);
            }
        }
        return buckets;
    }
}
