import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    IsIn,
    IsInt,
    IsOptional,
    IsString,
    IsUUID,
    Max,
    MaxLength,
    Min
} from 'class-validator';
import {
    API_TOKEN_STATUSES,
    type ApiTokenStatus
} from '../../domain/api-token-status';

/** Hard cap on tokens returned per page. */
export const API_TOKENS_MAX_PAGE_SIZE = 100;

/** Default page size when the client omits `pageSize`. */
export const API_TOKENS_DEFAULT_PAGE_SIZE = 25;

/** Longest search term accepted — a token name is at most 120 characters. */
export const API_TOKENS_SEARCH_MAX_LENGTH = 120;

/** Query parameters for `GET /api/api-tokens`. */
export class ListApiTokensQueryDto {
    /**
     * Restrict the list to tokens whose workspace bucket **contains** this id;
     * omit for every token. A multi-workspace token matches under each of its
     * workspaces.
     */
    @ApiPropertyOptional({
        type: String,
        format: 'uuid',
        description:
            'Restrict the list to tokens whose workspace bucket contains this id; omit for every token. A multi-workspace token matches under each of its workspaces.'
    })
    @IsOptional()
    @IsUUID()
    workspaceId?: string;

    /** Restrict the list to one derived status; omit for every token. */
    @ApiPropertyOptional({
        enum: [...API_TOKEN_STATUSES],
        description:
            'Restrict the list to one derived status: `active` (not revoked, not past its expiry), `expired` (past its expiry, not revoked) or `revoked` (revocation wins over expiry). Omit for every token. The `summary` in the response is not narrowed by it.'
    })
    @IsOptional()
    @IsIn([...API_TOKEN_STATUSES])
    status?: ApiTokenStatus;

    /** Case-insensitive substring of the name or the display prefix. */
    @ApiPropertyOptional({
        type: String,
        maxLength: API_TOKENS_SEARCH_MAX_LENGTH,
        description:
            "Case-insensitive substring of the token's name or its non-secret display prefix. `%` and `_` match literally. The `summary` in the response is not narrowed by it."
    })
    @IsOptional()
    @IsString()
    @MaxLength(API_TOKENS_SEARCH_MAX_LENGTH)
    q?: string;

    /** 1-based page number. */
    @ApiPropertyOptional({
        type: 'integer',
        minimum: 1,
        default: 1,
        description: '1-based page number.'
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number;

    /** Rows per page, capped at {@link API_TOKENS_MAX_PAGE_SIZE}. */
    @ApiPropertyOptional({
        type: 'integer',
        minimum: 1,
        maximum: API_TOKENS_MAX_PAGE_SIZE,
        default: API_TOKENS_DEFAULT_PAGE_SIZE,
        description: `Rows per page, capped at ${API_TOKENS_MAX_PAGE_SIZE}.`
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(API_TOKENS_MAX_PAGE_SIZE)
    pageSize?: number;
}
