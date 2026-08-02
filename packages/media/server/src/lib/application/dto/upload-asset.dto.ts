import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

/**
 * The multipart text fields accompanying an upload. The file itself arrives via
 * `FileInterceptor`, outside DTO validation; only `folderId` is a body field —
 * omitted (or absent) means the workspace root.
 *
 * The request is `multipart/form-data` with a binary `file` part alongside the
 * field below. The file part is consumed by the interceptor before validation,
 * so it is deliberately **not** a property here.
 */
export class UploadAssetDto {
    /** Destination folder; omitted uploads to the workspace root. */
    @ApiPropertyOptional({
        type: String,
        format: 'uuid',
        description:
            'Destination folder id. Omit to upload to the workspace root.'
    })
    @IsOptional()
    @IsUUID()
    folderId?: string;
}
