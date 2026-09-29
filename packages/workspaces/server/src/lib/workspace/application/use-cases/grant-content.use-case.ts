import { Inject, Injectable } from '@nestjs/common';
import { attachActor, OutboxWriter, UnitOfWork } from '@orthacms/database';
import type { PublicUser } from '@orthacms/identity-server';
import { WorkspaceId } from '../../domain/value-objects/workspace-id';
import type { Workspace } from '../../domain/workspace';
import type { ContentGrantKind } from '../../domain/content-grant';
import {
    InvalidSharedSourceError,
    UnknownContentTypeError,
    WorkspaceNotFoundError
} from '../../domain/errors';
import {
    WORKSPACE_REPOSITORY,
    type WorkspaceRepository
} from '../../domain/workspace.repository';
import { ContentCatalogReader } from '../content/content-catalog.reader';
import {
    SHARED_CONTENT_SOURCES,
    type SharedContentSources
} from '../ports/shared-content-sources.port';

/**
 * Grants a workspace access to one content type (by slug) — its **own**
 * records, or, with a `sourceWorkspaceId`, one shared workspace's records
 * (ADR-0019, "Explicit per-source grants"). Idempotent — re-granting records
 * nothing. The kind is derived from the catalogue; an unknown slug throws
 * {@link UnknownContentTypeError} (→ 400), and a source that is not a shared,
 * active workspace other than this one holding its own grant for the slug
 * throws {@link InvalidSharedSourceError} (→ 422). Drains
 * `workspace.content_granted` (carrying the actor) on a real change, where the
 * activity subscriber turns it into the audit row. 404s an unknown workspace.
 */
@Injectable()
export class GrantContentUseCase {
    constructor(
        private readonly uow: UnitOfWork,
        private readonly outbox: OutboxWriter,
        private readonly catalog: ContentCatalogReader,
        @Inject(WORKSPACE_REPOSITORY)
        private readonly workspaces: WorkspaceRepository,
        @Inject(SHARED_CONTENT_SOURCES)
        private readonly sources: SharedContentSources
    ) {}

    /**
     * Runs the grant. Throws {@link UnknownContentTypeError} (→ 400) for an
     * unknown slug and {@link WorkspaceNotFoundError} (→ 404).
     */
    async execute(
        actor: PublicUser,
        workspaceId: string,
        slug: string,
        sourceWorkspaceId?: string
    ): Promise<void> {
        const id = WorkspaceId.create(workspaceId);
        const kind = this.catalog.resolveKind(slug);
        if (!kind) {
            throw new UnknownContentTypeError(slug);
        }

        await this.uow.run(async () => {
            const workspace = await this.workspaces.findById(id);
            if (!workspace) {
                throw new WorkspaceNotFoundError(workspaceId);
            }
            const changed = sourceWorkspaceId
                ? await this.grantShared(
                      workspace,
                      kind,
                      slug,
                      sourceWorkspaceId
                  )
                : workspace.grantContent(kind, slug);
            if (!changed) {
                return;
            }
            await this.workspaces.save(workspace);
            await this.outbox.append(
                attachActor(workspace.pullEvents(), actor)
            );
        });
    }

    /**
     * The shared-grant branch: the aggregate refuses a self-source on its own;
     * the rest of eligibility is cross-aggregate, so it is read here.
     */
    private async grantShared(
        workspace: Workspace,
        kind: ContentGrantKind,
        slug: string,
        sourceWorkspaceId: string
    ): Promise<boolean> {
        if (sourceWorkspaceId === workspace.id.value) {
            throw new InvalidSharedSourceError(sourceWorkspaceId, slug);
        }
        const offered = await this.sources.offeredKind(sourceWorkspaceId, slug);
        if (offered !== kind) {
            throw new InvalidSharedSourceError(sourceWorkspaceId, slug);
        }
        return workspace.grantSharedContent(kind, slug, sourceWorkspaceId);
    }
}
