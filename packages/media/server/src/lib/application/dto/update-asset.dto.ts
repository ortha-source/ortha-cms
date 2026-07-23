import {
    ArrayMaxSize,
    IsArray,
    IsOptional,
    IsString,
    IsUUID,
    MaxLength
} from 'class-validator';

/**
 * A partial asset edit. Any subset of fields may be present; `folderId` of
 * `null` moves the asset to the workspace root. Shape/length checks only —
 * deeper rules live in the aggregate's value objects.
 */
export class UpdateAssetDto {
    @IsOptional()
    @IsString()
    @MaxLength(255)
    name?: string;

    @IsOptional()
    @IsUUID()
    folderId?: string | null;

    @IsOptional()
    @IsArray()
    @ArrayMaxSize(50)
    @IsString({ each: true })
    @MaxLength(64, { each: true })
    tags?: string[];

    @IsOptional()
    @IsString()
    @MaxLength(1000)
    alt?: string;
}
