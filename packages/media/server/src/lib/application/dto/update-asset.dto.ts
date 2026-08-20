import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    ArrayMaxSize,
    IsArray,
    IsBoolean,
    IsIn,
    IsOptional,
    IsString,
    IsUUID,
    MaxLength,
    MinLength,
    ValidateNested
} from 'class-validator';
import { MEDIA_TRACK_KIND } from '../../infrastructure/schema/media-asset';

/**
 * One timed-text track to attach to a video or audio asset.
 *
 * The WebVTT file is an ordinary library asset named by {@link assetId}, rather
 * than a blob uploaded through this route — so it keeps its own permissions,
 * its own storage key, and can be replaced without touching the video.
 */
export class MediaTrackDto {
    /** What the track carries. */
    @ApiProperty({
        enum: [...MEDIA_TRACK_KIND],
        description:
            '`captions` carries the non-speech audio a deaf viewer needs (WCAG 1.2.2); `subtitles` is a translation for someone who can hear it. They are not interchangeable.'
    })
    @IsIn(MEDIA_TRACK_KIND)
    kind!: (typeof MEDIA_TRACK_KIND)[number];

    /** BCP-47 tag of the track's language. */
    @ApiProperty({
        maxLength: 35,
        example: 'pt-BR',
        description:
            "BCP-47 tag. Required: a `<track>` with no `srclang` cannot be selected by a player, and is announced with the page's phonemes."
    })
    @IsString()
    @MinLength(2)
    @MaxLength(35)
    srclang!: string;

    /** The label a player shows in its track menu. */
    @ApiProperty({
        maxLength: 120,
        example: 'English (CC)',
        description: 'What a player shows in its track menu.'
    })
    @IsString()
    @MinLength(1)
    @MaxLength(120)
    label!: string;

    /** The library asset holding the WebVTT file. */
    @ApiProperty({
        format: 'uuid',
        description: 'The media asset holding the WebVTT file itself.'
    })
    @IsUUID()
    assetId!: string;

    /** Whether a player should enable this track by default. */
    @ApiPropertyOptional({
        type: Boolean,
        description: 'Whether a player should enable this track by default.'
    })
    @IsOptional()
    @IsBoolean()
    default?: boolean;
}

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

    /**
     * Timed-text tracks, **replacing** the asset's current set.
     *
     * Whole-set replacement rather than add/remove, matching `tags`: the editor
     * shows the list and saves the list, and a track has no natural key beyond
     * `(kind, srclang)` for a partial mutator to address.
     */
    @ApiPropertyOptional({
        type: [MediaTrackDto],
        maxItems: 20,
        description:
            'Timed-text tracks replacing the current set — captions, subtitles, descriptions, chapters. Without these a published video has no caption track available at any layer (WCAG 1.2.2, 508 503.4).'
    })
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(20)
    @ValidateNested({ each: true })
    @Type(() => MediaTrackDto)
    tracks?: MediaTrackDto[];
}
