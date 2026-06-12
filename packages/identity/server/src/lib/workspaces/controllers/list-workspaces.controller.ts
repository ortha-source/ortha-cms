import { Controller, Get } from '@nestjs/common';
import {
    WorkspaceService,
    type WorkspaceView
} from '../services/workspace.service';

/**
 * `GET /api/workspaces` — lists every workspace with its members. Authentication
 * is enforced by the app-wide `AuthGuard` (conceptually `workspaces:read`).
 */
@Controller('workspaces')
export class ListWorkspacesController {
    constructor(private readonly workspaces: WorkspaceService) {}

    @Get()
    list(): Promise<WorkspaceView[]> {
        return this.workspaces.listAll();
    }
}
