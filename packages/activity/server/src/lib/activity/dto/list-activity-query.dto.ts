import { Transform, Type } from 'class-transformer';
import {
    IsArray,
    IsIn,
    IsInt,
    IsISO8601,
    IsOptional,
    IsString,
    IsUUID,
    Max,
    MaxLength,
    Min
} from 'class-validator';
import {
    MAX_PAGE_SIZE,
    SORTABLE_FIELDS,
    SORT_ORDERS,
    type SortableField,
    type SortOrder
} from '../activity.constants';

/**
 * Query parameters for `GET /api/activity`. All filters are optional and
 * intersected (AND). Pagination is 1-based; the service applies the defaults
 * (page 1, {@link DEFAULT_PAGE_SIZE}) so the contract has one source of truth.
 * `@Type`/`@Transform` coerce the raw query strings — the host's global
 * `ValidationPipe` transforms but does not implicitly convert.
 */
export class ListActivityQueryDto {
    /** Restrict to one subject kind (e.g. `'user'`). */
    @IsOptional()
    @IsString()
    @MaxLength(255)
    subjectType?: string;

    /** Restrict to one subject id (a specific entity's history). */
    @IsOptional()
    @IsString()
    @MaxLength(255)
    subjectId?: string;

    /** Restrict to one actor. */
    @IsOptional()
    @IsUUID()
    actorId?: string;

    /**
     * Restrict to one or more event kinds. Accepts a comma-separated list
     * (`?kind=user.invited,user.suspended`) → matched with `IN`. Kinds are
     * owned by the emitting plugins, so this is validated as free text, not
     * against a central catalogue.
     */
    @IsOptional()
    @Transform(({ value }) =>
        typeof value === 'string'
            ? value
                  .split(',')
                  .map((part) => part.trim())
                  .filter(Boolean)
            : value
    )
    @IsArray()
    @IsString({ each: true })
    @MaxLength(255, { each: true })
    kind?: string[];

    /** Case-insensitive substring search over the actor email snapshot. */
    @IsOptional()
    @IsString()
    @MaxLength(255)
    actorEmail?: string;

    /** Inclusive lower bound on the event time (ISO 8601). */
    @IsOptional()
    @IsISO8601()
    from?: string;

    /** Inclusive upper bound on the event time (ISO 8601). */
    @IsOptional()
    @IsISO8601()
    to?: string;

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

    /** Column to sort by (whitelisted). Defaults to `at`. */
    @IsOptional()
    @IsIn(SORTABLE_FIELDS)
    sort?: SortableField;

    /** Sort direction. Defaults to `desc`. */
    @IsOptional()
    @IsIn(SORT_ORDERS)
    order?: SortOrder;
}
