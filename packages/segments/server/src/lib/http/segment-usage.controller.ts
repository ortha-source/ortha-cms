import {
    Controller,
    Get,
    Param,
    ParseUUIDPipe,
    UseGuards
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
    PERMISSIONS,
    PermissionsGuard,
    RequirePermissions
} from '@orthacms/identity-server';
import { CurrentWorkspace, WorkspaceGuard } from '@orthacms/workspaces-server';
import {
    SegmentUsageService,
    type SegmentUsageView
} from '../application/segment-usage.service';

/**
 * Where one audience is used — the entries of the caller's workspace that name
 * it, and whether each allows or refuses it.
 *
 * A controller of its own rather than a route on `SegmentsController`, because
 * its guards differ: the directory is installation-wide, while this answers with
 * entry titles, which are content and belong to one workspace. `WorkspaceGuard`
 * checks the caller's membership of the `X-Workspace-Id` it names before the
 * route runs, and the service reads by that workspace and nothing else.
 *
 * `segments:read` **and** `content:read`: knowing which entries an audience
 * governs is a segments question, and naming them is reading content.
 *
 * `:id/usage` is two path segments, so it can never be mistaken for the
 * directory's `GET :id`.
 */
@ApiTags('Segments')
@Controller('segments')
@UseGuards(PermissionsGuard, WorkspaceGuard)
export class SegmentUsageController {
    constructor(private readonly usage: SegmentUsageService) {}

    /** The entries of this workspace naming the audience, either way. */
    @Get(':id/usage')
    @RequirePermissions(PERMISSIONS.SEGMENTS_READ, PERMISSIONS.CONTENT_READ)
    @ApiOperation({
        summary: 'Where a segment is used',
        description:
            'The entries of the workspace in `X-Workspace-Id` that name this audience, each marked `allow` (readers in it can see the entry) or `deny` (they cannot). `total` is exact; `items` stops at the first hundred. Other workspaces’ entries are never named.'
    })
    get(
        @CurrentWorkspace() workspaceId: string,
        @Param('id', ParseUUIDPipe) id: string
    ): Promise<SegmentUsageView> {
        return this.usage.forWorkspace(id, workspaceId);
    }
}
