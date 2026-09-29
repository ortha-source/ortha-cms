import {
    Controller,
    Get,
    Inject,
    Param,
    ParseUUIDPipe,
    UseGuards
} from '@nestjs/common';
import {
    PERMISSIONS,
    PermissionsGuard,
    RequirePermissions
} from '@orthacms/identity-server';
import { WorkspaceMemberGuard } from '../guards/workspace-member.guard';
import {
    SHARED_CONTENT_SOURCES,
    type SharedContentSource,
    type SharedContentSources
} from '../../application/ports/shared-content-sources.port';

/** Response of `GET /api/workspaces/:id/shared-sources`. */
export interface SharedSourcesView {
    /** Every shared, non-archived workspace other than `:id`, by name. */
    items: SharedContentSource[];
}

/**
 * `GET /api/workspaces/:id/shared-sources` — the shared workspaces `:id` may
 * take a **shared content grant** from (ADR-0019, "Explicit per-source
 * grants"): every shared, non-archived workspace other than `:id`, each with
 * the content types it offers (its own grants). Backs the settings content
 * tab's "Tags · Travel Library" choices.
 *
 * Gated like the grant it feeds — `workspaces:update` plus
 * `WorkspaceMemberGuard` (a non-member gets the flat 403). A read, so no
 * `OriginGuard`. Sharing a workspace is what publishes its name and offered
 * types to other workspaces — they already see both as a record's `source` —
 * so listing them discloses nothing a shared workspace has not opted into;
 * an unshared workspace never appears.
 */
@UseGuards(PermissionsGuard, WorkspaceMemberGuard)
@RequirePermissions(PERMISSIONS.WORKSPACES_UPDATE)
@Controller('workspaces')
export class ListSharedSourcesController {
    constructor(
        @Inject(SHARED_CONTENT_SOURCES)
        private readonly sources: SharedContentSources
    ) {}

    @Get(':id/shared-sources')
    async list(
        @Param('id', ParseUUIDPipe) id: string
    ): Promise<SharedSourcesView> {
        return { items: await this.sources.list(id) };
    }
}
