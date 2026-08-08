import {
    BadRequestException,
    Controller,
    Get,
    NotFoundException,
    Param,
    ParseUUIDPipe,
    Post,
    Query,
    StreamableFile,
    UploadedFile,
    UseFilters,
    UseGuards,
    UseInterceptors
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiHeader, ApiOperation, ApiSecurity } from '@nestjs/swagger';
import { Readable } from 'node:stream';
import {
    PERMISSIONS,
    Public,
    RequirePermissions
} from '@ortha-cms/identity-server';
import {
    ApiTokenGuard,
    ApiTokenWorkspaceGuard,
    CurrentApiToken,
    type PublicApiToken
} from '@ortha-cms/content-server';
import { CurrentWorkspace } from '@ortha-cms/workspaces-server';
import { UploadAssetUseCase } from '../../application/use-cases/upload-asset.use-case';
import { AssetViewQuery } from '../../infrastructure/queries/asset-view.query';
import { DownloadAssetQuery } from '../../infrastructure/queries/download-asset.query';
import type { AssetView } from '../../types/asset-view';
import { MulterUploadFilter } from '../multer-upload.filter';
import { toHttp } from '../to-http';

/**
 * Hard ceiling on a single upload, in bytes — the same env the session upload
 * route reads, so the two cannot diverge on what they accept.
 */
const MAX_UPLOAD_BYTES =
    Number(process.env['MEDIA_MAX_UPLOAD_BYTES']) || 52_428_800;

/** The subset of a multer file the controller reads. */
interface UploadedMediaFile {
    originalname: string;
    mimetype: string;
    size: number;
    buffer: Buffer;
}

/**
 * `/api/v1/media/...` — the **token-authenticated** half of the media API,
 * sibling to content-server's public content routes and guarded by the same two
 * guards (which content-server exports; media already depends on it for the
 * `MEDIA_ASSET_RESOLVER` port, so this adds no package edge).
 *
 * It exists because a `full`-scope token can now author content, and a content
 * type's `field.media` stores asset ids that the writer refuses unless the
 * workspace owns them. Without an upload a token could never populate a media
 * field at all — so upload is part of "write content", not a separate product.
 *
 * Two routes, deliberately: **upload** and **read the bytes back**. Renaming,
 * moving, and deleting library assets stay session-only — attaching an image to
 * a record is content authoring, but curating the library is administration, and
 * `scopePermissions` withholds `media:update` / `media:delete` to match.
 *
 * The **raw** route is the reason this is worth building. The session route at
 * `/api/media/assets/:id/raw` derives its scope from the caller's *membership*,
 * which a token has none of, so a bearer got a 404 on the very URLs the content
 * reads hand out. This one derives the same scope from the token's resolved
 * workspace instead, which is the equivalent boundary for a credential that is
 * not a person.
 */
@Public()
@UseGuards(ApiTokenGuard, ApiTokenWorkspaceGuard)
@UseFilters(MulterUploadFilter)
@ApiSecurity('apiToken')
@ApiHeader({
    name: 'X-Workspace-Id',
    required: false,
    description:
        "The workspace to act in. Required when the token covers more than one workspace; optional when it covers exactly one. A workspace outside the token's bucket is a 403."
})
@Controller('v1/media')
export class PublicMediaController {
    constructor(
        private readonly upload: UploadAssetUseCase,
        private readonly views: AssetViewQuery,
        private readonly download: DownloadAssetQuery
    ) {}

    /**
     * `POST /api/v1/media/assets` — upload one file, then use the returned `id`
     * in a content type's media field.
     */
    @Post('assets')
    @RequirePermissions(PERMISSIONS.MEDIA_CREATE)
    @ApiConsumes('multipart/form-data')
    @ApiOperation({
        summary: 'Upload a media asset',
        description:
            'Multipart upload — the bytes arrive as the `file` part, with an optional `folderId` text field (omit for the workspace root). Returns the stored asset, whose `id` is what a content type’s media field takes: `POST /v1/content/:type` with `{ "values": { "coverImage": "<id>" } }`. Raster images get their derivatives generated here, exactly as an admin upload does. Requires a `full`-scope token.'
    })
    @UseInterceptors(
        FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } })
    )
    async create(
        @UploadedFile() file: UploadedMediaFile | undefined,
        @CurrentWorkspace() workspaceId: string,
        @CurrentApiToken() token: PublicApiToken,
        @Query('folderId') folderId?: string
    ): Promise<AssetView> {
        if (!file) {
            throw new BadRequestException('file is required');
        }
        // `uploaded_by` is NOT NULL, and a token is not a user — so the upload
        // is attributed to whoever minted the credential. That keeps the Media
        // Library's uploader column meaningful and names the accountable human;
        // it is emphatically NOT an authorization step (the token's own scope
        // already decided this call is allowed, and that user's role grants are
        // never consulted).
        if (!token.createdBy) {
            throw new BadRequestException(
                'This token has no creator on record and cannot upload.'
            );
        }
        try {
            const id = await this.upload.execute(
                {
                    workspaceId,
                    folderId: folderId ?? null,
                    fileName: file.originalname,
                    contentType: file.mimetype,
                    size: file.size,
                    body: Readable.from(file.buffer)
                },
                { id: token.createdBy, email: null }
            );
            const view = await this.views.byId(id, workspaceId);
            if (!view) {
                throw new NotFoundException();
            }
            return view;
        } catch (error) {
            toHttp(error);
        }
    }

    /**
     * `GET /api/v1/media/assets/:id/raw` — stream an asset's bytes with a
     * bearer token. `?variant=thumb|preview` serves a derivative when one was
     * generated, else the original.
     */
    @Get('assets/:id/raw')
    @RequirePermissions(PERMISSIONS.MEDIA_READ)
    @ApiOperation({
        summary: 'Download a media asset',
        description:
            'Streams the asset’s bytes. This is the URL the public content reads return for a media field, and unlike the admin’s route it is fetchable with the same bearer token. An asset outside the request’s workspace is the same 404 as a missing one.'
    })
    async raw(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentWorkspace() workspaceId: string,
        @Query('variant') variant?: string
    ): Promise<StreamableFile> {
        const location = await this.download.locate(id, variant);
        // An asset in another of the token's workspaces is a 404 too, not just
        // one outside the bucket: the request named a workspace, and reading
        // across that line would make `X-Workspace-Id` advisory. Same 404 as a
        // missing asset either way, so ids stay unprobeable.
        if (!location || location.workspaceId !== workspaceId) {
            throw new NotFoundException();
        }
        const stream = await this.download.open(location);
        return new StreamableFile(stream, {
            type: location.mimeType,
            disposition: `inline; filename="${encodeURIComponent(location.name)}"`,
            length: location.size
        });
    }
}
