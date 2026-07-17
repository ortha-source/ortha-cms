import {
    ConflictException,
    Controller,
    Delete,
    HttpCode,
    HttpStatus,
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
import { WorkspaceService } from '../services/workspace.service';
import { WorkspaceNotEmptyError, WorkspaceNotFoundError } from '../errors';

/**
 * `DELETE /api/workspaces/:id` — permanently deletes a workspace (memberships +
 * content grants cascade); requires the stronger `workspaces:delete`. Returns
 * 204; a missing workspace maps to 404, and a workspace that still holds content
 * entries maps to 409 (delete them first, so nothing is orphaned). Guarded by
 * `OriginGuard` (CSRF) like the other state-changing routes.
 */
@UseGuards(OriginGuard, PermissionsGuard)
@RequirePermissions(PERMISSIONS.WORKSPACES_DELETE)
@Controller('workspaces')
export class DeleteWorkspaceController {
    constructor(private readonly workspaces: WorkspaceService) {}

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    async remove(
        @CurrentUser() actor: PublicUser,
        @Param('id', ParseUUIDPipe) id: string
    ): Promise<void> {
        try {
            await this.workspaces.delete(actor, id);
        } catch (error) {
            if (error instanceof WorkspaceNotFoundError) {
                throw new NotFoundException();
            }
            if (error instanceof WorkspaceNotEmptyError) {
                throw new ConflictException(
                    'Workspace still has content entries'
                );
            }
            throw error;
        }
    }
}
