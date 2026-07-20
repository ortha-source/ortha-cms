import { Controller, Get, UseGuards } from '@nestjs/common';
import {
    PERMISSIONS,
    PermissionsGuard,
    RequirePermissions
} from '@ortha-cms/identity-server';
import { CurrentWorkspace, WorkspaceGuard } from '@ortha-cms/workspaces-server';
import { ListFoldersQuery } from '../../infrastructure/queries/list-folders.query';
import type { FolderView } from '../../types/folder-view';

/**
 * `GET /api/media/folders` — the workspace's folder tree. Read-gated on
 * `media:read`; scoped to the caller's workspace by `WorkspaceGuard`.
 */
@UseGuards(PermissionsGuard, WorkspaceGuard)
@RequirePermissions(PERMISSIONS.MEDIA_READ)
@Controller('media')
export class ListFoldersController {
    constructor(private readonly query: ListFoldersQuery) {}

    /** Lists every folder in the current workspace. */
    @Get('folders')
    list(@CurrentWorkspace() workspaceId: string): Promise<FolderView[]> {
        return this.query.execute(workspaceId);
    }
}
