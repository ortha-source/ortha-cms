import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    ParseUUIDPipe,
    Post,
    UseGuards
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
    CurrentUser,
    OriginGuard,
    PERMISSIONS,
    PermissionsGuard,
    RequirePermissions
} from '@orthacms/identity-server';
import { CurrentWorkspace, WorkspaceGuard } from '@orthacms/workspaces-server';
import {
    AssignmentsService,
    type AssignmentView,
    type GrantView
} from '../../application/assignments.service';
import { AssignRuleDto, GrantAccessDto } from '../dto/assignments.dto';

/**
 * Where a rule applies — the content side of the declaration.
 *
 * Assigning replaces whatever was on that target rather than adding to it: one
 * rule governs a level, and two would make "which applies here" an ordering
 * question no editor could predict. Every write re-projects the target before
 * it answers, so a 200 means readers are already being served the new answer.
 */
@ApiTags('Access')
@Controller('access/assignments')
@UseGuards(PermissionsGuard, WorkspaceGuard)
export class AssignmentsController {
    constructor(private readonly assignments: AssignmentsService) {}

    /** Every assignment in the open workspace. */
    @Get()
    @RequirePermissions(PERMISSIONS.ACCESS_READ)
    @ApiOperation({ summary: 'List rule assignments' })
    list(@CurrentWorkspace() workspaceId: string): Promise<AssignmentView[]> {
        return this.assignments.listAssignments(workspaceId);
    }

    /** Assign a rule to a workspace, a content type, or one entry. */
    @Post()
    @UseGuards(OriginGuard)
    @RequirePermissions(PERMISSIONS.ACCESS_MANAGE)
    @ApiOperation({
        summary: 'Assign a rule',
        description:
            'Replaces the assignment already on that target, then re-projects it — so the response means the change is live, not queued.'
    })
    assign(
        @CurrentWorkspace() workspaceId: string,
        @CurrentUser() userId: string,
        @Body() body: AssignRuleDto
    ): Promise<AssignmentView> {
        return this.assignments.assign(workspaceId, {
            ruleId: body.ruleId,
            target: body.target,
            actorId: userId ?? null
        });
    }

    /** Remove an assignment and re-project what it used to govern. */
    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    @UseGuards(OriginGuard)
    @RequirePermissions(PERMISSIONS.ACCESS_MANAGE)
    @ApiOperation({ summary: 'Remove a rule assignment' })
    unassign(
        @CurrentWorkspace() workspaceId: string,
        @Param('id', ParseUUIDPipe) id: string
    ): Promise<void> {
        return this.assignments.unassign(workspaceId, id);
    }
}

/**
 * What a segment may reach — the segment side of the same declaration.
 *
 * A grant only ever widens: it becomes one more OR-ed condition group, and it
 * carries no mode. "Everyone except one" from this side would be every segment
 * but one, which is the complement the projection invariant forbids — so
 * exclusions stay on the content side, in a rule.
 */
@ApiTags('Access')
@Controller('access/grants')
@UseGuards(PermissionsGuard, WorkspaceGuard)
export class GrantsController {
    constructor(private readonly assignments: AssignmentsService) {}

    /** One segment's grants, lapsed ones included. */
    @Get('segment/:segmentId')
    @RequirePermissions(PERMISSIONS.ACCESS_READ)
    @ApiOperation({
        summary: 'List a segment’s grants',
        description:
            'Includes grants that have lapsed: they are inert but kept, so who had access when stays answerable.'
    })
    list(
        @Param('segmentId', ParseUUIDPipe) segmentId: string
    ): Promise<GrantView[]> {
        return this.assignments.listGrants(segmentId);
    }

    /** Grant a segment access to a target in the open workspace. */
    @Post()
    @UseGuards(OriginGuard)
    @RequirePermissions(PERMISSIONS.ACCESS_MANAGE)
    @ApiOperation({
        summary: 'Grant a segment access',
        description:
            'Adds one OR-ed condition to everything the target covers, then re-projects it.'
    })
    grant(
        @CurrentWorkspace() workspaceId: string,
        @CurrentUser() userId: string,
        @Body() body: GrantAccessDto
    ): Promise<GrantView> {
        return this.assignments.grant(workspaceId, {
            segmentId: body.segmentId,
            target: body.target,
            expiresAt: body.expiresAt,
            actorId: userId ?? null
        });
    }

    /** Revoke a grant and re-project. */
    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    @UseGuards(OriginGuard)
    @RequirePermissions(PERMISSIONS.ACCESS_MANAGE)
    @ApiOperation({ summary: 'Revoke a grant' })
    revoke(
        @CurrentWorkspace() workspaceId: string,
        @Param('id', ParseUUIDPipe) id: string
    ): Promise<void> {
        return this.assignments.revoke(workspaceId, id);
    }
}
