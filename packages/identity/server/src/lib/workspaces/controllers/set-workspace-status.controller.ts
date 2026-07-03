import {
    Controller,
    NotFoundException,
    Param,
    ParseUUIDPipe,
    Post,
    UseGuards
} from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { PublicUser } from '../../auth/services/auth.service';
import { OriginGuard } from '../../auth/guards/origin.guard';
import { PermissionsGuard } from '../../rbac/guards/permissions.guard';
import { RequirePermissions } from '../../rbac/decorators/require-permissions.decorator';
import { PERMISSIONS } from '../../rbac/system-roles';
import {
    WorkspaceService,
    type WorkspaceView
} from '../services/workspace.service';
import { WorkspaceNotFoundError } from '../errors';

/**
 * `POST /api/workspaces/:id/archive` and `.../unarchive` — flip a workspace's
 * lifecycle status; both require `workspaces:update`. Archiving is a soft state
 * change (nothing is deleted), so it sits under `workspaces:update`, not
 * `workspaces:delete`. Each is idempotent (setting the status it already has is
 * a no-op) and returns the updated view; a missing workspace maps to 404.
 * Guarded by `OriginGuard` (CSRF) like the other state-changing POSTs.
 */
@UseGuards(OriginGuard, PermissionsGuard)
@RequirePermissions(PERMISSIONS.WORKSPACES_UPDATE)
@Controller('workspaces')
export class SetWorkspaceStatusController {
    constructor(private readonly workspaces: WorkspaceService) {}

    @Post(':id/archive')
    archive(
        @CurrentUser() actor: PublicUser,
        @Param('id', ParseUUIDPipe) id: string
    ): Promise<WorkspaceView> {
        return this.setStatus(actor, id, 'archived');
    }

    @Post(':id/unarchive')
    unarchive(
        @CurrentUser() actor: PublicUser,
        @Param('id', ParseUUIDPipe) id: string
    ): Promise<WorkspaceView> {
        return this.setStatus(actor, id, 'active');
    }

    private async setStatus(
        actor: PublicUser,
        id: string,
        status: 'active' | 'archived'
    ): Promise<WorkspaceView> {
        try {
            return await this.workspaces.setStatus(actor, id, status);
        } catch (error) {
            if (error instanceof WorkspaceNotFoundError) {
                throw new NotFoundException();
            }
            throw error;
        }
    }
}
