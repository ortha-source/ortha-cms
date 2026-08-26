import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    ArrayMaxSize,
    IsArray,
    IsOptional,
    IsString,
    Matches,
    MaxLength,
    MinLength
} from 'class-validator';

/** Segment keys are namespace-free: the type supplies the namespace. */
const KEY_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;
const KEY_MAX = 120;
const LABEL_MAX = 200;
const TAG_MAX = 200;
const TAGS_MAX = 20;

/** Narrow a segment list. */
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

/** Create a segment by hand. */
export class CreateSegmentDto {
    @ApiProperty({
        description:
            'Key within the type — `acme` under the `org` type is the tag `org:acme`. The `*` key is reserved for the type’s mask.',
        maxLength: KEY_MAX,
        example: 'acme'
    })
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
            'The reader tags this segment matches — any one of them is enough. Defaults to the canonical `<type>:<key>`, which is what makes a second, legacy identifier an edit rather than a new segment.'
    })
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(TAGS_MAX)
    @IsString({ each: true })
    @MaxLength(TAG_MAX, { each: true })
    tags?: string[];
}

/** Rename a segment or change the tags it matches. */
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
