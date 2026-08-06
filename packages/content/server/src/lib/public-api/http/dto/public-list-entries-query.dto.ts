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
    MAX_PAGE_SIZE
} from '../../../entries/entries.constants';

/** Longest accepted locale slug (BCP-47's practical bound). */
const LOCALE_MAX_LENGTH = 35;

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
 * Query parameters for `GET /api/v1/content/:typeName`. Deliberately small —
 * page, sort, locale — because this is a published contract: every knob here is
 * one the API promises to keep. Free-text search and the structured `?filter=`
 * tree stay on the admin list until the public surface genuinely needs them.
 *
 * `@Type` coerces the raw query strings; the host's global `ValidationPipe`
 * transforms but does not implicitly convert, and rejects any key not declared
 * here.
 */
export class PublicListEntriesQueryDto extends PublicEntryQueryDto {
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
