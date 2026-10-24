import { Injectable } from '@nestjs/common';
import { and, countDistinct, eq, exists, isNull, ne, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { InjectDatabase, type Database } from '@orthacms/database';
import { workspaces } from '../schema/workspaces';
import { memberships } from '../schema/memberships';
import { workspaceContent } from '../schema/workspace-content';
import { ContentEntryCounterReader } from '../../application/content/content-entry-counter.reader';
import type { WorkspaceArchiveImpactView } from '../../application/queries/workspace.view';

/**
 * Read model behind `GET /workspaces/:id/archive-impact`: what archiving a
 * workspace would touch, counted before the confirmation's button.
 *
 * Archiving deletes nothing and gates nothing on the workspace's own routes
 * (the dossier's "archiving is an interface state"), so the only parties who
 * notice are the consumers of its **shared** records — a shared grant is live
 * only while its source is active (ADR-0019, workspaces I-36). That is the
 * third number; the other two say what stays.
 *
 * **Unscoped by itself**, like `WorkspaceViewQuery.byId`: the one caller sits
 * behind `WorkspaceMemberGuard`. The consumer count names no workspace — the
 * archiving member learns how many links exist, never whose.
 */
@Injectable()
export class ArchiveImpactQuery {
    constructor(
        @InjectDatabase() private readonly db: Database,
        private readonly counter: ContentEntryCounterReader
    ) {}

    /** The impact of archiving `workspaceId`. */
    async forWorkspace(
        workspaceId: string
    ): Promise<WorkspaceArchiveImpactView> {
        const [records, members, linkedWorkspaces] = await Promise.all([
            this.counter.countWorkspaceEntries(workspaceId),
            this.countMembers(workspaceId),
            this.countLiveConsumers(workspaceId)
        ]);
        return { records, members, linkedWorkspaces };
    }

    /** Every membership of the workspace. */
    private async countMembers(workspaceId: string): Promise<number> {
        const [row] = await this.db
            .select({ total: sql<number>`count(*)::int` })
            .from(memberships)
            .where(eq(memberships.workspaceId, workspaceId));
        return row?.total ?? 0;
    }

    /**
     * Other workspaces holding at least one **live** shared grant naming this
     * one: the source is shared and active, and still holds its own grant for
     * the slug — the same `available` rule `WorkspaceViewQuery` reports. A
     * grant that is already inert loses nothing on archive, so it is not
     * counted.
     */
    private async countLiveConsumers(workspaceId: string): Promise<number> {
        const source = alias(workspaces, 'source');
        const sourceGrant = alias(workspaceContent, 'source_grant');
        const [row] = await this.db
            .select({ total: countDistinct(workspaceContent.workspaceId) })
            .from(workspaceContent)
            .innerJoin(
                source,
                eq(source.id, workspaceContent.sourceWorkspaceId)
            )
            .where(
                and(
                    eq(workspaceContent.sourceWorkspaceId, workspaceId),
                    ne(workspaceContent.workspaceId, workspaceId),
                    eq(source.isShared, true),
                    eq(source.status, 'active'),
                    exists(
                        this.db
                            .select({ one: sql`1` })
                            .from(sourceGrant)
                            .where(
                                and(
                                    eq(sourceGrant.workspaceId, source.id),
                                    eq(sourceGrant.slug, workspaceContent.slug),
                                    isNull(sourceGrant.sourceWorkspaceId)
                                )
                            )
                    )
                )
            );
        return Number(row?.total ?? 0);
    }
}
