import {
    Controller,
    Delete,
    HttpCode,
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
import { CurrentWorkspace, WorkspaceGuard } from '@ortha-cms/workspaces-server';
import { DeleteFolderUseCase } from '../../application/use-cases/delete-folder.use-case';
import { toHttp } from '../to-http';

/**
 * `DELETE /api/media/folders/:id` — delete an empty folder. A non-empty folder
 * yields `409`. Gated on `media:delete`.
 */
@UseGuards(OriginGuard, PermissionsGuard, WorkspaceGuard)
@RequirePermissions(PERMISSIONS.MEDIA_DELETE)
@Controller('media')
export class DeleteFolderController {
    constructor(private readonly deleteFolder: DeleteFolderUseCase) {}

    /** Deletes an empty folder. */
    @Delete('folders/:id')
    @HttpCode(204)
    async remove(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentWorkspace() workspaceId: string,
        @CurrentUser() user: PublicUser
    ): Promise<void> {
        try {
            await this.deleteFolder.execute(id, workspaceId, user);
        } catch (error) {
            toHttp(error);
        }
    }
}
