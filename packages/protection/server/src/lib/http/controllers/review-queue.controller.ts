import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
    CurrentUser,
    PERMISSIONS,
    PermissionsGuard,
    RequirePermissions,
    type PublicUser
} from '@orthacms/identity-server';
import { CurrentWorkspace, WorkspaceGuard } from '@orthacms/workspaces-server';
import { ReviewQueueService } from '../../application/review-queue.service';
import { ReviewQueueQueryDto } from '../../application/dto/review-queue-query.dto';
import type {
    RecentlyApprovedView,
    ReviewQueueView
} from '../../types/protection-views';

/**
 * The reviewer's queue: `GET /api/protection/queue`.
 *
 * `content:read`, not `content:approve` — the "My requests" tab is somebody
 * checking on work they sent, and an author who cannot approve still has to be
 * able to see whether anyone has looked. Filtering by what the caller may act on
 * would make the page lie to exactly the person who opened it.
 */
@ApiTags('protection')
@UseGuards(PermissionsGuard, WorkspaceGuard)
@Controller('protection/queue')
export class ReviewQueueController {
    constructor(private readonly queue: ReviewQueueService) {}

    /**
     * What the caller approved lately: `GET /api/protection/queue/approved`.
     *
     * Declared **before** the bare `GET` only for reading order — the two
     * paths are distinct literals. `content:read` like the queue: it lists the
     * caller's own votes, which only somebody who could approve has, and a
     * caller with none is told so by an empty list rather than a 403.
     */
    @ApiOperation({
        summary: 'List what the caller approved recently',
        description:
            'The entries the caller approved in the last 30 days, newest ' +
            'first, one line per entry — the Reviews page’s “Recently ' +
            'approved” tab. Each line says whether the approval is still on ' +
            'the current version and whether that version is live.'
    })
    @RequirePermissions(PERMISSIONS.CONTENT_READ)
    @Get('approved')
    approved(
        @CurrentWorkspace() workspaceId: string,
        @CurrentUser() user: PublicUser
    ): Promise<RecentlyApprovedView> {
        return this.queue.recentlyApproved(workspaceId, user.id);
    }

    /** Open review requests in the workspace, newest first. */
    @ApiOperation({
        summary: 'List open review requests',
        description:
            'Every open request in the workspace, across every content type — ' +
            'which is why this is a page rather than a saved view of one ' +
            'collection. `?mine=1` narrows it to the caller’s own requests. ' +
            'The `given`/`required` pair is a hint for the list; the entry ' +
            'route runs the decision the publish button actually obeys.'
    })
    @RequirePermissions(PERMISSIONS.CONTENT_READ)
    @Get()
    list(
        @CurrentWorkspace() workspaceId: string,
        @Query() query: ReviewQueueQueryDto,
        @CurrentUser() user: PublicUser
    ): Promise<ReviewQueueView> {
        return this.queue.list(
            workspaceId,
            { mine: query.mine, limit: query.limit, offset: query.offset },
            user.id
        );
    }
}
