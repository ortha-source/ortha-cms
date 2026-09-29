import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import {
    PERMISSIONS,
    PermissionsGuard,
    RequirePermissions,
    type AuthenticatedRequest
} from '@orthacms/identity-server';
import { OptionalWorkspaceGuard } from '@orthacms/workspaces-server';
import { InjectContentRegistry } from '../../content.tokens';
import type { ContentTypeRegistry } from '../../registry/content-type-registry';
import { WorkspaceGrantsQuery } from '../queries/workspace-grants.query';
import {
    NO_ACCESS,
    type ContentTypeSummaryWithAccess
} from '../content-access.view';

/**
 * `GET /api/content-schema` — summaries of every code-defined content
 * type (collections and singles). Shape-compatible with identity's
 * `ContentTypeDescriptor`, so once identity's workspace grants consume
 * this registry, its mock `/api/content-types` retires in favor of this
 * source of truth. Authentication is enforced by the app-wide AuthGuard;
 * read access is gated on `content:read`.
 *
 * **Global**, and deliberately so — the webhooks editor and other
 * workspace-less screens read it. When the request names a workspace
 * (`X-Workspace-Id`, held to `WorkspaceGuard`'s rule by
 * `OptionalWorkspaceGuard`), every item also carries `access`: whether the
 * workspace owns the type and which shared workspaces it reads it from
 * (ADR-0019, "Explicit per-source grants"). The list itself is not pruned —
 * it never was — so `access` adds per-workspace detail and nothing about
 * other workspaces beyond the names of shared sources this one already reads.
 */
@UseGuards(PermissionsGuard, OptionalWorkspaceGuard)
@RequirePermissions(PERMISSIONS.CONTENT_READ)
@Controller('content-schema')
export class ListContentSchemaController {
    constructor(
        @InjectContentRegistry()
        private readonly registry: ContentTypeRegistry,
        private readonly grants: WorkspaceGrantsQuery
    ) {}

    @Get()
    async list(
        @Req() request: AuthenticatedRequest
    ): Promise<ContentTypeSummaryWithAccess[]> {
        const summaries = this.registry.summaries();
        const workspaceId = request.workspaceId;
        if (!workspaceId) return summaries;
        const access = await this.grants.access(workspaceId);
        return summaries.map((summary) => ({
            ...summary,
            access: access.get(summary.name) ?? NO_ACCESS
        }));
    }
}
