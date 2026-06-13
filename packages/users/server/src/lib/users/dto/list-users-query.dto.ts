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
import { MAX_PAGE_SIZE } from '../users.constants';

/** Account statuses a caller may filter the list by. */
const FILTERABLE_STATUSES = ['pending', 'active', 'disabled'] as const;

/**
 * Query parameters for `GET /api/users`. Pagination is 1-based; the service
 * applies the defaults (page 1, {@link DEFAULT_PAGE_SIZE}) so the contract has
 * one source of truth. `@Type` coerces the raw query strings — the host's
 * global `ValidationPipe` transforms but does not implicitly convert.
 */
export class ListUsersQueryDto {
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
