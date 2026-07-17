import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import {
    PERMISSIONS,
    PermissionsGuard,
    RequirePermissions
} from '@ortha-cms/identity-server';
import { WorkspaceService } from '../services/workspace.service';

/**
 * `GET /api/workspaces/:id/entry-count` — total content entries the workspace
 * holds across every content type. Backs the settings UI's delete pre-check
 * (block the delete action, with a reason, until the workspace is empty), so
 * it's gated by the same `workspaces:delete` as the delete it guards. A read, so
 * no `OriginGuard`. Returns `{ count }` (0 when no content plugin is bound).
 */
@UseGuards(PermissionsGuard)
@RequirePermissions(PERMISSIONS.WORKSPACES_DELETE)
@Controller('workspaces')
export class GetWorkspaceEntryCountController {
    constructor(private readonly workspaces: WorkspaceService) {}

    @Get(':id/entry-count')
    async count(
        @Param('id', ParseUUIDPipe) id: string
    ): Promise<{ count: number }> {
        return { count: await this.workspaces.countWorkspaceEntries(id) };
    }
}
