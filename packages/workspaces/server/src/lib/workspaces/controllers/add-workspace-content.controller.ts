import {
    BadRequestException,
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
import { AddWorkspaceContentDto } from '../dto/add-workspace-content.dto';
import { UnknownContentTypeError, WorkspaceNotFoundError } from '../errors';

/**
 * `POST /api/workspaces/:id/content` — grants the workspace access to one
 * content type (by slug); requires `workspaces:update`. Idempotent (re-granting
 * is a no-op). A missing workspace maps to 404; a slug that names no known
 * content type maps to 400. Guarded by `OriginGuard` (CSRF).
 */
@UseGuards(OriginGuard, PermissionsGuard)
@RequirePermissions(PERMISSIONS.WORKSPACES_UPDATE)
@Controller('workspaces')
export class AddWorkspaceContentController {
    constructor(private readonly workspaces: WorkspaceService) {}

    @Post(':id/content')
    async add(
        @CurrentUser() actor: PublicUser,
        @Param('id', ParseUUIDPipe) id: string,
        @Body() body: AddWorkspaceContentDto
    ): Promise<WorkspaceView> {
        try {
            return await this.workspaces.grantContent(actor, id, body.slug);
        } catch (error) {
            if (error instanceof WorkspaceNotFoundError) {
                throw new NotFoundException();
            }
            if (error instanceof UnknownContentTypeError) {
                throw new BadRequestException(error.message);
            }
            throw error;
        }
    }
}
