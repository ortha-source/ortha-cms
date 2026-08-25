import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    NotFoundException,
    Param,
    ParseUUIDPipe,
    Put,
    Query,
    UseGuards
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
    CurrentUser,
    OriginGuard,
    PERMISSIONS,
    PermissionsGuard,
    RequirePermissions,
    type PublicUser
} from '@orthacms/identity-server';
import { CurrentWorkspace, WorkspaceGuard } from '@orthacms/workspaces-server';
import {
    FindingsByEntryQueryDto,
    ListFindingsQueryDto,
    MuteFindingDto
} from '../../application/dto/list-findings-query.dto';
import { AlarmFindingNotFoundError } from '../../domain/errors';
import { AlarmFindingStore } from '../../infrastructure/alarm-finding.store';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../../alarms.constants';
import type {
    AlarmFindingListView,
    AlarmFindingsByEntryView
} from '../../types/alarm-views';
import type { AlarmSeverity } from '../../domain/alarm-severity';

/** Counts behind the workspace's alarms badge and home panel. */
export interface AlarmSummaryView {
    /** Open findings per severity. */
    open: Record<AlarmSeverity, number>;
    /** Total open findings, at any severity. */
    openTotal: number;
    /** Findings someone has silenced. */
    muted: number;
}

/**
 * The finding surface: `/api/alarms/findings`.
 *
 * Everything here is workspace-scoped and gated on `alarms:read`, except the
 * two mute routes — silencing a finding is a statement about what the workspace
 * considers acceptable, so it needs `alarms:manage` like a rule does.
 */
@ApiTags('alarms')
@UseGuards(PermissionsGuard, WorkspaceGuard)
@Controller('alarms/findings')
export class AlarmFindingsController {
    constructor(private readonly findings: AlarmFindingStore) {}

    /**
     * Live findings for a batch of entries, keyed by entry id.
     *
     * Declared **before** the paged list so the literal `by-entry` segment is
     * never eaten by a wildcard, and existing as a batch at all because its
     * callers are the records table and the entry editor — one request per page
     * of rows, never one per row.
     */
    @ApiOperation({
        summary: 'Findings for specific entries',
        description:
            'Live (non-resolved) findings for up to one records page of ' +
            'entries, keyed by entry id.'
    })
    @RequirePermissions(PERMISSIONS.ALARMS_READ)
    @Get('by-entry')
    async byEntry(
        @CurrentWorkspace() workspaceId: string,
        @Query() query: FindingsByEntryQueryDto
    ): Promise<AlarmFindingsByEntryView> {
        const byEntry = await this.findings.byEntryIds(
            workspaceId,
            query.entryIds ?? []
        );
        return { byEntry };
    }

    /** Open and muted counts, for the sidebar badge and the home panel. */
    @ApiOperation({
        summary: 'Alarm counts',
        description:
            'Open findings per severity plus the muted total — the numbers ' +
            'the nav badge and the dashboard panel render.'
    })
    @RequirePermissions(PERMISSIONS.ALARMS_READ)
    @Get('summary')
    async summary(
        @CurrentWorkspace() workspaceId: string
    ): Promise<AlarmSummaryView> {
        const [open, muted] = await Promise.all([
            this.findings.openCountsBySeverity(workspaceId),
            this.findings.mutedCount(workspaceId)
        ]);
        const openTotal = Object.values(open).reduce(
            (sum, count) => sum + count,
            0
        );
        return { open, openTotal, muted };
    }

    /** One page of the workspace's findings. */
    @ApiOperation({
        summary: 'List findings',
        description:
            'Findings in the open workspace, newest activity first. Without ' +
            'an explicit `state`, resolved findings are excluded.'
    })
    @RequirePermissions(PERMISSIONS.ALARMS_READ)
    @Get()
    list(
        @CurrentWorkspace() workspaceId: string,
        @Query() query: ListFindingsQueryDto
    ): Promise<AlarmFindingListView> {
        return this.findings.list(workspaceId, {
            state: query.state,
            ruleId: query.ruleId,
            severity: query.severity,
            page: Math.max(1, query.page ?? 1),
            // The DTO already bounds `pageSize`; this is the defence-in-depth
            // clamp, so a future caller that bypasses the pipe still cannot ask
            // for an unbounded page.
            pageSize: Math.min(
                MAX_PAGE_SIZE,
                Math.max(1, query.pageSize ?? DEFAULT_PAGE_SIZE)
            )
        });
    }

    /** Silences one finding, with a reason the next reader can weigh. */
    @ApiOperation({
        summary: 'Mute a finding',
        description:
            'Silences this rule for this entry. The mute survives the finding ' +
            'resolving and re-opening, so a deliberate exception stays quiet.'
    })
    @UseGuards(OriginGuard)
    @RequirePermissions(PERMISSIONS.ALARMS_MANAGE)
    @HttpCode(204)
    @Put(':ruleId/:entryId/mute')
    async mute(
        @CurrentWorkspace() workspaceId: string,
        @Param('ruleId', ParseUUIDPipe) ruleId: string,
        @Param('entryId', ParseUUIDPipe) entryId: string,
        @CurrentUser() user: PublicUser | undefined,
        @Body() dto: MuteFindingDto
    ): Promise<void> {
        await notFoundOnMissing(() =>
            this.findings.mute(
                workspaceId,
                ruleId,
                entryId,
                user?.id ?? null,
                dto.reason ?? null
            )
        );
    }

    /** Lifts a mute, putting a still-matching finding back in view. */
    @ApiOperation({
        summary: 'Unmute a finding',
        description: 'Puts a silenced finding back in view if it still matches.'
    })
    @UseGuards(OriginGuard)
    @RequirePermissions(PERMISSIONS.ALARMS_MANAGE)
    @HttpCode(204)
    @Delete(':ruleId/:entryId/mute')
    async unmute(
        @CurrentWorkspace() workspaceId: string,
        @Param('ruleId', ParseUUIDPipe) ruleId: string,
        @Param('entryId', ParseUUIDPipe) entryId: string
    ): Promise<void> {
        await notFoundOnMissing(() =>
            this.findings.unmute(workspaceId, ruleId, entryId)
        );
    }
}

/** Maps the one domain error these routes raise onto a 404. */
async function notFoundOnMissing(run: () => Promise<void>): Promise<void> {
    try {
        await run();
    } catch (error) {
        if (error instanceof AlarmFindingNotFoundError) {
            throw new NotFoundException(error.message);
        }
        throw error;
    }
}
