import {
    Controller,
    Delete,
    HttpCode,
    HttpStatus,
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

/**
 * `DELETE /api/workspaces/:id/members/:userId` — removes a user's membership;
 * requires `workspaces:update`. Removing a non-member is a no-op (still 204).
 * Guarded by `OriginGuard` (CSRF) like the other state-changing routes.
 */
@UseGuards(OriginGuard, PermissionsGuard)
@RequirePermissions(PERMISSIONS.WORKSPACES_UPDATE)
@Controller('workspaces')
export class RemoveWorkspaceMemberController {
    constructor(private readonly workspaces: WorkspaceService) {}

    @Delete(':id/members/:userId')
    @HttpCode(HttpStatus.NO_CONTENT)
    async remove(
        @CurrentUser() actor: PublicUser,
        @Param('id', ParseUUIDPipe) id: string,
        @Param('userId', ParseUUIDPipe) userId: string
    ): Promise<void> {
        await this.workspaces.removeMember(actor, id, userId);
    }
}
