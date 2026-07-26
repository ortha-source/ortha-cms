import {
    BadRequestException,
    Body,
    Controller,
    NotFoundException,
    Post,
    UploadedFile,
    UseFilters,
    UseGuards,
    UseInterceptors
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Readable } from 'node:stream';
import {
    CurrentUser,
    OriginGuard,
    PERMISSIONS,
    PermissionsGuard,
    RequirePermissions,
    type PublicUser
} from '@ortha-cms/identity-server';
import { CurrentWorkspace, WorkspaceGuard } from '@ortha-cms/workspaces-server';
import { UploadAssetUseCase } from '../../application/use-cases/upload-asset.use-case';
import { AssetViewQuery } from '../../infrastructure/queries/asset-view.query';
import { UploadAssetDto } from '../../application/dto/upload-asset.dto';
import type { AssetView } from '../../types/asset-view';
import { MulterUploadFilter } from '../multer-upload.filter';
import { toHttp } from '../to-http';

/**
 * Hard ceiling on a single upload, in bytes. Bounds the memory multer buffers
 * per request (it stops reading at the cap and errors), so an oversized POST
 * can't exhaust the heap. Sourced from the same `MEDIA_MAX_UPLOAD_BYTES` env as
 * `config.plugins.media.maxUploadBytes`, so the two stay in lockstep; the
 * interceptor can't read DI config, hence the module-level read here.
 */
const MAX_UPLOAD_BYTES =
    Number(process.env['MEDIA_MAX_UPLOAD_BYTES']) || 52_428_800;

/** The subset of a multer file the controller reads (avoids an @types/multer dep). */
interface UploadedMediaFile {
    originalname: string;
    mimetype: string;
    size: number;
    buffer: Buffer;
}

/**
 * `POST /api/media/assets` — multipart upload. The file arrives as the `file`
 * part; `folderId` is an optional text field. Gated on `media:create`, scoped
 * to the caller's workspace.
 */
@UseGuards(OriginGuard, PermissionsGuard, WorkspaceGuard)
@UseFilters(MulterUploadFilter)
@RequirePermissions(PERMISSIONS.MEDIA_CREATE)
@Controller('media')
export class UploadAssetController {
    constructor(
        private readonly upload: UploadAssetUseCase,
        private readonly views: AssetViewQuery
    ) {}

    /** Uploads one file and returns its asset view. */
    @Post('assets')
    @UseInterceptors(
        FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } })
    )
    async create(
        @UploadedFile() file: UploadedMediaFile | undefined,
        @Body() body: UploadAssetDto,
        @CurrentWorkspace() workspaceId: string,
        @CurrentUser() user: PublicUser
    ): Promise<AssetView> {
        if (!file) {
            throw new BadRequestException('file is required');
        }
        try {
            const id = await this.upload.execute(
                {
                    workspaceId,
                    folderId: body.folderId ?? null,
                    fileName: file.originalname,
                    contentType: file.mimetype,
                    size: file.size,
                    body: Readable.from(file.buffer)
                },
                user
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
}
