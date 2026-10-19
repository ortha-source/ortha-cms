import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
    CurrentUser,
    PERMISSIONS,
    PermissionsGuard,
    RequirePermissions,
    type PublicUser
} from '@orthacms/identity-server';
import { CurrentWorkspace, WorkspaceGuard } from '@orthacms/workspaces-server';
import {
    CopilotQuotaService,
    type UsageSummary
} from '../../application/copilot-quota.service';

/**
 * `GET /api/copilot/usage` — what the caller has spent today in this
 * workspace, and their quota, for the meter under the composer.
 *
 * `copilot:use`, like the run route: anyone who can spend may see what they
 * have spent. `WorkspaceGuard` because the user's quota is per workspace and
 * the workspace's flag is about that workspace — an unvalidated id would turn
 * the flag into a probe of how busy somebody else's workspace is.
 *
 * The workspace half is a **flag**, never a figure: a member needs to know the
 * workspace is out of allowance to understand a refusal, not how much their
 * colleagues have used.
 */
@UseGuards(PermissionsGuard, WorkspaceGuard)
@RequirePermissions(PERMISSIONS.COPILOT_USE)
@Controller('copilot')
export class GetUsageController {
    constructor(private readonly quotas: CopilotQuotaService) {}

    @Get('usage')
    @ApiOperation({
        summary: 'Today’s copilot usage for the caller',
        description:
            'Billable tokens spent today (UTC) in this workspace, the daily quota ' +
            '(`null` when none is configured), when it resets, and whether the ' +
            'workspace’s own quota is spent.'
    })
    @ApiResponse({ status: 200, description: 'The caller’s usage summary.' })
    async get(
        @CurrentUser() user: PublicUser,
        @CurrentWorkspace() workspaceId: string
    ): Promise<UsageSummary> {
        return this.quotas.summary({ userId: user.id, workspaceId });
    }
}
