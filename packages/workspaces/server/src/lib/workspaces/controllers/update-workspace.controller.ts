import {
    Body,
    Controller,
    NotFoundException,
    Param,
    ParseUUIDPipe,
    Patch,
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
import { UpdateWorkspaceDto } from '../dto/update-workspace.dto';
import { WorkspaceNotFoundError } from '../errors';

/**
 * `PATCH /api/workspaces/:id` — edits a workspace's profile (name, description,
 * color); requires `workspaces:update`. Only the supplied fields are written; a
 * missing workspace maps to 404. Guarded by `OriginGuard` (CSRF) like the other
 * state-changing routes.
 */
@UseGuards(OriginGuard, PermissionsGuard)
@RequirePermissions(PERMISSIONS.WORKSPACES_UPDATE)
@Controller('workspaces')
export class UpdateWorkspaceController {
    constructor(private readonly workspaces: WorkspaceService) {}

    @Patch(':id')
    async update(
        @CurrentUser() actor: PublicUser,
        @Param('id', ParseUUIDPipe) id: string,
        @Body() body: UpdateWorkspaceDto
    ): Promise<WorkspaceView> {
        try {
            return await this.workspaces.update(actor, id, body);
        } catch (error) {
            if (error instanceof WorkspaceNotFoundError) {
                throw new NotFoundException();
            }
            throw error;
        }
    }
}
