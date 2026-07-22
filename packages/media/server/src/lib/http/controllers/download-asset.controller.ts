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
    CurrentUser,
    PERMISSIONS,
    PermissionsGuard,
    RequirePermissions,
    type PublicUser
} from '@ortha-cms/identity-server';
import { MembershipCheckQuery } from '@ortha-cms/workspaces-server';
import { DownloadAssetQuery } from '../../infrastructure/queries/download-asset.query';

/**
 * `GET /api/media/assets/:id/raw` — streams an asset's bytes from the provider
 * that holds them. Stays behind the app's auth + `media:read` (media is private
 * by default).
 *
 * **This is the one media route without `WorkspaceGuard`,** deliberately: the
 * URL is consumed by the browser itself — `<img src>` in the library's
 * thumbnails and detail drawer, plus download links — and those requests carry
 * cookies but *cannot* carry the `X-Workspace-Id` header the guard demands, so
 * every preview 400'd. The scope isn't dropped, it's **derived**: an asset id
 * already determines its workspace, so we look the row up, then require the
 * caller to be a member of *that* workspace. Same boundary, one fewer thing the
 * client has to assert.
 */
@UseGuards(PermissionsGuard)
@RequirePermissions(PERMISSIONS.MEDIA_READ)
@Controller('media')
export class DownloadAssetController {
    constructor(
        private readonly query: DownloadAssetQuery,
        private readonly members: MembershipCheckQuery
    ) {}

    /** Streams one asset's bytes inline. */
    @Get('assets/:id/raw')
    async raw(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser() user: PublicUser
    ): Promise<StreamableFile> {
        const location = await this.query.locate(id);
        // A non-member gets the same 404 as a missing asset — distinguishing
        // them would let anyone probe which asset ids exist in other workspaces.
        if (!location || !(await this.members.isMember(user.id, location.workspaceId))) {
            throw new NotFoundException();
        }

        const stream = await this.query.open(location);
        return new StreamableFile(stream, {
            type: location.mimeType,
            disposition: `inline; filename="${encodeURIComponent(location.name)}"`,
            length: location.size
        });
    }
}
