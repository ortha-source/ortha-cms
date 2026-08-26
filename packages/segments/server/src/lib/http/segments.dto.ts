import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    ArrayMaxSize,
    IsArray,
    IsOptional,
    IsString,
    IsUUID,
    Matches,
    MaxLength,
    MinLength
} from 'class-validator';

/** Url-safe, lowercase. */
const KEY_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;
const KEY_MAX = 120;
const LABEL_MAX = 200;
const TAG_MAX = 200;
const TAGS_MAX = 20;
/** Segments one entry may name on either side. */
const IDS_MAX = 200;

/** Narrow the segment list. */
export class ListSegmentsQueryDto {
    @ApiPropertyOptional({
        description:
            'Case-insensitive substring matched against the segment’s label and key.',
        maxLength: LABEL_MAX
    })
    @IsOptional()
    @IsString()
    @MaxLength(LABEL_MAX)
    q?: string;
}

/** Create a segment. */
export class CreateSegmentDto {
    @ApiProperty({ maxLength: KEY_MAX, example: 'acme' })
    @IsString()
    @MinLength(1)
    @MaxLength(KEY_MAX)
    @Matches(KEY_PATTERN, { message: 'key must be lowercase and url-safe' })
    key!: string;

    @ApiProperty({ maxLength: LABEL_MAX, example: 'Acme Corp' })
    @IsString()
    @MinLength(1)
    @MaxLength(LABEL_MAX)
    label!: string;

    @ApiPropertyOptional({
        type: [String],
        maxItems: TAGS_MAX,
        description:
            'The reader tags this segment answers to — any one is enough. Defaults to the key.'
    })
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(TAGS_MAX)
    @IsString({ each: true })
    @MaxLength(TAG_MAX, { each: true })
    tags?: string[];
}

/** Rename a segment or change its tags. */
export class UpdateSegmentDto {
    @ApiPropertyOptional({ maxLength: LABEL_MAX })
    @IsOptional()
    @IsString()
    @MinLength(1)
    @MaxLength(LABEL_MAX)
    label?: string;

    @ApiPropertyOptional({ type: [String], maxItems: TAGS_MAX })
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(TAGS_MAX)
    @IsString({ each: true })
    @MaxLength(TAG_MAX, { each: true })
    tags?: string[];
}

/**
 * Replace one entry's two lists.
 *
 * Both are sent whole on every write, because that is the only shape that can
 * express a removal — a merge has no spelling for "this segment is no longer
 * mentioned".
 */
export class SetEntryAccessDto {
    @ApiProperty({
        maxLength: 120,
        description: 'The entry’s content type slug.',
        example: 'article'
    })
    @IsString()
    @MaxLength(120)
    typeSlug!: string;

    @ApiProperty({
        type: [String],
        maxItems: IDS_MAX,
        description:
            'Segments that may read the entry. **An empty list means everyone**, not nobody.'
    })
    @IsArray()
    @ArrayMaxSize(IDS_MAX)
    @IsUUID('4', { each: true })
    allow!: string[];

    @ApiProperty({
        type: [String],
        maxItems: IDS_MAX,
        description:
            'Segments that may not, whatever `allow` says. A deny always wins.'
    })
    @IsArray()
    @ArrayMaxSize(IDS_MAX)
    @IsUUID('4', { each: true })
    deny!: string[];
}
