import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
    ArrayMaxSize,
    IsArray,
    IsIn,
    IsInt,
    IsOptional,
    IsUUID,
    Max,
    Min
} from 'class-validator';
import {
    ALARM_SEVERITIES,
    type AlarmSeverity
} from '../../domain/alarm-severity';
import { FINDING_STATES, type FindingState } from '../../domain/finding-state';
import {
    DEFAULT_PAGE_SIZE,
    MAX_BATCH_ENTRY_IDS,
    MAX_PAGE_SIZE
} from '../../alarms.constants';

/**
 * Query parameters for `GET /api/alarms/findings`. Filters are optional and
 * intersected. With no `state`, resolved findings are excluded — they are
 * history, reachable only by asking for them by name.
 */
export class ListFindingsQueryDto {
    @ApiPropertyOptional({
        enum: [...FINDING_STATES],
        description:
            'Restrict to one state. Omitted, everything except `resolved`.'
    })
    @IsOptional()
    @IsIn([...FINDING_STATES])
    state?: FindingState;

    @ApiPropertyOptional({ type: String, format: 'uuid' })
    @IsOptional()
    @IsUUID()
    ruleId?: string;

    @ApiPropertyOptional({ enum: [...ALARM_SEVERITIES] })
    @IsOptional()
    @IsIn([...ALARM_SEVERITIES])
    severity?: AlarmSeverity;

    @ApiPropertyOptional({ type: 'integer', minimum: 1, default: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number;

    @ApiPropertyOptional({
        type: 'integer',
        minimum: 1,
        maximum: MAX_PAGE_SIZE,
        default: DEFAULT_PAGE_SIZE
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(MAX_PAGE_SIZE)
    pageSize?: number;
}

/**
 * Query parameters for `GET /api/alarms/findings/by-entry` — the batch the
 * records column and the editor widget read.
 *
 * Comma-separated rather than repeated params because it rides in a URL a
 * TanStack Query key is built from, and one stable string keys better than an
 * array whose order can vary.
 */
export class FindingsByEntryQueryDto {
    @ApiPropertyOptional({
        type: String,
        description:
            'Comma-separated entry ids, at most ' +
            `${MAX_BATCH_ENTRY_IDS} — one records page's worth.`
    })
    @IsOptional()
    @Transform(({ value }) =>
        typeof value === 'string'
            ? value
                  .split(',')
                  .map((id) => id.trim())
                  .filter(Boolean)
            : value
    )
    @IsArray()
    @ArrayMaxSize(MAX_BATCH_ENTRY_IDS)
    @IsUUID('4', { each: true })
    entryIds?: string[];
}
