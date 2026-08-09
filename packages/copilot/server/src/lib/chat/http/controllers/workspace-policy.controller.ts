import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import {
    OriginGuard,
    PERMISSIONS,
    PermissionsGuard,
    RequirePermissions
} from '@ortha-cms/identity-server';
import { CurrentWorkspace, WorkspaceGuard } from '@ortha-cms/workspaces-server';
import type { WorkspaceCopilotPolicy } from '@ortha-cms/copilot-domain';
import { CopilotPolicyService } from '../../application/copilot-policy.service';
import { ToolRegistry, type ToolDefinition } from '@ortha-cms/tools-server';
import { UpdateWorkspacePolicyDto } from '../../application/dto/update-workspace-policy.dto';

/** The policy plus the tools an admin may opt in — one round trip for the UI. */
export interface WorkspacePolicyView extends WorkspaceCopilotPolicy {
    /**
     * Every `propose` tool this deployment has bound, so the settings page can
     * render real checkboxes instead of a free-text list. Derived from the
     * registries rather than stored: a tool that no longer exists must not keep
     * appearing as an option, and one added by a new plugin should appear
     * without a migration.
     */
    optInCandidates: { name: string; description: string }[];
}

/**
 * `GET/PUT /api/copilot/policy` — the workspace's auto-apply opt-ins
 * ([ADR-0005](../../../../../../docs/adr/0005-copilot-authority-model.md) §6, §10).
 *
 * **`copilot:configure`, not `copilot:use`.** Deciding that a tool may write
 * without review is an administrative act, and the ADR puts exactly that key on
 * it. The read carries the same requirement as the write: the list of what
 * *could* be auto-applied is itself the shape of the deployment's write
 * surface, and there is no reason for an editor to enumerate it.
 */
@UseGuards(PermissionsGuard, WorkspaceGuard)
@RequirePermissions(PERMISSIONS.COPILOT_CONFIGURE)
@Controller('copilot')
export class WorkspacePolicyController {
    constructor(
        private readonly policies: CopilotPolicyService,
        private readonly tools: ToolRegistry
    ) {}

    @Get('policy')
    @ApiOperation({ summary: 'Read the workspace’s copilot policy' })
    async get(
        @CurrentWorkspace() workspaceId: string
    ): Promise<WorkspacePolicyView> {
        const policy = await this.policies.forWorkspace(workspaceId);
        // Synchronous now: the shared registry holds the catalogue in memory
        // and its `forSurface` filter reads no state.
        return { ...policy, optInCandidates: this.optInCandidates() };
    }

    @Put('policy')
    @UseGuards(OriginGuard)
    @ApiOperation({ summary: 'Set which tools may write without review' })
    async update(
        @Body() body: UpdateWorkspacePolicyDto,
        @CurrentWorkspace() workspaceId: string
    ): Promise<WorkspacePolicyView> {
        // Names are intersected with what is actually bound, so a stale or
        // mistyped entry cannot sit in the policy waiting for a future tool to
        // adopt that name and inherit an opt-in nobody granted it.
        const candidates = this.optInCandidates();
        const known = new Set(candidates.map((tool) => tool.name));
        const policy = await this.policies.setAutoApplyTools(
            workspaceId,
            body.autoApplyTools.filter((name) => known.has(name))
        );
        return { ...policy, optInCandidates: candidates };
    }

    /**
     * Every `propose` tool bound in this workspace.
     *
     * Listed unconditionally rather than intersected with the registered
     * applier kinds: a `ToolSpec` does not carry the `kind` its drafts will
     * name — only the draft does, at call time — so there is nothing to join
     * on. A tool whose applier is missing is caught where it matters, at
     * accept, with a message saying this deployment cannot carry the change
     * out.
     */
    private optInCandidates() {
        return this.tools
            .forSurface('copilot')
            .filter((tool: ToolDefinition) => tool.effect === 'propose')
            .map((tool: ToolDefinition) => ({
                name: tool.name,
                description: tool.description
            }));
    }
}
