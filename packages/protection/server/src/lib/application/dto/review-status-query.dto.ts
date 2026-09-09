import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsString, IsUUID } from 'class-validator';

/** How many entry ids one status read may name. */
export const REVIEW_STATUS_MAX_IDS = 100;

/**
 * `GET /api/protection/entries/:typeName/status?ids=…`.
 *
 * `ids` arrives comma-separated rather than as a repeated parameter because the
 * caller is a records column reading the page it has already rendered, and a URL
 * with twenty-five `ids[]=` pairs is one a proxy is more likely to truncate.
 */
export class ReviewStatusQueryDto {
    /**
     * The entries to report on.
     *
     * Bounded, and the bound is above the records list's largest page: a request
     * naming more than a page is not a column asking about what it drew, and an
     * unbounded `IN (…)` is a way to make one request cost a table scan.
     */
    @ApiProperty({
        type: String,
        description:
            'Comma-separated entry ids to report on. At most ' +
            `${REVIEW_STATUS_MAX_IDS}, which is above the records list's largest page.`,
        example: '0f4c…,7a21…'
    })
    @Transform(({ value }) =>
        typeof value === 'string'
            ? value
                  .split(',')
                  .map((id) => id.trim())
                  .filter(Boolean)
            : value
    )
    @IsString({ each: true })
    @IsUUID('4', { each: true })
    @ArrayMaxSize(REVIEW_STATUS_MAX_IDS)
    ids!: string[];
}
