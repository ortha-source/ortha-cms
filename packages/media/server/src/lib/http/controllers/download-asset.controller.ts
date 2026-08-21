import {
    Controller,
    Get,
    NotFoundException,
    Param,
    ParseUUIDPipe,
    Query,
    Res,
    StreamableFile,
    UseGuards
} from '@nestjs/common';
import type { Response } from 'express';
import {
    CurrentUser,
    PERMISSIONS,
    PermissionsGuard,
    RequirePermissions,
    type PublicUser
} from '@orthacms/identity-server';
import { MembershipCheckQuery } from '@orthacms/workspaces-server';
import { DownloadAssetQuery } from '../../infrastructure/queries/download-asset.query';
import { downloadHeadersFor } from '../download-headers';

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

    /**
     * Streams one asset's bytes. `?variant=thumb|preview` serves a generated
     * derivative when present, else the original.
     *
     * The stored MIME type is the uploader's own claim — nothing sniffs the
     * bytes — so the response is hardened by {@link downloadHeadersFor}: always
     * `nosniff` + a no-capability CSP, and `inline` only for types a browser
     * renders without executing them. See `http/download-headers.ts`.
     */
    @Get('assets/:id/raw')
    async raw(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser() user: PublicUser,
        @Res({ passthrough: true }) response: Response,
        @Query('variant') variant?: string
    ): Promise<StreamableFile> {
        const location = await this.query.locate(id, variant);
        // A non-member gets the same 404 as a missing asset — distinguishing
        // them would let anyone probe which asset ids exist in other workspaces.
        if (
            !location ||
            !(await this.members.isMember(user.id, location.workspaceId))
        ) {
            throw new NotFoundException();
        }

        const stream = await this.query.open(location);
        const { disposition, headers } = downloadHeadersFor(
            location.mimeType,
            location.name
        );
        response.set(headers);
        return new StreamableFile(stream, {
            type: location.mimeType,
            disposition,
            length: location.size
        });
    }
}
