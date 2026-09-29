import { Inject, Injectable, Optional } from '@nestjs/common';
import { and, eq, exists, isNull, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { InjectDatabase, type Database } from '@orthacms/database';
import {
    CONTENT_CATALOG,
    workspaceContent,
    workspaces,
    type ContentCatalog
} from '@orthacms/workspaces-server';

/**
 * The content-type summaries the system prompt is built from — `name — label
 * (kind)` for each type the open workspace was actually granted.
 *
 * Two deliberate choices about where this reads from:
 *
 * - **The catalogue comes through `CONTENT_CATALOG`, not `content-server`.**
 *   That port already exists for exactly this shape of question, and it is
 *   owned by `workspaces-server`, which this package already depends on for
 *   `WorkspaceGuard`. Importing `content-server` here would put the copilot at
 *   the bottom of the package graph, which `docs/design/copilot.md` §4 rules
 *   out. Injected `@Optional()`: a deployment with no content plugin gets an
 *   empty list and a copilot that says so, rather than a boot failure.
 * - **The grants come from `workspace_content` directly**, mirroring
 *   `content-server`'s own `WorkspaceGrantsQuery`. That table is workspaces-
 *   owned and its schema is deliberately re-exported; inverting it into another
 *   port would mean workspaces depending on copilot.
 *
 * Scoping to grants matters: the prompt must not name a type the workspace
 * cannot reach, or the model will confidently offer to search something every
 * tool call will then refuse. "Reach" follows ADR-0019's explicit per-source
 * grants: an own grant, or a shared grant whose source is still shared,
 * active and holding the type — an inert shared grant names nothing. A type
 * reached only through shared grants is marked as such, because every write
 * tool will refuse it.
 */
@Injectable()
export class ContentTypeSummaryService {
    constructor(
        @InjectDatabase() private readonly db: Database,
        @Optional()
        @Inject(CONTENT_CATALOG)
        private readonly catalogue: ContentCatalog | null = null
    ) {}

    /** Summaries for the types `workspaceId` was granted, in catalogue order. */
    async summaries(workspaceId: string): Promise<string[]> {
        if (!this.catalogue) {
            return [];
        }

        const source = alias(workspaces, 'grant_source');
        const sourceOwn = alias(workspaceContent, 'source_own_grant');
        const rows = await this.db
            .select({
                slug: workspaceContent.slug,
                sourceWorkspaceId: workspaceContent.sourceWorkspaceId
            })
            .from(workspaceContent)
            .leftJoin(source, eq(source.id, workspaceContent.sourceWorkspaceId))
            .where(
                and(
                    eq(workspaceContent.workspaceId, workspaceId),
                    or(
                        isNull(workspaceContent.sourceWorkspaceId),
                        and(
                            eq(source.isShared, true),
                            eq(source.status, 'active'),
                            exists(
                                this.db
                                    .select({ one: sql`1` })
                                    .from(sourceOwn)
                                    .where(
                                        and(
                                            eq(
                                                sourceOwn.workspaceId,
                                                source.id
                                            ),
                                            eq(
                                                sourceOwn.slug,
                                                workspaceContent.slug
                                            ),
                                            isNull(sourceOwn.sourceWorkspaceId)
                                        )
                                    )
                            )
                        )
                    )
                )
            );
        const granted = new Set(rows.map((row) => row.slug));
        const owned = new Set(
            rows
                .filter((row) => row.sourceWorkspaceId === null)
                .map((row) => row.slug)
        );

        // An empty grant set means "no access", never "no filtering" — the
        // same rule WorkspaceGrantsQuery documents. Getting this backwards
        // would describe every type in the deployment to every workspace.
        return this.catalogue
            .list()
            .filter((type) => granted.has(type.name))
            .map(
                (type) =>
                    `${type.name} — ${type.label ?? type.name} (${type.kind})` +
                    (owned.has(type.name)
                        ? ''
                        : ' — shared records only: link them, never create')
            );
    }
}
