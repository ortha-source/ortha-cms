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
import { CapabilityProfileService } from '../../application/capability-profile.service';
import { ContentTypeSummaryService } from '../../application/content-type-summary.service';
import {
    buildSuggestions,
    type CopilotSuggestion
} from '../../application/suggestions';
import { SkillCatalogService } from '../../../skills/application/skill-catalog.service';

/**
 * `GET /api/copilot/suggestions` — the four openers on the new-chat page,
 * chosen for **this workspace and this caller**.
 *
 * The admin used to ship four fixed sentences ("Find published entries that
 * are missing a description"), which named no type the workspace actually has
 * and offered writes to people who cannot make them. Built here because this
 * is where the three facts live together: the workspace's granted types, its
 * enabled skills, and the tools the caller's role is offered.
 *
 * Structured, not worded — see {@link CopilotSuggestion}. Same guards as every
 * other read here: `copilot:use`, and a validated workspace, since the answer
 * names that workspace's types and skills.
 */
@UseGuards(PermissionsGuard, WorkspaceGuard)
@RequirePermissions(PERMISSIONS.COPILOT_USE)
@Controller('copilot')
export class ListSuggestionsController {
    constructor(
        private readonly profiles: CapabilityProfileService,
        private readonly types: ContentTypeSummaryService,
        private readonly skills: SkillCatalogService
    ) {}

    @Get('suggestions')
    @ApiOperation({
        summary: 'Openers for a new chat in this workspace',
        description:
            'Up to four suggestions, each tied to a tool the caller is offered ' +
            'and named after the workspace’s own content types and skills.'
    })
    @ApiResponse({ status: 200, description: 'The suggestions, in order.' })
    async list(
        @CurrentUser() user: PublicUser,
        @CurrentWorkspace() workspaceId: string
    ): Promise<CopilotSuggestion[]> {
        const [authority, types, skills] = await Promise.all([
            this.profiles.resolve(
                { id: user.id, email: user.email, roleId: user.roleId },
                workspaceId
            ),
            this.types.grantedTypes(workspaceId),
            this.skills.catalogue(workspaceId)
        ]);
        return buildSuggestions({
            types,
            skills: skills
                .filter((skill) => skill.enabled)
                .map(({ name, title, mode }) => ({ name, title, mode })),
            tools: authority.profile.tools.map((tool) => tool.name)
        });
    }
}
