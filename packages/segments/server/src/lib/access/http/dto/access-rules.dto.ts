import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    ArrayMaxSize,
    IsArray,
    IsDateString,
    IsIn,
    IsObject,
    IsOptional,
    IsString,
    Matches,
    MaxLength,
    MinLength,
    ValidateNested
} from 'class-validator';
import {
    ACCESS_FALLBACK,
    CONDITION_MODE,
    INHERIT,
    MAX_CONDITION_GROUPS
} from '@orthacms/segments-domain';

const KEY_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;
const KEY_MAX = 120;
const LABEL_MAX = 200;
const SEGMENTS_MAX = 200;

/** Every mode an authored condition may carry. */
const MODES = [...Object.values(CONDITION_MODE), INHERIT];

/** One segment type's condition inside one group. */
export class ConditionDto {
    @ApiProperty({
        enum: MODES,
        description:
            '`all` does not constrain, `only` admits the named segments, `all-except` admits everyone else, `inherit` takes the value from the level above.'
    })
    @IsIn(MODES)
    mode!: string;

    @ApiPropertyOptional({
        type: [String],
        maxItems: SEGMENTS_MAX,
        description:
            'Segment ids the mode refers to. Empty for `all` and `inherit` — and note an empty `only` admits nobody, which is what a rule reads like once its last segment is removed.'
    })
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(SEGMENTS_MAX)
    @IsString({ each: true })
    segmentIds?: string[];
}

/** One AND-group: segment type key → condition. */
export class ConditionGroupDto {
    @ApiProperty({
        type: 'object',
        additionalProperties: { type: 'object' },
        description:
            'Segment type key → condition. A type absent from a group does not constrain it.'
    })
    @IsObject()
    conditions!: Record<string, ConditionDto>;
}

/** Create or replace a rule. */
export class SaveAccessRuleDto {
    @ApiProperty({ maxLength: KEY_MAX, example: 'partner-access' })
    @IsString()
    @MinLength(1)
    @MaxLength(KEY_MAX)
    @Matches(KEY_PATTERN, { message: 'key must be lowercase and url-safe' })
    key!: string;

    @ApiProperty({ maxLength: LABEL_MAX, example: 'Partner access' })
    @IsString()
    @MinLength(1)
    @MaxLength(LABEL_MAX)
    label!: string;

    @ApiPropertyOptional({
        type: 'object',
        additionalProperties: { type: 'array', items: { type: 'string' } },
        description:
            'Segment type key → segment ids that never see the content, whatever any group says. Checked before the window and before every group.'
    })
    @IsOptional()
    @IsObject()
    exclusions?: Record<string, string[]>;

    @ApiPropertyOptional({
        type: [ConditionGroupDto],
        maxItems: MAX_CONDITION_GROUPS,
        description:
            'OR-ed condition groups. Empty means the rule adds no condition — with exclusions set, that is a valid "everyone except" rule.'
    })
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(MAX_CONDITION_GROUPS)
    @ValidateNested({ each: true })
    @Type(() => ConditionGroupDto)
    groups?: ConditionGroupDto[];

    @ApiPropertyOptional({
        format: 'date-time',
        description: 'Start of the visibility window; omit for no lower bound.'
    })
    @IsOptional()
    @IsDateString()
    startsAt?: string;

    @ApiPropertyOptional({ format: 'date-time' })
    @IsOptional()
    @IsDateString()
    endsAt?: string;

    @ApiPropertyOptional({
        enum: Object.values(ACCESS_FALLBACK),
        default: ACCESS_FALLBACK.Teaser,
        description:
            '`hidden` makes a refused entry indistinguishable from one that does not exist; `teaser`/`paywall` return it with what is missing named, so a client can offer it.'
    })
    @IsOptional()
    @IsIn(Object.values(ACCESS_FALLBACK))
    fallback?: 'hidden' | 'teaser' | 'paywall';
}
