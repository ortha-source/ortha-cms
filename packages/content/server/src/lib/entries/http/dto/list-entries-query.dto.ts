import { ApiPropertyOptional } from '@nestjs/swagger';
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
    DEFAULT_PAGE_SIZE,
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

/** Longest accepted locale slug (BCP-47's practical bound). */
const LOCALE_MAX_LENGTH = 35;

/**
 * Query parameters for `GET /api/content/:typeName`. Pagination is 1-based; the
 * service applies the defaults (page 1, {@link DEFAULT_PAGE_SIZE}) so the
 * contract has one source of truth. `@Type` coerces the raw query strings — the
 * host's global `ValidationPipe` transforms but does not implicitly convert.
 */
export class ListEntriesQueryDto {
    /** Free-text search across the type's text-like columns (text/richtext/select). */
    @ApiPropertyOptional({
        type: String,
        maxLength: 255,
        description:
            "Free-text ILIKE search across the type's text-like columns (text/richtext/select)."
    })
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
    @ApiPropertyOptional({
        type: String,
        maxLength: FILTER_MAX_LENGTH,
        example:
            '{"op":"and","rules":[{"field":"author.name","op":"eq","value":"Ada"}]}',
        description:
            "Structured filter tree as a JSON string, validated against the type's derived filter schema (relation paths included). Malformed → 400."
    })
    @IsOptional()
    @IsString()
    @MaxLength(FILTER_MAX_LENGTH)
    filter?: string;

    /** Sort spec: a column id (ascending) or `-`-prefixed (descending). */
    @ApiPropertyOptional({
        type: String,
        maxLength: 255,
        example: '-updatedAt',
        description:
            'Sort spec: a whitelisted column id (ascending) or `-`-prefixed (descending). `id` is always the tiebreaker.'
    })
    @IsOptional()
    @IsString()
    @MaxLength(255)
    sort?: string;

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

    /** Rows per page, capped at {@link MAX_PAGE_SIZE}. */
    @ApiPropertyOptional({
        type: 'integer',
        minimum: 1,
        maximum: MAX_PAGE_SIZE,
        default: DEFAULT_PAGE_SIZE,
        description: `Rows per page, capped at ${MAX_PAGE_SIZE}.`
    })
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
    @ApiPropertyOptional({
        enum: [DELETED_ONLY],
        description:
            '`only` lists soft-deleted rows (the trash view) instead of live ones. Meaningful only for paranoid types; absent lists live rows.'
    })
    @IsOptional()
    @IsIn([DELETED_ONLY])
    deleted?: typeof DELETED_ONLY;

    /**
     * `preview` includes a capped {@link RELATIONS_PREVIEW} of each requested
     * relation field's links on every row. Absent (the default) returns no
     * relation data, exactly as before.
     */
    @ApiPropertyOptional({
        enum: [RELATIONS_PREVIEW],
        description:
            "`preview` adds a capped page of each requested relation field's links to every row. Opt-in: absent returns no relation data."
    })
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
    @ApiPropertyOptional({
        type: String,
        maxLength: RELATION_FIELDS_MAX_LENGTH,
        example: 'author,tags',
        description:
            'Comma-separated relation field names to preview. Ignored without `?relations=preview`; unknown names are dropped.'
    })
    @IsOptional()
    @IsString()
    @MaxLength(RELATION_FIELDS_MAX_LENGTH)
    relationFields?: string;

    /**
     * Locale slug the list targets — an **extension-owned** param this package
     * declares (the strict ValidationPipe rejects undeclared keys) but never
     * interprets: it's forwarded to the bound `CONTENT_ENTRY_EXTENSION`, which
     * validates and applies it. Ignored when no extension is bound or the type
     * isn't localized.
     */
    @ApiPropertyOptional({
        type: String,
        maxLength: LOCALE_MAX_LENGTH,
        example: 'en',
        description:
            "Locale slug the list targets. Extension-owned: forwarded verbatim to the bound `CONTENT_ENTRY_EXTENSION`, which validates it (unknown → 400). Ignored when no extension is bound or the type isn't localized."
    })
    @IsOptional()
    @IsString()
    @MaxLength(LOCALE_MAX_LENGTH)
    locale?: string;

    /**
     * `default` widens the locale scope to fall back to the default locale
     * where the requested one is missing (the relation picker's mode).
     * Extension-owned, like {@link locale}.
     */
    @ApiPropertyOptional({
        enum: ['default'],
        description:
            '`default` widens the locale scope to fall back to the default locale where the requested one is missing (the relation picker’s mode).'
    })
    @IsOptional()
    @IsIn(['default'])
    localeFallback?: string;
}
