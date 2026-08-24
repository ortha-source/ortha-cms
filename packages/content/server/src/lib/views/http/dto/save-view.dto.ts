import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    ArrayMaxSize,
    IsArray,
    IsBoolean,
    IsIn,
    IsInt,
    IsObject,
    IsOptional,
    IsString,
    Matches,
    Max,
    MaxLength,
    Min,
    MinLength,
    ValidateNested
} from 'class-validator';
import { Transform } from 'class-transformer';
import {
    FILTER_MAX_LENGTH,
    MAX_PAGE_SIZE
} from '../../../entries/entries.constants';
import {
    VIEW_VISIBILITY,
    VIEW_VISIBILITY_VALUES,
    type ViewVisibility
} from '../../domain/saved-view';
import {
    CONTENT_SCOPE_PREFIX,
    VIEW_COLUMN_MAX_LENGTH,
    VIEW_MAX_COLUMNS,
    VIEW_NAME_MAX_LENGTH,
    VIEW_SCOPE_MAX_LENGTH
} from '../../views.constants';
import { IsViewExtraParams } from './view-payload.validator';

/**
 * The slice a view stores. Mirrors the records page's URL params rather than
 * re-modelling them, so a saved view and a hand-edited link travel the same
 * code path. `search` and `page` are absent by design — see
 * {@link SavedViewPayload}.
 */
export class ViewPayloadDto {
    /** The `?filter=` JSON string. */
    @ApiPropertyOptional({
        type: String,
        maxLength: FILTER_MAX_LENGTH,
        example:
            '{"op":"and","rules":[{"field":"status","op":"eq","value":"review"}]}',
        description:
            'The filter tree as a JSON string, byte-identical to the `?filter=` query param. Stored opaquely and re-validated against the type when replayed.'
    })
    @IsOptional()
    @IsString()
    @MaxLength(FILTER_MAX_LENGTH)
    filter?: string;

    /** The `?sort=` spec. */
    @ApiPropertyOptional({
        type: String,
        maxLength: 255,
        example: '-updatedAt',
        description:
            'Sort spec: a column id (ascending) or `-`-prefixed (descending).'
    })
    @IsOptional()
    @IsString()
    @MaxLength(255)
    sort?: string;

    /** Rows per page. */
    @ApiPropertyOptional({
        type: 'integer',
        minimum: 1,
        maximum: MAX_PAGE_SIZE,
        example: 25,
        description: 'Rows per page this view opens with.'
    })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(MAX_PAGE_SIZE)
    pageSize?: number;

    /** Visible column ids, in display order. */
    @ApiPropertyOptional({
        type: [String],
        maxItems: VIEW_MAX_COLUMNS,
        example: ['title', 'status', 'updatedAt'],
        description:
            'Visible column ids **in display order**. Ids the type no longer has are dropped when the view is applied.'
    })
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(VIEW_MAX_COLUMNS)
    @IsString({ each: true })
    @MaxLength(VIEW_COLUMN_MAX_LENGTH, { each: true })
    columns?: string[];

    /** Slot-owned list params (e.g. the i18n plugin's `locale`). */
    @ApiPropertyOptional({
        type: 'object',
        additionalProperties: { type: 'string' },
        example: { locale: 'en' },
        description:
            'Slot-contributed list params, as a flat string map. Opaque on purpose — the keys come from plugin-registered toolbar items at runtime.'
    })
    @IsOptional()
    @IsObject()
    @IsViewExtraParams()
    extra?: Record<string, string>;
}

/** Body of `POST /api/views`. */
export class CreateViewDto {
    /**
     * The list this view is over. v1 accepts content collections only, so a
     * typo cannot quietly create a view nothing will ever list.
     */
    @ApiProperty({
        type: String,
        maxLength: VIEW_SCOPE_MAX_LENGTH,
        example: 'content:article',
        description:
            'The list this view belongs to. Must be `content:<typeName>`.'
    })
    @IsString()
    @MaxLength(VIEW_SCOPE_MAX_LENGTH)
    @Matches(new RegExp(`^${CONTENT_SCOPE_PREFIX}[A-Za-z0-9_-]+$`), {
        message: `scope must be "${CONTENT_SCOPE_PREFIX}<typeName>"`
    })
    scope!: string;

    /** Display name. */
    @ApiProperty({
        type: String,
        minLength: 1,
        maxLength: VIEW_NAME_MAX_LENGTH,
        example: 'Needs review',
        description: 'Display name, unique per person within one list.'
    })
    @IsString()
    @Transform(({ value }) =>
        typeof value === 'string' ? value.trim() : value
    )
    @MinLength(1)
    @MaxLength(VIEW_NAME_MAX_LENGTH)
    name!: string;

    /** Who may see it. Defaults to private. */
    @ApiPropertyOptional({
        enum: VIEW_VISIBILITY_VALUES,
        default: VIEW_VISIBILITY.Private,
        description:
            '`private` (only you) or `workspace` (every member). Sharing requires the `views:share` permission.'
    })
    @IsOptional()
    @IsIn(VIEW_VISIBILITY_VALUES)
    visibility?: ViewVisibility;

    /** The slice it restores. */
    @ApiProperty({
        type: () => ViewPayloadDto,
        description: 'The filter/sort/columns/page-size slice this view stores.'
    })
    @ValidateNested()
    @Type(() => ViewPayloadDto)
    payload!: ViewPayloadDto;

    /** Whether to land on this view when opening the list. */
    @ApiPropertyOptional({
        type: Boolean,
        default: false,
        description: 'Make this the caller’s default view for the list.'
    })
    @IsOptional()
    @IsBoolean()
    makeDefault?: boolean;
}

/**
 * Body of `PATCH /api/views/:id`. Every field optional — the switcher sends
 * only `payload` on “Save”, only `name` on a rename, and only `visibility` on
 * share/unshare.
 */
export class UpdateViewDto {
    /** New display name. */
    @ApiPropertyOptional({
        type: String,
        minLength: 1,
        maxLength: VIEW_NAME_MAX_LENGTH,
        example: 'Needs review'
    })
    @IsOptional()
    @IsString()
    @Transform(({ value }) =>
        typeof value === 'string' ? value.trim() : value
    )
    @MinLength(1)
    @MaxLength(VIEW_NAME_MAX_LENGTH)
    name?: string;

    /** New visibility. */
    @ApiPropertyOptional({ enum: VIEW_VISIBILITY_VALUES })
    @IsOptional()
    @IsIn(VIEW_VISIBILITY_VALUES)
    visibility?: ViewVisibility;

    /** New slice. */
    @ApiPropertyOptional({ type: () => ViewPayloadDto })
    @IsOptional()
    @ValidateNested()
    @Type(() => ViewPayloadDto)
    payload?: ViewPayloadDto;
}

/** Query of `GET /api/views`. */
export class ListViewsQueryDto {
    /** The list to return views for. */
    @ApiProperty({
        type: String,
        maxLength: VIEW_SCOPE_MAX_LENGTH,
        example: 'content:article',
        description:
            'The list to return saved views for (`content:<typeName>`).'
    })
    @IsString()
    @MaxLength(VIEW_SCOPE_MAX_LENGTH)
    @Matches(new RegExp(`^${CONTENT_SCOPE_PREFIX}[A-Za-z0-9_-]+$`), {
        message: `scope must be "${CONTENT_SCOPE_PREFIX}<typeName>"`
    })
    scope!: string;
}
