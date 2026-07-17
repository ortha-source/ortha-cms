import {
    Controller,
    NotFoundException,
    Param,
    ParseUUIDPipe,
    Post,
    UseGuards
} from '@nestjs/common';
import {
    CurrentUser,
    OriginGuard,
    PERMISSIONS,
    PermissionsGuard,
    RequirePermissions,
    type PublicUser
} from '@ortha-cms/identity-server';
import { SetWorkspaceStatusUseCase } from '../../application/use-cases/set-workspace-status.use-case';
import { WorkspaceViewQuery } from '../../infrastructure/queries/workspace-view.query';
import type { WorkspaceView } from '../../application/queries/workspace.view';
import type { WorkspaceStatusKey } from '../../domain/value-objects/workspace-status';
import { WorkspaceNotFoundError } from '../../domain/errors';

/**
 * `POST /api/workspaces/:id/archive` and `.../unarchive` — flip a workspace's
 * lifecycle status; both require `workspaces:update` (archiving is a soft state
 * change, so it isn't gated on `workspaces:delete`). Each is idempotent and
 * returns the updated view; a missing workspace maps to 404. Guarded by
 * `OriginGuard` (CSRF).
 */
@UseGuards(OriginGuard, PermissionsGuard)
@RequirePermissions(PERMISSIONS.WORKSPACES_UPDATE)
@Controller('workspaces')
export class SetWorkspaceStatusController {
    constructor(
        private readonly setStatus: SetWorkspaceStatusUseCase,
        private readonly views: WorkspaceViewQuery
    ) {}

    @Post(':id/archive')
    archive(
        @CurrentUser() actor: PublicUser,
        @Param('id', ParseUUIDPipe) id: string
    ): Promise<WorkspaceView> {
        return this.apply(actor, id, 'archived');
    }

    @Post(':id/unarchive')
    unarchive(
        @CurrentUser() actor: PublicUser,
        @Param('id', ParseUUIDPipe) id: string
    ): Promise<WorkspaceView> {
        return this.apply(actor, id, 'active');
    }

    private async apply(
        actor: PublicUser,
        id: string,
        status: WorkspaceStatusKey
    ): Promise<WorkspaceView> {
        try {
            await this.setStatus.execute(actor, id, status);
            const view = await this.views.byId(id);
            if (!view) {
                throw new NotFoundException();
            }
            return view;
        } catch (error) {
            if (error instanceof WorkspaceNotFoundError) {
                throw new NotFoundException();
            }
            throw error;
        }
    }
}
