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
import {
    FIELDS_MAX_LENGTH,
    FILTER_MAX_LENGTH,
    MAX_PAGE_SIZE
} from '../../entries.constants';

/** `?deleted=only` flips the list to the trash view (soft-deleted rows). */
export const DELETED_ONLY = 'only';

/**
 * `?relations=preview` opts the list into a capped relation preview per row.
 * Opt-in because the relation **picker** reuses this endpoint to list candidates
 * — it would otherwise pay for relation expansion on every keystroke.
 */
export const RELATIONS_PREVIEW = 'preview';

/** Upper bound on the `?relationFields=` list (a comma-separated field list). */
const RELATION_FIELDS_MAX_LENGTH = 1024;

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

    /**
     * `preview` includes a capped {@link RELATIONS_PREVIEW} of each requested
     * relation field's links on every row. Absent (the default) returns no
     * relation data, exactly as before.
     */
    @IsOptional()
    @IsIn([RELATIONS_PREVIEW])
    relations?: typeof RELATIONS_PREVIEW;

    /**
     * Comma-separated relation field names to preview — the table's **visible**
     * relation columns, so a hidden column costs nothing. Ignored without
     * `?relations=preview`. Names are matched against the type's own relation
     * fields and anything unknown is dropped, so the raw string never reaches a
     * query.
     */
    @IsOptional()
    @IsString()
    @MaxLength(RELATION_FIELDS_MAX_LENGTH)
    relationFields?: string;

    /**
     * Comma-separated field names to return in each row's `values` bag —
     * sparse fieldsets, so a list that only renders a title needn't ship every
     * richtext body. Absent (the default) returns the whole record. Names are
     * validated against the type's column-owning fields; an unknown one is a
     * **400** rather than a silent drop (see `parseFieldSelection`). The
     * envelope (`id`, timestamps, `status`, `locale`) is always returned.
     */
    @IsOptional()
    @IsString()
    @MaxLength(FIELDS_MAX_LENGTH)
    fields?: string;

    /**
     * Locale slug the list targets — an **extension-owned** param this package
     * declares (the strict ValidationPipe rejects undeclared keys) but never
     * interprets: it's forwarded to the bound `CONTENT_ENTRY_EXTENSION`, which
     * validates and applies it. Ignored when no extension is bound or the type
     * isn't localized.
     */
    @IsOptional()
    @IsString()
    @MaxLength(35)
    locale?: string;

    /**
     * `default` widens the locale scope to fall back to the default locale
     * where the requested one is missing (the relation picker's mode).
     * Extension-owned, like {@link locale}.
     */
    @IsOptional()
    @IsIn(['default'])
    localeFallback?: string;
}
