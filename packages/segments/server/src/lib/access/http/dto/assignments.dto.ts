import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    IsDateString,
    IsIn,
    IsOptional,
    IsString,
    IsUUID,
    MaxLength,
    ValidateNested
} from 'class-validator';

/** The three levels a rule or a grant attaches to. */
export const TARGET_KINDS = ['workspace', 'type', 'entry'] as const;

const SLUG_MAX = 120;

/** Where a rule or a grant applies. */
export class AccessTargetDto {
    @ApiProperty({
        enum: TARGET_KINDS,
        description:
            'The level this attaches to. `type` and `entry` must name a content type; `entry` must also name an entry.'
    })
    @IsIn(TARGET_KINDS)
    kind!: 'workspace' | 'type' | 'entry';

    @ApiPropertyOptional({ maxLength: SLUG_MAX, example: 'article' })
    @IsOptional()
    @IsString()
    @MaxLength(SLUG_MAX)
    typeSlug?: string;

    @ApiPropertyOptional({ format: 'uuid' })
    @IsOptional()
    @IsUUID()
    entryId?: string;
}

/** Assign a rule to a target. */
export class AssignRuleDto {
    @ApiProperty({ format: 'uuid', description: 'The rule to apply.' })
    @IsUUID()
    ruleId!: string;

    @ApiProperty({ type: () => AccessTargetDto })
    @ValidateNested()
    @Type(() => AccessTargetDto)
    target!: AccessTargetDto;
}

/** Grant a segment access to a target. */
export class GrantAccessDto {
    @ApiProperty({ format: 'uuid', description: 'The segment being granted.' })
    @IsUUID()
    segmentId!: string;

    @ApiProperty({ type: () => AccessTargetDto })
    @ValidateNested()
    @Type(() => AccessTargetDto)
    target!: AccessTargetDto;

    @ApiPropertyOptional({
        format: 'date-time',
        description:
            'When the grant lapses. Omit for open-ended. A lapsed grant is kept rather than deleted, so who had access when is still answerable.'
    })
    @IsOptional()
    @IsDateString()
    expiresAt?: string;
}
