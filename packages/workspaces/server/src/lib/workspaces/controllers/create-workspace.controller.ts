import {
    Body,
    ConflictException,
    Controller,
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
import { CreateWorkspaceDto } from '../dto/create-workspace.dto';
import { SlugTakenError } from '../errors';

/**
 * `POST /api/workspaces` — creates a workspace owned by the current user. The
 * owner is derived from the session (`@CurrentUser()`), never the body; the
 * wizard's per-member role is ignored. A duplicate slug maps to 409.
 *
 * Requires the `workspaces:create` permission (`PermissionsGuard`). Guarded by
 * `OriginGuard` (CSRF defense for this state-changing POST, matching
 * `/auth/login` + `/auth/logout`); authentication is enforced by the app-wide
 * `AuthGuard`.
 */
@UseGuards(OriginGuard, PermissionsGuard)
@RequirePermissions(PERMISSIONS.WORKSPACES_CREATE)
@Controller('workspaces')
export class CreateWorkspaceController {
    constructor(private readonly workspaces: WorkspaceService) {}

    @Post()
    async create(
        @Body() body: CreateWorkspaceDto,
        @CurrentUser() user: PublicUser
    ): Promise<WorkspaceView> {
        try {
            return await this.workspaces.create(body, user);
        } catch (error) {
            if (error instanceof SlugTakenError) {
                throw new ConflictException('Workspace slug already taken');
            }
            throw error;
        }
    }
}
