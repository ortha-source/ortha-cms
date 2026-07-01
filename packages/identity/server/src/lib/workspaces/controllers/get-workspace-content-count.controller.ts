import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { PermissionsGuard } from '../../rbac/guards/permissions.guard';
import { RequirePermissions } from '../../rbac/decorators/require-permissions.decorator';
import { PERMISSIONS } from '../../rbac/system-roles';
import { WorkspaceService } from '../services/workspace.service';

/**
 * `GET /api/workspaces/:id/content/:slug/entry-count` — how many entries of a
 * content type the workspace currently holds. Backs the settings UI's revoke
 * pre-check (block the remove action, with a reason, when the type isn't empty),
 * so it's gated by the same `workspaces:update` as the revoke it guards. A read,
 * so no `OriginGuard`. Returns `{ count }` (0 when no content plugin is bound).
 */
@UseGuards(PermissionsGuard)
@RequirePermissions(PERMISSIONS.WORKSPACES_UPDATE)
@Controller('workspaces')
export class GetWorkspaceContentCountController {
    constructor(private readonly workspaces: WorkspaceService) {}

    @Get(':id/content/:slug/entry-count')
    async count(
        @Param('id', ParseUUIDPipe) id: string,
        @Param('slug') slug: string
    ): Promise<{ count: number }> {
        return { count: await this.workspaces.countContentEntries(id, slug) };
    }
}
