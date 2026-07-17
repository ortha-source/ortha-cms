import {
    Controller,
    Delete,
    HttpCode,
    HttpStatus,
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
import { RemoveMemberUseCase } from '../../application/use-cases/remove-member.use-case';

/**
 * `DELETE /api/workspaces/:id/members/:userId` — removes a user's membership;
 * requires `workspaces:update`. Removing a non-member is a no-op (still 204).
 * Guarded by `OriginGuard` (CSRF).
 */
@UseGuards(OriginGuard, PermissionsGuard)
@RequirePermissions(PERMISSIONS.WORKSPACES_UPDATE)
@Controller('workspaces')
export class RemoveWorkspaceMemberController {
    constructor(private readonly removeMember: RemoveMemberUseCase) {}

    @Delete(':id/members/:userId')
    @HttpCode(HttpStatus.NO_CONTENT)
    async remove(
        @CurrentUser() actor: PublicUser,
        @Param('id', ParseUUIDPipe) id: string,
        @Param('userId', ParseUUIDPipe) userId: string
    ): Promise<void> {
        await this.removeMember.execute(actor, id, userId);
    }
}
