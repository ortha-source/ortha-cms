import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../activity.constants';

/**
 * Query parameters for `GET /api/activity/entries/:entryId`.
 *
 * Paging only. The subject is the URL, the workspace is the header, and every
 * other filter the full log offers — actor, kind, date range — would be a way
 * of asking a narrower question about a history short enough to read.
 */
export class EntryActivityQueryDto {
    /** 1-based page number. */
    @ApiPropertyOptional({
        type: 'integer',
        minimum: 1,
        default: 1,
        description: '1-based page number.'
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number;

    /** Rows per page, capped at {@link MAX_PAGE_SIZE}. */
    @ApiPropertyOptional({
        type: 'integer',
        minimum: 1,
        maximum: MAX_PAGE_SIZE,
        default: DEFAULT_PAGE_SIZE,
        description: `Rows per page, capped at ${MAX_PAGE_SIZE}.`
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(MAX_PAGE_SIZE)
    pageSize?: number;
}
