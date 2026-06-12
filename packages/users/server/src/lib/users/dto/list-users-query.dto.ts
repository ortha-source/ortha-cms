import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { MAX_PAGE_SIZE } from '../users.constants';

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
    search?: string;

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
