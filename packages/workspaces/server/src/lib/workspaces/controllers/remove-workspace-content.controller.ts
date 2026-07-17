import {
    ConflictException,
    Controller,
    Delete,
    NotFoundException,
    Param,
    ParseUUIDPipe,
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
import {
    WorkspaceService,
    type WorkspaceView
} from '../services/workspace.service';
import { ContentTypeNotEmptyError, WorkspaceNotFoundError } from '../errors';

/**
 * `DELETE /api/workspaces/:id/content/:slug` — revokes a workspace's access to a
 * content type; requires `workspaces:update`. Refuses (409) when the type still
 * holds entries in the workspace, so a revoke never orphans reachable records.
 * Revoking a grant the workspace never held is a no-op. Returns the updated
 * view; a missing workspace maps to 404. Guarded by `OriginGuard` (CSRF).
 */
@UseGuards(OriginGuard, PermissionsGuard)
@RequirePermissions(PERMISSIONS.WORKSPACES_UPDATE)
@Controller('workspaces')
export class RemoveWorkspaceContentController {
    constructor(private readonly workspaces: WorkspaceService) {}

    @Delete(':id/content/:slug')
    async remove(
        @CurrentUser() actor: PublicUser,
        @Param('id', ParseUUIDPipe) id: string,
        @Param('slug') slug: string
    ): Promise<WorkspaceView> {
        try {
            return await this.workspaces.revokeContent(actor, id, slug);
        } catch (error) {
            if (error instanceof WorkspaceNotFoundError) {
                throw new NotFoundException();
            }
            if (error instanceof ContentTypeNotEmptyError) {
                throw new ConflictException(
                    'Content type still has entries in this workspace'
                );
            }
            throw error;
        }
    }
}
