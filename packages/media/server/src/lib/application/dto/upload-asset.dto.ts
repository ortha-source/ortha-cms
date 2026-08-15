import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

/**
 * The multipart text fields accompanying an upload — the destination folder and
 * a text alternative. The file itself arrives via `FileInterceptor`, outside DTO
 * validation; an omitted (or absent) `folderId` means the workspace root.
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

    /**
     * Alternative text, settable **at creation**.
     *
     * WCAG 1.1.1 / Section 508 504.3 ask an authoring tool to prompt for a text
     * alternative when non-text content is created. Before this, the only field
     * on an upload was `folderId`: an image could only ever be given alt text by
     * a second `PATCH`, which a token-driven import never makes — so a bulk
     * import produced a library of permanently undescribed images. Still
     * optional (a zip file has nothing to describe), and a blank string is
     * normalized to `null` by `Asset.setAlt`, so whitespace never counts as
     * covered in the `/api/insights/media/alt` aggregate.
     */
    @ApiPropertyOptional({
        type: String,
        maxLength: 1000,
        example: 'A blue kingfisher perched on a reed',
        description:
            'Alternative text for the asset. Optional, but supply it for images: it is the only text alternative the CMS stores, and a blank value does not count as covered.'
    })
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    alt?: string;
}
