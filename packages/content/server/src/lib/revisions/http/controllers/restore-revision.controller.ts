import {
    Controller,
    Param,
    ParseIntPipe,
    ParseUUIDPipe,
    Post,
    UseGuards
} from '@nestjs/common';
import {
    CurrentUser,
    OriginGuard,
    PERMISSIONS,
    PermissionsGuard,
    type PublicUser,
    RequirePermissions
} from '@ortha-cms/identity-server';
import { CurrentWorkspace, WorkspaceGuard } from '@ortha-cms/workspaces-server';
import { InjectContentRegistry } from '../../../content.tokens';
import type { ContentTypeRegistry } from '../../../registry/content-type-registry';
import { resolveType } from '../../../entries/http/controllers/resolve-type';
import type { EntryRecord } from '../../../entries/types/entry-list-view';
import { RestoreRevisionUseCase } from '../../application/use-cases/restore-revision.use-case';

/**
 * `POST /api/content/:typeName/:id/revisions/:number/restore` — re-apply an
 * earlier version onto the live entry. History is append-only: the restore is
 * itself saved as a new revision. `OriginGuard` defends the write;
 * `WorkspaceGuard` scopes it; `content:update` gates it (restoring is an edit).
 */
@UseGuards(OriginGuard, PermissionsGuard, WorkspaceGuard)
@RequirePermissions(PERMISSIONS.CONTENT_UPDATE)
@Controller('content')
export class RestoreRevisionController {
    constructor(
        @InjectContentRegistry()
        private readonly registry: ContentTypeRegistry,
        private readonly restoreRevision: RestoreRevisionUseCase
    ) {}

    @Post(':typeName/:id/revisions/:number/restore')
    restore(
        @Param('typeName') typeName: string,
        @Param('id', ParseUUIDPipe) id: string,
        @Param('number', ParseIntPipe) number: number,
        @CurrentWorkspace() workspaceId: string,
        @CurrentUser() user?: PublicUser
    ): Promise<EntryRecord> {
        const type = resolveType(this.registry, typeName);
        return this.restoreRevision.execute(
            type,
            id,
            number,
            workspaceId,
            user?.id ?? null
        );
    }
}
