import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsISO8601, IsOptional, Max, Min } from 'class-validator';

/** Query parameters for `GET /api/activity/dead-letters`. */
export class DeadLettersQueryDto {
    /**
     * How many parked events to return, newest first.
     *
     * Capped rather than paginated: `total` already answers "how bad is it",
     * and a dead-letter list long enough to page through is a different
     * problem from the one this route exists to surface.
     */
    @ApiPropertyOptional({
        type: 'integer',
        minimum: 1,
        maximum: 200,
        default: 50,
        description: 'How many parked events to return, newest first.'
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(200)
    limit?: number;

    /** Only events that occurred at or after this time (ISO 8601). */
    @ApiPropertyOptional({
        type: String,
        format: 'date-time',
        description:
            'Only events that occurred at or after this time — for a caller that has already acknowledged older failures.'
    })
    @IsOptional()
    @IsISO8601()
    since?: string;
}
