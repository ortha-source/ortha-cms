import {
    ConflictException,
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
import { CannotRemoveOwnerError } from '../errors';

/**
 * `DELETE /api/workspaces/:id/members/:userId` — removes a user's membership;
 * requires `workspaces:update`. Removing a non-member is a no-op (still 204);
 * removing the workspace owner maps to 409 (the owner is un-removable). Guarded
 * by `OriginGuard` (CSRF) like the other state-changing routes.
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
        try {
            await this.workspaces.removeMember(actor, id, userId);
        } catch (error) {
            if (error instanceof CannotRemoveOwnerError) {
                throw new ConflictException('The workspace owner can’t be removed');
            }
            throw error;
        }
    }
}
