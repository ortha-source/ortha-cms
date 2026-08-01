import { ApiPropertyOptional } from '@nestjs/swagger';
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
    /** New display name (the file name shown in the library). */
    @ApiPropertyOptional({
        type: String,
        maxLength: 255,
        example: 'hero-banner.png',
        description:
            'New display name. Deeper rules (extension handling) live in the `FileName` value object.'
    })
    @IsOptional()
    @IsString()
    @MaxLength(255)
    name?: string;

    /** Destination folder; `null` moves the asset to the workspace root. */
    @ApiPropertyOptional({
        type: String,
        format: 'uuid',
        nullable: true,
        description:
            'Destination folder id. `null` moves the asset to the workspace root; omitted leaves it where it is.'
    })
    @IsOptional()
    @IsUUID()
    folderId?: string | null;

    /** Free-form tags, replacing the asset's current set. */
    @ApiPropertyOptional({
        type: [String],
        maxItems: 50,
        example: ['campaign', 'q1'],
        description:
            'Free-form tags replacing the current set — at most 50, each at most 64 characters.'
    })
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(50)
    @IsString({ each: true })
    @MaxLength(64, { each: true })
    tags?: string[];

    /** Alternative text used when the asset is rendered. */
    @ApiPropertyOptional({
        type: String,
        maxLength: 1000,
        example: 'A blue kingfisher perched on a reed',
        description: 'Alternative text used when the asset is rendered.'
    })
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    alt?: string;
}
