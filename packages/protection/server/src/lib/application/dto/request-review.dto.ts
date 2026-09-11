import { ApiProperty } from '@nestjs/swagger';
import {
    ArrayMaxSize,
    ArrayMinSize,
    ArrayUnique,
    IsArray,
    IsUUID
} from 'class-validator';

/** The most reviewers one request may name. */
export const REVIEWERS_MAX = 50;

/**
 * The body of `POST /protection/entries/:type/:id/request` — who is asked, and
 * nothing else.
 *
 * There is no note. Review notes were removed: a request names people, the
 * entry and its revisions are what they look at, and a sentence beside the ask
 * was a second place for the actual discussion to half-happen.
 *
 * At least one reviewer. A request naming nobody is not a request, and it would
 * sit in nobody's "Waiting on me". Whether each id is somebody who may review is
 * the service's check, not a shape the DTO can see.
 */
export class RequestReviewDto {
    @ApiProperty({
        type: [String],
        format: 'uuid',
        minItems: 1,
        maxItems: REVIEWERS_MAX,
        description:
            'The members asked to review. Each must be another member of the ' +
            'workspace holding `content:approve` — the list ' +
            '`GET …/reviewers` returns. Replaces the reviewers on an open ' +
            'request.'
    })
    @IsArray()
    @ArrayMinSize(1)
    @ArrayMaxSize(REVIEWERS_MAX)
    @ArrayUnique()
    @IsUUID('all', { each: true })
    reviewerIds!: string[];
}
