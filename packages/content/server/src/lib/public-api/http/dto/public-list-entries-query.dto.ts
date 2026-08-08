import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
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
} from '../../../entries/entries.constants';

/** Longest accepted locale slug (BCP-47's practical bound). */
const LOCALE_MAX_LENGTH = 35;

/** Longest accepted free-text search needle — matches the admin list's cap. */
const SEARCH_MAX_LENGTH = 255;

/**
 * The one parameter every public read accepts: which locale to read. Shared by
 * the list and the single-entry route so the slug is declared once.
 */
export class PublicEntryQueryDto {
    /**
     * Locale slug the read targets, on a localized type. Extension-owned:
     * forwarded verbatim to the bound `CONTENT_ENTRY_EXTENSION`, which
     * validates it; absent means the configured default locale.
     */
    @ApiPropertyOptional({
        type: String,
        maxLength: LOCALE_MAX_LENGTH,
        example: 'en',
        description:
            "Locale slug the read targets. Validated by the localization plugin (unknown → 400); absent means the default locale. Ignored on types that aren't localized."
    })
    @IsOptional()
    @IsString()
    @MaxLength(LOCALE_MAX_LENGTH)
    locale?: string;
}

/**
 * Query parameters for `GET /api/v1/content/:typeName` — search, filter, sort,
 * paginate, locale. `search` and `filter` use the **same** shapes as the admin
 * records list, so one query language covers both surfaces.
 *
 * `@Type` coerces the raw query strings; the host's global `ValidationPipe`
 * transforms but does not implicitly convert, and rejects any key not declared
 * here.
 */
export class PublicListEntriesQueryDto extends PublicEntryQueryDto {
    /** Free-text search across the type's text-like columns. */
    @ApiPropertyOptional({
        type: String,
        maxLength: SEARCH_MAX_LENGTH,
        description:
            "Free-text, case-insensitive search across the type's text-like columns (text / richtext / select). LIKE metacharacters are matched literally."
    })
    @IsOptional()
    @IsString()
    @MaxLength(SEARCH_MAX_LENGTH)
    search?: string;

    /**
     * Structured filter tree as a JSON string, the same shape the admin's
     * query builder emits. Length-capped here as a first line of defence; the
     * engine's own node/depth caps bound the parsed shape.
     */
    @ApiPropertyOptional({
        type: String,
        maxLength: FILTER_MAX_LENGTH,
        example:
            '{"and":[{"field":"featured","op":"eq","value":true},{"field":"publishedAt","op":"gte","value":"2026-01-01"}]}',
        description:
            'Structured filter tree as a JSON string, validated against the type’s derived filter schema. Filterable: the type’s own scalar fields plus `id`, `createdAt`, `updatedAt`, `publishedAt`, and `locale`. `status` is NOT filterable — this API serves published entries only, so the rule could only ever be a no-op or match nothing. Malformed or unknown fields → 400.'
    })
    @IsOptional()
    @IsString()
    @MaxLength(FILTER_MAX_LENGTH)
    filter?: string;
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
     * Sort spec: a whitelisted column id (ascending) or `-`-prefixed
     * (descending). The whitelist is the envelope timestamps, `publishedAt`,
     * `locale`, and the type's scalar fields; anything else falls back to
     * newest-updated first. `id` is always the tiebreaker.
     */
    @ApiPropertyOptional({
        type: String,
        maxLength: 255,
        example: '-publishedAt',
        description:
            'Sort spec: a whitelisted column id (ascending) or `-`-prefixed (descending). Unknown keys fall back to `-updatedAt`; `id` is always the tiebreaker.'
    })
    @IsOptional()
    @IsString()
    @MaxLength(255)
    sort?: string;
}
