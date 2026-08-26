import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    ParseUUIDPipe,
    Patch,
    Post,
    UseGuards
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
    OriginGuard,
    PERMISSIONS,
    PermissionsGuard,
    RequirePermissions
} from '@orthacms/identity-server';
import { CurrentWorkspace, WorkspaceGuard } from '@orthacms/workspaces-server';
import {
    AccessRulesService,
    type AccessRuleView
} from '../../application/access-rules.service';
import { SaveAccessRuleDto } from '../dto/access-rules.dto';

/**
 * The rule library, scoped to the open workspace.
 *
 * Listing includes the installation-wide rules the workspace can use, and
 * writing is refused on them: a global rule is a decision taken above, and
 * letting one workspace edit it would change every other workspace's content
 * with nothing to say so.
 *
 * `PATCH` re-projects every target the rule is assigned to. That is the whole
 * reason this is a route rather than a table edit — the entries did not move,
 * so nothing else would re-derive what readers actually get.
 */
@ApiTags('Access')
@Controller('access/rules')
@UseGuards(PermissionsGuard, WorkspaceGuard)
export class AccessRulesController {
    constructor(private readonly rules: AccessRulesService) {}

    /** Every rule this workspace can use, with its assignment count. */
    @Get()
    @RequirePermissions(PERMISSIONS.ACCESS_READ)
    @ApiOperation({ summary: 'List access rules' })
    list(@CurrentWorkspace() workspaceId: string): Promise<AccessRuleView[]> {
        return this.rules.list(workspaceId);
    }

    /** Create a workspace-scoped rule. */
    @Post()
    @UseGuards(OriginGuard)
    @RequirePermissions(PERMISSIONS.ACCESS_MANAGE)
    @ApiOperation({
        summary: 'Create an access rule',
        description:
            'Validated against the catalogue: every named segment must exist and belong to the type it is named under, since either mistake produces a rule that silently refuses everyone.'
    })
    create(
        @CurrentWorkspace() workspaceId: string,
        @Body() body: SaveAccessRuleDto
    ): Promise<AccessRuleView> {
        return this.rules.create(workspaceId, body);
    }

    /** Replace a rule, then re-project everything it reaches. */
    @Patch(':id')
    @UseGuards(OriginGuard)
    @RequirePermissions(PERMISSIONS.ACCESS_MANAGE)
    @ApiOperation({
        summary: 'Update an access rule',
        description:
            'Replaces the rule’s contents and re-projects every target it is assigned to, so the projection readers are served against never lags the rule.'
    })
    update(
        @CurrentWorkspace() workspaceId: string,
        @Param('id', ParseUUIDPipe) id: string,
        @Body() body: SaveAccessRuleDto
    ): Promise<AccessRuleView> {
        return this.rules.update(workspaceId, id, body);
    }

    /** Delete a rule nothing is assigned to. */
    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    @UseGuards(OriginGuard)
    @RequirePermissions(PERMISSIONS.ACCESS_MANAGE)
    @ApiOperation({
        summary: 'Delete an access rule',
        description:
            'Refused with 409 while assignments still name it — deleting an assigned rule would silently open everything it governs.'
    })
    remove(
        @CurrentWorkspace() workspaceId: string,
        @Param('id', ParseUUIDPipe) id: string
    ): Promise<void> {
        return this.rules.remove(workspaceId, id);
    }
}
