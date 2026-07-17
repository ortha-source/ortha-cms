import {
    Body,
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
import {
    WorkspaceService,
    type WorkspaceView
} from '../services/workspace.service';
import { AddWorkspaceMemberDto } from '../dto/add-workspace-member.dto';
import { MemberNotFoundError, WorkspaceNotFoundError } from '../errors';

/**
 * `POST /api/workspaces/:id/members` — links an existing user to a workspace;
 * requires `workspaces:update`. Idempotent (re-adding a member is a no-op). A
 * missing workspace or user maps to 404. Guarded by `OriginGuard` (CSRF) like
 * the other state-changing POSTs.
 */
@UseGuards(OriginGuard, PermissionsGuard)
@RequirePermissions(PERMISSIONS.WORKSPACES_UPDATE)
@Controller('workspaces')
export class AddWorkspaceMemberController {
    constructor(private readonly workspaces: WorkspaceService) {}

    @Post(':id/members')
    async add(
        @CurrentUser() actor: PublicUser,
        @Param('id', ParseUUIDPipe) id: string,
        @Body() body: AddWorkspaceMemberDto
    ): Promise<WorkspaceView> {
        try {
            return await this.workspaces.addMember(actor, id, body.userId);
        } catch (error) {
            if (
                error instanceof WorkspaceNotFoundError ||
                error instanceof MemberNotFoundError
            ) {
                throw new NotFoundException();
            }
            throw error;
        }
    }
}
