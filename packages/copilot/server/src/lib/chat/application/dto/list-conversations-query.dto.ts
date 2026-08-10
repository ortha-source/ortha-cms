import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

/**
 * Query parameters for `GET /api/copilot/conversations`.
 *
 * Every property is declared because the host's `ValidationPipe` runs with
 * `forbidNonWhitelisted` — an undeclared key is a 400 naming it.
 */
export class ListConversationsQueryDto {
    /**
     * List archived threads instead of active ones. Omitted, the caller gets
     * their active threads — the list the rail renders.
     *
     * The two sets are **disjoint by design**: archiving is "hide this from the
     * list", so an archived thread appearing in the default list alongside its
     * active siblings would defeat the whole point of the flag.
     */
    @ApiPropertyOptional({
        type: Boolean,
        default: false,
        description:
            'List archived threads instead of active ones. Defaults to false.'
    })
    @IsOptional()
    // A query parameter is a string, and `Boolean('false')` is `true` — the
    // exact coercion trap `transform: true` alone walks into. Compare instead.
    @Transform(({ value }) => value === true || value === 'true')
    @IsBoolean()
    archived?: boolean;
}
