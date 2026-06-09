import { Controller, Get } from '@nestjs/common';
import { CurrentUser, type PublicUser } from '@ortha-cms/identity-server';
import { WorkspacesService } from '../services/workspaces.service';
import type { WorkspaceView } from '../types/workspace-view';

/**
 * `GET /api/workspaces` — lists the workspaces the current user belongs to.
 * Authentication is handled app-wide by identity's global `AuthGuard`: it
 * resolves the session cookie, 401s when there is no valid session, and
 * attaches the user that `@CurrentUser()` reads here. The list is scoped to
 * that user's memberships, so no extra authorization is needed.
 */
@Controller('workspaces')
export class ListWorkspacesController {
    constructor(private readonly workspaces: WorkspacesService) {}

    @Get()
    list(@CurrentUser() user: PublicUser): Promise<WorkspaceView[]> {
        return this.workspaces.listForUser(user.id);
    }
}
