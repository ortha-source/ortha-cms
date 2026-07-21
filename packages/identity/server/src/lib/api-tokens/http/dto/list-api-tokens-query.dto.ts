import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

/** Hard cap on tokens returned per page. */
export const API_TOKENS_MAX_PAGE_SIZE = 100;

/** Default page size when the client omits `pageSize`. */
export const API_TOKENS_DEFAULT_PAGE_SIZE = 25;

/** Query parameters for `GET /api/api-tokens`. */
export class ListApiTokensQueryDto {
    /** Restrict the list to one workspace's tokens; omit for all workspaces. */
    @IsOptional()
    @IsUUID()
    workspaceId?: string;

    /** 1-based page number. */
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number;

    /** Rows per page, capped at {@link API_TOKENS_MAX_PAGE_SIZE}. */
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(API_TOKENS_MAX_PAGE_SIZE)
    pageSize?: number;
}
