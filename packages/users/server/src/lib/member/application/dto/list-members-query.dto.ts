import { Type } from 'class-transformer';
import {
    IsIn,
    IsInt,
    IsOptional,
    IsString,
    Max,
    MaxLength,
    Min
} from 'class-validator';
import { FILTER_MAX_LENGTH, MAX_PAGE_SIZE } from '../../member.constants';

/** Account statuses a caller may filter the list by. */
const FILTERABLE_STATUSES = ['pending', 'active', 'disabled'] as const;

/**
 * Query parameters for `GET /api/users`. Pagination is 1-based; the query
 * service applies the defaults (page 1, {@link DEFAULT_PAGE_SIZE}) so the
 * contract has one source of truth. `@Type` coerces the raw query strings —
 * the host's global `ValidationPipe` transforms but does not implicitly convert.
 */
export class ListMembersQueryDto {
    /** Case-insensitive name/email substring filter. */
    @IsOptional()
    @IsString()
    @MaxLength(255)
    search?: string;

    /**
     * Restrict to a single account status. The members grid omits it (showing
     * every status); the workspace member typeahead passes `active` so
     * disabled/pending accounts aren't offered as assignable members.
     */
    @IsOptional()
    @IsIn(FILTERABLE_STATUSES)
    status?: (typeof FILTERABLE_STATUSES)[number];

    /**
     * Structured filter tree as a JSON string (`?filter=<json>`), produced by
     * the admin query builder and validated against the member filter schema by
     * `parseFilterTree`. Length-capped here as a first line of defence; the
     * engine's node/depth caps bound the parsed shape. AND-ed with
     * `search` / `status`.
     */
    @IsOptional()
    @IsString()
    @MaxLength(FILTER_MAX_LENGTH)
    filter?: string;

    /** 1-based page number. */
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number;

    /** Rows per page, capped at {@link MAX_PAGE_SIZE}. */
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(MAX_PAGE_SIZE)
    pageSize?: number;
}
