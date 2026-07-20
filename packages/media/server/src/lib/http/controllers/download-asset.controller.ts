import {
    Controller,
    Get,
    NotFoundException,
    Param,
    ParseUUIDPipe,
    StreamableFile,
    UseGuards
} from '@nestjs/common';
import {
    PERMISSIONS,
    PermissionsGuard,
    RequirePermissions
} from '@ortha-cms/identity-server';
import { CurrentWorkspace, WorkspaceGuard } from '@ortha-cms/workspaces-server';
import { DownloadAssetQuery } from '../../infrastructure/queries/download-asset.query';

/**
 * `GET /api/media/assets/:id/raw` — streams an asset's bytes from the provider
 * that holds them. Stays behind the app's auth + `media:read` + workspace scope
 * (media is private by default). Gated on `media:read`.
 */
@UseGuards(PermissionsGuard, WorkspaceGuard)
@RequirePermissions(PERMISSIONS.MEDIA_READ)
@Controller('media')
export class DownloadAssetController {
    constructor(private readonly query: DownloadAssetQuery) {}

    /** Streams one asset's bytes inline. */
    @Get('assets/:id/raw')
    async raw(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentWorkspace() workspaceId: string
    ): Promise<StreamableFile> {
        const download = await this.query.byId(id, workspaceId);
        if (!download) {
            throw new NotFoundException();
        }
        return new StreamableFile(download.stream, {
            type: download.mimeType,
            disposition: `inline; filename="${encodeURIComponent(download.name)}"`,
            length: download.size
        });
    }
}
