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
} from '../../../entries/entries.constants';

/** Longest accepted locale slug (BCP-47's practical bound). */
const LOCALE_MAX_LENGTH = 35;

/** Longest accepted free-text search needle — matches the admin list's cap. */
const SEARCH_MAX_LENGTH = 255;

/** Upper bound on the raw `?fields=` list (a comma-separated field list). */
const FIELDS_MAX_LENGTH = 1024;

/**
 * `?relations=preview` / `?media=preview` opt an entry read into expanding the
 * named fields. Opt-in because the cost scales with the number of expanded
 * fields, and most reads want neither.
 */
export const PREVIEW = 'preview';

/**
 * Default links / assets returned per expanded field. Matches the admin
 * preview's cap so both surfaces summarise a relation the same way.
 */
export const DEFAULT_EXPANSION_LIMIT = 20;

/**
 * What publish states a read may return. `published` is the default and the only
 * value a `read`-scope token may use; the other two need write scope.
 */
export const ENTRY_VISIBILITY = ['published', 'draft', 'any'] as const;

/** @see ENTRY_VISIBILITY */
export type EntryVisibility = (typeof ENTRY_VISIBILITY)[number];

/**
 * The one parameter every public read accepts: which locale to read. Shared by
 * the list and the single-entry route so the slug is declared once.
 */
export class PublicEntryQueryDto {
    /**
     * Which publish states to return. Defaults to `published` — the whole
     * contract of this API for an anonymous consumer.
     *
     * A **write-scoped** token may widen it, because otherwise creating a draft
     * would produce a record the creator cannot read back: the write returns it
     * once and it is then invisible forever. Narrower than "drafts are public" —
     * the widening is gated on the same scope that could have published the row
     * anyway.
     */
    @ApiPropertyOptional({
        enum: ENTRY_VISIBILITY,
        default: 'published',
        description:
            'Publish states to return. `published` (default) is all a read-only token may ask for; `draft` and `any` require a `full`-scope token, and are a 403 otherwise. Ignored on types that are not publishable — those have no publish state and every row is live.'
    })
    @IsOptional()
    @IsIn(ENTRY_VISIBILITY)
    status?: EntryVisibility;

    /** `preview` expands the relation fields named by `relationFields`. */
    @ApiPropertyOptional({
        enum: [PREVIEW],
        description:
            '`preview` expands the relation fields named by `relationFields`. Absent returns no relation data.'
    })
    @IsOptional()
    @IsIn([PREVIEW])
    relations?: typeof PREVIEW;

    /**
     * Comma-separated relation field names to expand. Each yields one capped
     * page of links plus the count of visible ones.
     */
    @ApiPropertyOptional({
        type: String,
        maxLength: FIELDS_MAX_LENGTH,
        example: 'author,tags',
        description:
            'Comma-separated relation fields to expand (ignored without `relations=preview`). Only published targets are shown or counted. A name that is not a relation field, or whose target type the workspace was not granted, is a 400.'
    })
    @IsOptional()
    @IsString()
    @MaxLength(FIELDS_MAX_LENGTH)
    relationFields?: string;

    /** `preview` expands the media fields named by `mediaFields`. */
    @ApiPropertyOptional({
        enum: [PREVIEW],
        description:
            '`preview` expands the media fields named by `mediaFields`. Absent returns no media data.'
    })
    @IsOptional()
    @IsIn([PREVIEW])
    media?: typeof PREVIEW;

    /**
     * Links returned per expanded relation field. The **true** count is always
     * reported as that field's `total`, so lowering this never hides the fact
     * that more exist.
     */
    @ApiPropertyOptional({
        type: 'integer',
        minimum: 1,
        maximum: MAX_PAGE_SIZE,
        default: DEFAULT_EXPANSION_LIMIT,
        description: `Links returned per expanded relation field (1…${MAX_PAGE_SIZE}, default ${DEFAULT_EXPANSION_LIMIT}). The field's \`total\` always reports the true count, so a low limit hides nothing. Page the rest via /relations/<field>.`
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(MAX_PAGE_SIZE)
    relationLimit?: number;

    /**
     * Assets returned per expanded media field, with the same
     * `total`-tells-the-truth guarantee as {@link relationLimit}.
     */
    @ApiPropertyOptional({
        type: 'integer',
        minimum: 1,
        maximum: MAX_PAGE_SIZE,
        default: DEFAULT_EXPANSION_LIMIT,
        description: `Assets returned per expanded media field (1…${MAX_PAGE_SIZE}, default ${DEFAULT_EXPANSION_LIMIT}). The field's \`total\` always reports the true count.`
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(MAX_PAGE_SIZE)
    mediaLimit?: number;

    /** Comma-separated media field names to expand. */
    @ApiPropertyOptional({
        type: String,
        maxLength: FIELDS_MAX_LENGTH,
        example: 'coverImage,gallery',
        description:
            'Comma-separated media fields to expand (ignored without `media=preview`). Returns asset metadata plus URLs under `/v1/media/assets/:id/raw`, which take the same bearer token as this request.'
    })
    @IsOptional()
    @IsString()
    @MaxLength(FIELDS_MAX_LENGTH)
    mediaFields?: string;

    /**
     * Comma-separated field names to return in `values` — a sparse fieldset.
     * Absent returns every value field. Selection narrows the SQL projection
     * too, so an unselected richtext column is never read, let alone sent.
     */
    @ApiPropertyOptional({
        type: String,
        maxLength: FIELDS_MAX_LENGTH,
        example: 'title,slug,publishedAt',
        description:
            'Comma-separated field names to return in `values`. Absent returns every value field. The envelope (`id`, `createdAt`, `updatedAt`, `publishedAt`, `locale`, `localeGroupId`) is always returned and is not selectable. An unknown name is a 400; so is a relation or media field, which this API cannot return yet.'
    })
    @IsOptional()
    @IsString()
    @MaxLength(FIELDS_MAX_LENGTH)
    fields?: string;

    /**
     * `preview` attaches the entry's other locale rows — the rest of its
     * translation group. Opt-in like the other expansions, and a 400 on a type
     * that isn't localized.
     */
    @ApiPropertyOptional({
        enum: [PREVIEW],
        description:
            '`preview` attaches the entry’s sibling translations (the rest of its `localeGroupId` group) as `translations`. 400 on a type that is not localized.'
    })
    @IsOptional()
    @IsIn([PREVIEW])
    translations?: typeof PREVIEW;

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
            'Structured filter tree as a JSON string, validated against the type’s derived filter schema. Filterable: the type’s own scalar fields plus `id`, `createdAt`, `updatedAt`, `publishedAt`, and — on localized types — `locale` and `localeGroupId`. `status` is NOT filterable — this API serves published entries only, so the rule could only ever be a no-op or match nothing. Malformed or unknown fields → 400.'
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
