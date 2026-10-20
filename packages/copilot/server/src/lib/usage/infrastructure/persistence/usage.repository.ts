import { Injectable } from '@nestjs/common';
import { and, eq, gt, gte, sql } from 'drizzle-orm';
import { InjectDatabase, type Database } from '@orthacms/database';
import type { ModelUsage, UsageSnapshot } from '@orthacms/copilot-domain';
import { billableTokens } from '@orthacms/copilot-domain';
import { copilotUsage } from '../schema/usage';

/**
 * Namespace for the advisory locks below — the first half of the two-key
 * form, so these can never collide with another plugin's single-key lock.
 */
const USAGE_LOCK_NAMESPACE = 0x43505553; // "CPUS"

/** The run a new ledger row charges. */
export interface UsageRunKey {
    runId: string;
    userId: string;
    workspaceId: string;
}

/** Where to read a snapshot from, when admission needs one. */
export interface UsageWindow {
    /** Midnight UTC opening the day being charged. */
    dayStart: Date;
    /** A `running` row last written before this is an orphan. */
    liveSince: Date;
}

/** What {@link UsageRepository.open} did. */
export interface UsageOpenResult<R> {
    /** What was spent, when a window was given; zeros otherwise. */
    snapshot: UsageSnapshot;
    /** What `decide` refused with — the row was **not** written. */
    refusal: R | null;
}

const EMPTY_SNAPSHOT: UsageSnapshot = {
    activeRuns: 0,
    userTokensToday: 0,
    workspaceTokensToday: 0
};

/**
 * Reads and writes the copilot's spend ledger (`copilot_usage`).
 *
 * The one contended rule — "a run is admitted only if the limits it would be
 * counted against still have room" — is a count-then-write, so {@link open}
 * takes advisory locks before it reads: two runs starting at once in the same
 * workspace, or by the same person, serialise on the lock instead of both
 * reading the same spend and both being let in.
 */
@Injectable()
export class UsageRepository {
    constructor(@InjectDatabase() private readonly db: Database) {}

    /**
     * Admits a run: reads what has been spent, asks `decide`, and writes the
     * run's `running` row only if `decide` returned no refusal.
     *
     * With no `window` there is nothing to decide on, so the row is written
     * without a lock or a read — the path a deployment with no quotas takes on
     * every run.
     *
     * Locks, in this order, both transaction-scoped: the **workspace** (its
     * daily quota is shared by everyone in it) then the **user** (their
     * concurrency cap spans workspaces). Every caller takes them in the same
     * order and holds only one user lock, so two admissions cannot deadlock.
     */
    async open<R>(
        key: UsageRunKey,
        startedAt: Date,
        window: UsageWindow | null,
        decide: (snapshot: UsageSnapshot) => R | null
    ): Promise<UsageOpenResult<R>> {
        const row = {
            runId: key.runId,
            userId: key.userId,
            workspaceId: key.workspaceId,
            status: 'running' as const,
            startedAt,
            updatedAt: startedAt
        };
        if (!window) {
            await this.db.insert(copilotUsage).values(row);
            return { snapshot: EMPTY_SNAPSHOT, refusal: null };
        }

        return this.db.transaction(async (tx) => {
            await tx.execute(
                sql`select pg_advisory_xact_lock(${USAGE_LOCK_NAMESPACE}, hashtext(${'workspace:' + key.workspaceId}))`
            );
            await tx.execute(
                sql`select pg_advisory_xact_lock(${USAGE_LOCK_NAMESPACE}, hashtext(${'user:' + key.userId}))`
            );

            // `float8`, not `int`: a day's sum over a busy workspace is
            // the one figure here that could outgrow 32 bits, and `bigint`
            // would arrive from `pg` as a string.
            const [workspace] = await tx
                .select({
                    tokens: sql<number>`coalesce(sum(${copilotUsage.billableTokens}), 0)::float8`,
                    userTokens: sql<number>`coalesce(sum(${copilotUsage.billableTokens}) filter (where ${copilotUsage.userId} = ${key.userId}), 0)::float8`
                })
                .from(copilotUsage)
                .where(
                    and(
                        eq(copilotUsage.workspaceId, key.workspaceId),
                        gte(copilotUsage.startedAt, window.dayStart)
                    )
                );
            const [active] = await tx
                .select({ runs: sql<number>`count(*)::int` })
                .from(copilotUsage)
                .where(
                    and(
                        eq(copilotUsage.userId, key.userId),
                        eq(copilotUsage.status, 'running'),
                        gt(copilotUsage.updatedAt, window.liveSince)
                    )
                );

            const snapshot: UsageSnapshot = {
                activeRuns: active?.runs ?? 0,
                userTokensToday: workspace?.userTokens ?? 0,
                workspaceTokensToday: workspace?.tokens ?? 0
            };
            const refusal = decide(snapshot);
            if (refusal === null) {
                await tx.insert(copilotUsage).values(row);
            }
            return { snapshot, refusal };
        });
    }

    /**
     * Adds one model call's usage to a run's row, and names the thread and
     * backend the first time they are known.
     *
     * Additive in SQL (`col = col + $n`) rather than written from a running
     * total in memory, so the row is right however many calls report and in
     * whatever order their writes land.
     */
    async record(
        runId: string,
        usage: ModelUsage,
        at: Date,
        names: {
            conversationId?: string;
            provider?: string;
            model?: string;
        } = {}
    ): Promise<void> {
        await this.db
            .update(copilotUsage)
            .set({
                inputTokens: sql`${copilotUsage.inputTokens} + ${usage.inputTokens}`,
                outputTokens: sql`${copilotUsage.outputTokens} + ${usage.outputTokens}`,
                cacheReadTokens: sql`${copilotUsage.cacheReadTokens} + ${usage.cachedInputTokens ?? 0}`,
                cacheWriteTokens: sql`${copilotUsage.cacheWriteTokens} + ${usage.cacheWriteInputTokens ?? 0}`,
                billableTokens: sql`${copilotUsage.billableTokens} + ${billableTokens(usage)}`,
                updatedAt: at,
                ...(names.conversationId
                    ? { conversationId: names.conversationId }
                    : {}),
                ...(names.provider ? { provider: names.provider } : {}),
                ...(names.model ? { model: names.model } : {})
            })
            .where(eq(copilotUsage.runId, runId));
    }

    /** Marks a run's row finished, with why it ended. */
    async finish(runId: string, stopReason: string, at: Date): Promise<void> {
        await this.db
            .update(copilotUsage)
            .set({
                status: 'finished',
                stopReason,
                updatedAt: at,
                finishedAt: at
            })
            .where(eq(copilotUsage.runId, runId));
    }

    /**
     * What a user has spent in a workspace since `dayStart`, and what the
     * workspace has spent altogether. Two figures from one scan of the
     * workspace's rows for the day.
     */
    async spentSince(
        userId: string,
        workspaceId: string,
        dayStart: Date
    ): Promise<{ user: number; workspace: number }> {
        const [row] = await this.db
            .select({
                workspace: sql<number>`coalesce(sum(${copilotUsage.billableTokens}), 0)::float8`,
                user: sql<number>`coalesce(sum(${copilotUsage.billableTokens}) filter (where ${copilotUsage.userId} = ${userId}), 0)::float8`
            })
            .from(copilotUsage)
            .where(
                and(
                    eq(copilotUsage.workspaceId, workspaceId),
                    gte(copilotUsage.startedAt, dayStart)
                )
            );
        return { user: row?.user ?? 0, workspace: row?.workspace ?? 0 };
    }

    /** Every ledger row for a run — a test seam, reached from no route. */
    async forRun(runId: string): Promise<(typeof copilotUsage.$inferSelect)[]> {
        return this.db
            .select()
            .from(copilotUsage)
            .where(eq(copilotUsage.runId, runId));
    }
}
