import { IsOptional, IsUUID } from 'class-validator';

/**
 * The multipart text fields accompanying an upload. The file itself arrives via
 * `FileInterceptor`, outside DTO validation; only `folderId` is a body field —
 * omitted (or absent) means the workspace root.
 */
export class UploadAssetDto {
    @IsOptional()
    @IsUUID()
    folderId?: string;
}
