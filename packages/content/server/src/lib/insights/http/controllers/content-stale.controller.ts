import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
    PERMISSIONS,
    PermissionsGuard,
    RequirePermissions
} from '@orthacms/identity-server';
import { CurrentWorkspace, WorkspaceGuard } from '@orthacms/workspaces-server';
import { ContentInsightsQuery } from '../../infrastructure/queries/content-insights.query';
import type {
    ContentRecordsView,
    ContentStaleView
} from '../../types/content-insights-view';
import {
    toDrillLimit,
    toStaleAge
} from '../../infrastructure/queries/insights-drill.helpers';

/**
 * `GET /api/insights/content/stale` — published entries bucketed by how long
 * ago they were last edited.
 *
 * Takes no `?days=`: the buckets *are* the time axis, and they are fixed
 * (30/90/180/365/older) so the answer means the same thing whichever range the
 * page is set to. "What has nobody touched in a year" is not a question about
 * the last 7 days.
 */
@UseGuards(PermissionsGuard, WorkspaceGuard)
@RequirePermissions(PERMISSIONS.CONTENT_READ)
@Controller('insights/content')
export class ContentStaleController {
    constructor(private readonly insights: ContentInsightsQuery) {}

    @Get('stale')
    stale(@CurrentWorkspace() workspaceId: string): Promise<ContentStaleView> {
        return this.insights.stale(workspaceId);
    }

    /**
     * `GET /api/insights/content/stale/records?age=&limit=` — the published
     * records behind one age band, oldest first, with the per-type split the
     * admin needs to link each type's records table.
     *
     * `age` is `recent` (30–90 days), `months` (90–365) or `year` (older);
     * anything else reads as `year`, the band the Needs-attention line counts.
     * `limit` is clamped to the panel's cap rather than refused.
     */
    @Get('stale/records')
    staleRecords(
        @CurrentWorkspace() workspaceId: string,
        @Query('age') age?: string,
        @Query('limit') limit?: string
    ): Promise<ContentRecordsView> {
        return this.insights.staleRecords(
            workspaceId,
            toStaleAge(age),
            toDrillLimit(limit)
        );
    }
}
