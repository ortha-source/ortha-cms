import { Controller, Get } from '@nestjs/common';
import { WorkspaceViewQuery } from '../../infrastructure/queries/workspace-view.query';
import type { WorkspaceView } from '../../application/queries/workspace.view';

/**
 * `GET /api/workspaces` — lists every workspace with its members. Authentication
 * is enforced by the app-wide `AuthGuard` (conceptually `workspaces:read`).
 */
@Controller('workspaces')
export class ListWorkspacesController {
    constructor(private readonly views: WorkspaceViewQuery) {}

    @Get()
    list(): Promise<WorkspaceView[]> {
        return this.views.listAll();
    }
}
