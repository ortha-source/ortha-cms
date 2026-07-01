import {
    Controller,
    Delete,
    HttpCode,
    HttpStatus,
    NotFoundException,
    Param,
    ParseUUIDPipe,
    UseGuards
} from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { PublicUser } from '../../auth/services/auth.service';
import { OriginGuard } from '../../auth/guards/origin.guard';
import { PermissionsGuard } from '../../rbac/guards/permissions.guard';
import { RequirePermissions } from '../../rbac/decorators/require-permissions.decorator';
import { PERMISSIONS } from '../../rbac/system-roles';
import { WorkspaceService } from '../services/workspace.service';
import { WorkspaceNotFoundError } from '../errors';

/**
 * `DELETE /api/workspaces/:id` — permanently deletes a workspace (memberships +
 * content grants cascade); requires the stronger `workspaces:delete`. Returns
 * 204; a missing workspace maps to 404. Guarded by `OriginGuard` (CSRF) like the
 * other state-changing routes.
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
            throw error;
        }
    }
}
