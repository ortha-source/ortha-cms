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
import { DeleteWorkspaceUseCase } from '../../application/use-cases/delete-workspace.use-case';
import {
    WorkspaceNotEmptyError,
    WorkspaceNotFoundError
} from '../../domain/errors';

/**
 * `DELETE /api/workspaces/:id` — permanently deletes a workspace (memberships +
 * content grants cascade); requires the stronger `workspaces:delete`. Returns
 * 204; a missing workspace maps to 404, and one that still holds content entries
 * to 409 (delete them first, so nothing is orphaned). Guarded by `OriginGuard`.
 */
@UseGuards(OriginGuard, PermissionsGuard)
@RequirePermissions(PERMISSIONS.WORKSPACES_DELETE)
@Controller('workspaces')
export class DeleteWorkspaceController {
    constructor(private readonly deleteWorkspace: DeleteWorkspaceUseCase) {}

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    async remove(
        @CurrentUser() actor: PublicUser,
        @Param('id', ParseUUIDPipe) id: string
    ): Promise<void> {
        try {
            await this.deleteWorkspace.execute(actor, id);
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
