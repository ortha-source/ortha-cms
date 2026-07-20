import { Injectable } from '@nestjs/common';
import { Workspace } from '../../domain/workspace';
import type { ContentGrantKind } from '../../domain/content-grant';
import type { workspaces } from '../schema/workspaces';

/** A `workspaces` row as selected from the database. */
export type WorkspaceRow = typeof workspaces.$inferSelect;

/**
 * Translates between the persisted `workspaces` / `memberships` /
 * `workspace_content` rows and the {@link Workspace} aggregate. Keeps the row
 * shape out of the domain and the aggregate out of the repository's query code.
 */
@Injectable()
export class WorkspaceMapper {
    /**
     * Rebuilds the aggregate from a workspace row plus its member user ids and
     * content grants. A null `description` becomes the empty string (the domain
     * models it as always-present text).
     */
    toDomain(
        row: WorkspaceRow,
        memberUserIds: string[],
        grants: { kind: ContentGrantKind; slug: string }[]
    ): Workspace {
        return Workspace.rehydrate({
            id: row.id,
            name: row.name,
            slug: row.slug,
            description: row.description ?? '',
            color: row.color,
            status: row.status,
            memberUserIds,
            grants
        });
    }

    /** The `workspaces` insert row for a brand-new aggregate. */
    toInsertRow(workspace: Workspace): typeof workspaces.$inferInsert {
        return {
            id: workspace.id.value,
            name: workspace.name,
            slug: workspace.slug.value,
            description: workspace.description,
            color: workspace.color.value,
            status: workspace.status.value
        };
    }
}
