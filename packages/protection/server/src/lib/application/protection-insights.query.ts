import { Injectable } from '@nestjs/common';
import { and, asc, count, eq, isNull, lt, sql } from 'drizzle-orm';
import { InjectDatabase, type Database } from '@orthacms/database';
import {
    EntryWriterService,
    InjectContentRegistry,
    entryTitle,
    type ContentTypeRegistry
} from '@orthacms/content-server';
import { reviewRequests } from '../infrastructure/schema/review-requests';
import type {
    ProtectionInsightsOldestView,
    ProtectionInsightsView
} from '../types/protection-views';
import { OVERDUE_AFTER_DAYS } from './overdue';

export { OVERDUE_AFTER_DAYS };

/** One day, in milliseconds. */
const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days between `since` and `now`, never negative. */
export function waitingDays(since: Date, now: Date = new Date()): number {
    return Math.max(0, Math.floor((now.getTime() - since.getTime()) / DAY_MS));
}

/**
 * The Insights figures: how much review is outstanding, how much of it has been
 * outstanding too long, and which request has waited longest.
 *
 * **One aggregate, not two.** The overdue set is a subset of the open set, so a
 * `filter` aggregate decides both from the same scan — the same reason content's
 * `unshipped` reads its three counts out of one grouped query rather than three
 * `countOf` calls. The oldest request is one more indexed single-row read.
 *
 * **No `?days=` window**, deliberately, and for the reason content's `unshipped`
 * takes none: a request that has been waiting a fortnight is waiting whether it
 * was asked this morning or last spring. Windowing it would answer a different
 * question under the same name, and a dashboard figure is believed.
 *
 * The threshold travels **with** the numbers rather than being restated in the
 * admin, so the line's caption cannot come to say "3 days" over a figure
 * counted against something else.
 */
@Injectable()
export class ProtectionInsightsQuery {
    constructor(
        @InjectDatabase() private readonly db: Database,
        private readonly entries: EntryWriterService,
        @InjectContentRegistry()
        private readonly registry: ContentTypeRegistry
    ) {}

    /** Open and overdue review requests in one workspace. */
    async summary(workspaceId: string): Promise<ProtectionInsightsView> {
        const now = new Date();
        const cutoff = new Date(now.getTime() - OVERDUE_AFTER_DAYS * DAY_MS);
        const open = and(
            eq(reviewRequests.workspaceId, workspaceId),
            isNull(reviewRequests.resolvedAt)
        );
        const [row] = await this.db
            .select({
                open: count(),
                overdue: sql<number>`count(*) filter (where ${lt(
                    reviewRequests.createdAt,
                    cutoff
                )})::int`
            })
            .from(reviewRequests)
            .where(open);

        const [oldest] = await this.db
            .select({
                contentType: reviewRequests.contentType,
                entryId: reviewRequests.entryId,
                createdAt: reviewRequests.createdAt
            })
            .from(reviewRequests)
            .where(open)
            .orderBy(asc(reviewRequests.createdAt))
            .limit(1);

        return {
            open: Number(row?.open ?? 0),
            overdue: Number(row?.overdue ?? 0),
            overdueAfterDays: OVERDUE_AFTER_DAYS,
            oldestOpen: oldest
                ? await this.describe(oldest, workspaceId, now)
                : null
        };
    }

    /** Names the oldest request: its type, its entry's title, its age. */
    private async describe(
        request: { contentType: string; entryId: string; createdAt: Date },
        workspaceId: string,
        now: Date
    ): Promise<ProtectionInsightsOldestView> {
        const type = this.registry.get(request.contentType);
        let title: string | null = null;
        if (type) {
            try {
                const record = await this.entries.getOne(
                    type,
                    request.entryId,
                    workspaceId
                );
                const found = entryTitle(type, {
                    ...record.values,
                    id: request.entryId
                });
                title = found === request.entryId ? null : found;
            } catch {
                // An entry that has gone still has an open request — the line
                // names it by its type rather than failing the whole card.
                title = null;
            }
        }
        return {
            contentType: request.contentType,
            contentTypeLabel: type?.label ?? request.contentType,
            entryId: request.entryId,
            entryTitle: title,
            waitingDays: waitingDays(request.createdAt, now)
        };
    }
}
