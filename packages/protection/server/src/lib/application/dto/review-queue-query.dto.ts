import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

/** The largest queue page the API will serve. */
export const REVIEW_QUEUE_PAGE_MAX = 100;

/**
 * `GET /api/protection/queue?mine=1&limit=&offset=`.
 *
 * `mine` is **"what did I send"**, not "what is waiting on me". The second
 * question has no server-side answer worth trusting: anyone holding
 * `content:approve` may review anything, so "waiting on me" is every open
 * request minus the ones I already voted on — which the client computes from
 * the counts and its own identity. Answering it here would mean inventing an
 * assignment model the feature deliberately does not have.
 */
export class ReviewQueueQueryDto {
    @ApiPropertyOptional({
        type: Boolean,
        description:
            'Only the requests the caller opened themselves — the “My ' +
            'requests” tab. Omitted, the queue is every open request in the ' +
            'workspace.'
    })
    @IsOptional()
    // A query string carries text, so `?mine=1` and `?mine=true` both have to
    // mean the same thing before `@IsBoolean` sees them.
    @Transform(
        ({ value }) => value === true || value === '1' || value === 'true'
    )
    @IsBoolean()
    mine?: boolean;

    @ApiPropertyOptional({
        type: 'integer',
        minimum: 1,
        maximum: REVIEW_QUEUE_PAGE_MAX,
        default: 50
    })
    @IsOptional()
    @Transform(({ value }) => (value === undefined ? value : Number(value)))
    @IsInt()
    @Min(1)
    @Max(REVIEW_QUEUE_PAGE_MAX)
    limit?: number;

    @ApiPropertyOptional({ type: 'integer', minimum: 0, default: 0 })
    @IsOptional()
    @Transform(({ value }) => (value === undefined ? value : Number(value)))
    @IsInt()
    @Min(0)
    offset?: number;
}
