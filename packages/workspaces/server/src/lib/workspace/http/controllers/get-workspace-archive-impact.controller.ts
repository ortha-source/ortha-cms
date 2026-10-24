import {
    Controller,
    Get,
    Param,
    ParseUUIDPipe,
    UseGuards
} from '@nestjs/common';
import {
    PERMISSIONS,
    PermissionsGuard,
    RequirePermissions
} from '@orthacms/identity-server';
import { WorkspaceMemberGuard } from '../guards/workspace-member.guard';
import { ArchiveImpactQuery } from '../../infrastructure/queries/archive-impact.query';
import type { WorkspaceArchiveImpactView } from '../../application/queries/workspace.view';

/**
 * `GET /api/workspaces/:id/archive-impact` — what archiving the workspace would
 * touch: its records and members (both stay) and how many other workspaces link
 * its shared records (they will see them as unavailable). Backs the admin's
 * archive confirmation, so it is gated by the same `workspaces:update` as the
 * archive it precedes (workspaces I-30). A read, so no `OriginGuard`.
 *
 * Also guarded by `WorkspaceMemberGuard`: a caller who isn't a member of
 * `:id` gets a flat 403 — indistinguishable from a workspace that doesn't
 * exist — so the counts never describe another tenant's workspace.
 */
@UseGuards(PermissionsGuard, WorkspaceMemberGuard)
@RequirePermissions(PERMISSIONS.WORKSPACES_UPDATE)
@Controller('workspaces')
export class GetWorkspaceArchiveImpactController {
    constructor(private readonly impact: ArchiveImpactQuery) {}

    @Get(':id/archive-impact')
    get(
        @Param('id', ParseUUIDPipe) id: string
    ): Promise<WorkspaceArchiveImpactView> {
        return this.impact.forWorkspace(id);
    }
}
