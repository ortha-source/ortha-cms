import { Injectable } from '@nestjs/common';
import { and, asc, eq, isNull, ne } from 'drizzle-orm';
import { UnitOfWork } from '@orthacms/database';
import { workspaces } from '../schema/workspaces';
import { workspaceContent } from '../schema/workspace-content';
import type { ContentGrantKind } from '../../domain/content-grant';
import type {
    SharedContentSource,
    SharedContentSources
} from '../../application/ports/shared-content-sources.port';

/** A uuid, loosely — anything else can never name a workspace. */
const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Drizzle adapter for {@link SharedContentSources}: which workspaces may serve
 * a shared content grant. Reads through {@link UnitOfWork.current}, so a check
 * made inside a grant's unit of work sees the same transaction.
 *
 * No lock is taken. A source that stops being shared (or is archived) right
 * after the check leaves a grant that is simply **inert** — every read path
 * re-checks the source's state — so the race cannot widen visibility.
 */
@Injectable()
export class SharedContentSourcesQuery implements SharedContentSources {
    constructor(private readonly uow: UnitOfWork) {}

    /** {@inheritDoc SharedContentSources.list} */
    async list(
        excludingWorkspaceId: string | null
    ): Promise<SharedContentSource[]> {
        const rows = await this.uow
            .current()
            .select({
                workspaceId: workspaces.id,
                workspaceName: workspaces.name,
                slug: workspaceContent.slug,
                kind: workspaceContent.kind
            })
            .from(workspaces)
            .innerJoin(
                workspaceContent,
                and(
                    eq(workspaceContent.workspaceId, workspaces.id),
                    isNull(workspaceContent.sourceWorkspaceId)
                )
            )
            .where(
                and(
                    eq(workspaces.isShared, true),
                    eq(workspaces.status, 'active'),
                    excludingWorkspaceId
                        ? ne(workspaces.id, excludingWorkspaceId)
                        : undefined
                )
            )
            .orderBy(
                asc(workspaces.name),
                asc(workspaces.id),
                asc(workspaceContent.slug)
            );
        const bySource = new Map<string, SharedContentSource>();
        for (const row of rows) {
            let source = bySource.get(row.workspaceId);
            if (!source) {
                source = {
                    workspaceId: row.workspaceId,
                    workspaceName: row.workspaceName,
                    content: []
                };
                bySource.set(row.workspaceId, source);
            }
            source.content.push({
                slug: row.slug,
                kind: row.kind as ContentGrantKind
            });
        }
        return [...bySource.values()];
    }

    /** {@inheritDoc SharedContentSources.offeredKind} */
    async offeredKind(
        sourceWorkspaceId: string,
        slug: string
    ): Promise<ContentGrantKind | null> {
        if (!UUID_RE.test(sourceWorkspaceId)) return null;
        const [row] = await this.uow
            .current()
            .select({ kind: workspaceContent.kind })
            .from(workspaceContent)
            .innerJoin(
                workspaces,
                eq(workspaces.id, workspaceContent.workspaceId)
            )
            .where(
                and(
                    eq(workspaceContent.workspaceId, sourceWorkspaceId),
                    eq(workspaceContent.slug, slug),
                    isNull(workspaceContent.sourceWorkspaceId),
                    eq(workspaces.isShared, true),
                    eq(workspaces.status, 'active')
                )
            )
            .limit(1);
        return (row?.kind as ContentGrantKind | undefined) ?? null;
    }
}
