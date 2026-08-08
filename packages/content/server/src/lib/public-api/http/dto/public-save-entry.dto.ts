import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsObject,
    IsOptional,
    IsString,
    IsUUID,
    MaxLength
} from 'class-validator';
import type { RelationDelta } from '../../../entries/types/entry-list-view';
import {
    IsRelationDeltaMap,
    MAX_DELTA_FIELDS,
    MAX_DELTA_IDS
} from '../../../entries/http/dto/relation-delta-map.validator';

/** Longest accepted locale slug (BCP-47's practical bound). */
const LOCALE_MAX_LENGTH = 35;

/** OpenAPI schema of one uuid-array leg of a relation delta. */
const UUID_ARRAY_SCHEMA = {
    type: 'array',
    maxItems: MAX_DELTA_IDS,
    items: { type: 'string', format: 'uuid' }
} as const;

/**
 * Body for the public write routes — `POST /v1/content/:typeName` and
 * `PATCH /v1/content/:typeName/:id`.
 *
 * Its own class rather than a re-export of the admin's `SaveEntryDto`, for the
 * same reason `PublicEntry` is not `EntryRecord`: this is a **published
 * contract** an external client codes against, so it must be free to stay still
 * while the editor's internal shape moves. The two happen to agree today, and
 * the *validators* are shared (`IsRelationDeltaMap` is imported, not restated)
 * so the accepted delta shape cannot drift — only the documented surface is
 * duplicated.
 *
 * What is deliberately NOT settable here: `status`, `publishedAt`, `deletedAt`.
 * Publishing is its own route with its own permission, and the other two are
 * stamped by the server. `toColumns` projects only keys declared on the type, so
 * a reserved key in `values` is dropped before storage rather than honoured.
 */
export class PublicSaveEntryDto {
    /** Field values keyed by field name. */
    @ApiProperty({
        type: 'object',
        additionalProperties: true,
        example: { title: 'Hello world', coverImage: null },
        description:
            'Field values keyed by field name — the per-type contract, so this is structurally just an object. Contents are validated against the content type’s field specs (a failure is a 422 carrying per-field issues). A **media** field takes asset ids (one, or an array) from `POST /v1/media/assets`; an id the workspace does not own, or one the field’s `accept` rule excludes, is a 422. An owning **single** relation is set here by target id. Reserved envelope keys (`status`, `publishedAt`, `deletedAt`, `locale`, `localeGroupId`) are not settable.'
    })
    @IsObject()
    values!: Record<string, unknown>;

    /**
     * Per-field relation deltas — the assign / unassign half of the write API.
     * Many and inverse relations only; an owning single relation is set through
     * `values`.
     */
    @ApiPropertyOptional({
        type: 'object',
        maxProperties: MAX_DELTA_FIELDS,
        additionalProperties: {
            type: 'object',
            properties: {
                link: UUID_ARRAY_SCHEMA,
                unlink: UUID_ARRAY_SCHEMA,
                order: UUID_ARRAY_SCHEMA,
                by: { type: 'string', enum: ['id', 'localeGroup'] }
            },
            additionalProperties: false
        },
        example: {
            tags: {
                link: ['9c4b1e77-2f0a-4d3b-8e6c-1a5f7b2d9e04'],
                unlink: ['1f9a3c55-7b21-4e08-9d4a-6c2e8b1f0a37']
            }
        },
        description: `Relation changes, keyed by relation field: \`link\` assigns, \`unlink\` unassigns, \`order\` reorders. A **delta**, not a replacement — ids you do not mention are left alone, so a record with thousands of links never has to be sent whole. Many-to-many and inverse relations only; naming an owning single relation here is a 400 (set it through \`values\`). At most ${MAX_DELTA_FIELDS} fields per save and ${MAX_DELTA_IDS} ids per array; \`order\` is accepted on the owning side only. Every id must name an entry in the same workspace, or the save is a 422.\n\n**Locales.** When both this type and the target are localized, a link may not cross locales — the English article links the English tag — and a target in another locale is a 422. Set \`by: "localeGroup"\` to pass **translation group** ids instead of entry ids: each is resolved to that group's row in this entry's own locale, so a client that thinks in stories never has to keep a per-locale id map. A group with no row in this locale is a 422 telling you to translate it first.`
    })
    @IsOptional()
    @IsObject()
    @IsRelationDeltaMap()
    relations?: Record<string, RelationDelta>;

    /**
     * Locale the created row is written in — **create only**; an update never
     * re-homes a row's locale.
     */
    @ApiPropertyOptional({
        type: String,
        maxLength: LOCALE_MAX_LENGTH,
        example: 'de',
        description:
            'Locale slug the entry is created in; absent means the configured default. An unknown slug is a 400. **Create only** — an update never re-homes a row’s locale, and sending it there is ignored. Ignored on types that are not localized.'
    })
    @IsOptional()
    @IsString()
    @MaxLength(LOCALE_MAX_LENGTH)
    locale?: string;

    /**
     * The translation group a created row joins — how a **new translation of an
     * existing record** is written. Create only.
     */
    @ApiPropertyOptional({
        type: String,
        format: 'uuid',
        description:
            'The existing translation group the new row joins, making it a sibling translation — this is how you add a locale to a record you already have (take `localeGroupId` off any read, POST with it plus a different `locale`). Absent → the row starts its own fresh group. An unknown group is a 404; a locale the group already holds is a 409. **Create only.**'
    })
    @IsOptional()
    @IsUUID()
    localeGroupId?: string;
}
