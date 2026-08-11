import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/** Window used when a request names none — matches the page's default range. */
export const DEFAULT_INSIGHTS_DAYS = 30;

/**
 * Longest window an Insights read may ask for.
 *
 * Bounded because every one of these endpoints fans out across each content
 * type's table: an unbounded `?days=` would let a single request scan the whole
 * history of every collection in the workspace.
 */
export const MAX_INSIGHTS_DAYS = 365;

/** `?days=` — the window an Insights read reports over. */
export class InsightsRangeQueryDto {
    @ApiPropertyOptional({
        type: 'integer',
        minimum: 1,
        maximum: MAX_INSIGHTS_DAYS,
        default: DEFAULT_INSIGHTS_DAYS,
        description:
            'How many days back to report over. Bucket width is chosen from this: up to 31 days is grouped by day, up to 120 by week, beyond that by month.',
        example: 30
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(MAX_INSIGHTS_DAYS)
    days?: number;
}
