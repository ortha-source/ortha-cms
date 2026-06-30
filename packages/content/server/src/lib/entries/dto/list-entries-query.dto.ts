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
import { FILTER_MAX_LENGTH, MAX_PAGE_SIZE } from '../entries.constants';

/** `?deleted=only` flips the list to the trash view (soft-deleted rows). */
export const DELETED_ONLY = 'only';

/**
 * Query parameters for `GET /api/content/:typeName`. Pagination is 1-based; the
 * service applies the defaults (page 1, {@link DEFAULT_PAGE_SIZE}) so the
 * contract has one source of truth. `@Type` coerces the raw query strings — the
 * host's global `ValidationPipe` transforms but does not implicitly convert.
 */
export class ListEntriesQueryDto {
    /** Free-text search across the type's text-like columns (text/richtext/select). */
    @IsOptional()
    @IsString()
    @MaxLength(255)
    search?: string;

    /**
     * Structured filter tree as a JSON string (`?filter=<json>`), produced by
     * the admin query builder and validated against the type's derived filter
     * schema by `parseFilterTree`. Length-capped here as a first line of
     * defence; the engine's node/depth caps bound the parsed shape.
     */
    @IsOptional()
    @IsString()
    @MaxLength(FILTER_MAX_LENGTH)
    filter?: string;

    /** Sort spec: a column id (ascending) or `-`-prefixed (descending). */
    @IsOptional()
    @IsString()
    @MaxLength(255)
    sort?: string;

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

    /**
     * `only` lists soft-deleted rows (the trash view) instead of live ones.
     * Meaningful only for paranoid types; ignored otherwise. Absent (the
     * default) lists live rows.
     */
    @IsOptional()
    @IsIn([DELETED_ONLY])
    deleted?: typeof DELETED_ONLY;
}
