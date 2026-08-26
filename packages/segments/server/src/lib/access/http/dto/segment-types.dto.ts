import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsIn,
    IsOptional,
    IsString,
    Matches,
    MaxLength,
    MinLength
} from 'class-validator';
import { SEGMENT_CARDINALITY } from '@orthacms/segments-domain';

/** Lowercase namespace, no colon — the colon separates a tag's two halves. */
const KEY_PATTERN = /^[a-z][a-z0-9_-]*$/;

/** Longest accepted key and label. */
const KEY_MAX = 40;
const LABEL_MAX = 120;

/** Create a segment type. */
export class CreateSegmentTypeDto {
    @ApiProperty({
        description:
            'Tag namespace this type owns — the half before the colon in `org:acme`. Lowercase letters, digits, hyphens and underscores, starting with a letter.',
        maxLength: KEY_MAX,
        example: 'org'
    })
    @IsString()
    @MinLength(1)
    @MaxLength(KEY_MAX)
    @Matches(KEY_PATTERN, {
        message: 'key must be a lowercase tag namespace and may not contain ":"'
    })
    key!: string;

    @ApiProperty({
        description: 'Human-readable name, shown in the entry editor.',
        maxLength: LABEL_MAX,
        example: 'Organisation'
    })
    @IsString()
    @MinLength(1)
    @MaxLength(LABEL_MAX)
    label!: string;

    @ApiPropertyOptional({
        enum: Object.values(SEGMENT_CARDINALITY),
        default: SEGMENT_CARDINALITY.Low,
        description:
            'Rendering hint. `low` earns matrix columns; `high` gets a searchable picker.'
    })
    @IsOptional()
    @IsIn(Object.values(SEGMENT_CARDINALITY))
    cardinality?: 'low' | 'high';
}

/** Rename a segment type or change how it renders. Its slot never moves. */
export class UpdateSegmentTypeDto {
    @ApiPropertyOptional({ maxLength: LABEL_MAX })
    @IsOptional()
    @IsString()
    @MinLength(1)
    @MaxLength(LABEL_MAX)
    label?: string;

    @ApiPropertyOptional({ enum: Object.values(SEGMENT_CARDINALITY) })
    @IsOptional()
    @IsIn(Object.values(SEGMENT_CARDINALITY))
    cardinality?: 'low' | 'high';
}
