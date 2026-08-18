import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    ArrayMaxSize,
    ArrayNotEmpty,
    IsArray,
    IsIn,
    IsOptional,
    IsUUID,
    ValidateNested
} from 'class-validator';
import {
    BULK_MAX_IDS,
    BULK_MAX_SAVE_ITEMS
} from '../../../entries/entries.constants';
import { BULK_SAVE_OP, type BulkSaveOp } from '../../types/public-bulk';
import { PublicSaveEntryDto } from './public-save-entry.dto';

/** The two operations a bulk-save item may name explicitly. */
const BULK_SAVE_OPS = Object.values(BULK_SAVE_OP);

/**
 * One entry in a bulk save — a {@link PublicSaveEntryDto} plus the addressing a
 * single-entry write takes from its URL.
 *
 * **It extends the single-entry body rather than restating it**, so `values`,
 * `relations`, `locale` and `localeGroupId` mean exactly what they mean on
 * `POST`/`PATCH` and cannot drift from them — including the delta caps, which a
 * hand-rolled item schema would have quietly dropped.
 */
export class PublicBulkSaveItemDto extends PublicSaveEntryDto {
    /**
     * The entry to update — the `:id` of the single-entry `PATCH`. Absent on a
     * create.
     */
    @ApiPropertyOptional({
        type: String,
        format: 'uuid',
        description:
            'The entry to update — what you would put in the `PATCH` path. Absent means this item creates an entry.'
    })
    @IsOptional()
    @IsUUID()
    id?: string;

    /**
     * What this item does, when the addressing alone does not say.
     *
     * Only ever **required** for the one genuinely ambiguous shape: a
     * `localeGroupId` with no `id`, which is either "create this record's row in
     * another language" or "update the row this group already has in `locale`".
     * Every other item infers it (see `resolveBulkSaveOp`), because making a
     * plain list of new entries carry `op: "create"` on every element is noise
     * for a rule that has exactly one exception.
     */
    @ApiPropertyOptional({
        enum: BULK_SAVE_OPS,
        description:
            'What this item does. Inferred when the item is unambiguous — an `id` means update, neither `id` nor `localeGroupId` means create — and **required** when only `localeGroupId` is given, which could be either creating that record’s row in a new locale or updating the row it already has there.'
    })
    @IsOptional()
    @IsIn(BULK_SAVE_OPS)
    op?: BulkSaveOp;
}

/**
 * Body of `POST /v1/content/:typeName/bulk` — the entries to save.
 *
 * Capped at {@link BULK_MAX_SAVE_ITEMS}, which is deliberately lower than the
 * id-only bulk actions' cap: every item here carries a whole document and
 * provokes its own write transaction.
 */
export class PublicBulkSaveDto {
    /** The entries to create and/or update, in the order they should be tried. */
    @ApiProperty({
        type: [PublicBulkSaveItemDto],
        minItems: 1,
        maxItems: BULK_MAX_SAVE_ITEMS,
        description: `The entries to save, applied in order and reported back positionally. Non-empty and capped at ${BULK_MAX_SAVE_ITEMS} — each item is a full document and its own write, so the cap bounds both the body and the work one request can start.`
    })
    @IsArray()
    @ArrayNotEmpty()
    @ArrayMaxSize(BULK_MAX_SAVE_ITEMS)
    @ValidateNested({ each: true })
    @Type(() => PublicBulkSaveItemDto)
    items!: PublicBulkSaveItemDto[];
}

/**
 * Body of the public bulk **actions** — `bulk/publish`, `bulk/unpublish`,
 * `bulk/delete`: the entry ids to act on.
 *
 * `{ ids }` rather than the save endpoint's `{ items }`, because these carry no
 * document — and because it is the shape the admin's bulk routes have always
 * taken, so a consumer moving between the two surfaces learns one body, not
 * two. Capped at {@link BULK_MAX_IDS}, the same bound those routes apply.
 *
 * Entry **ids**, not translation groups: a group names a record across
 * languages, and publishing "the record" would mean publishing translations the
 * caller never listed. Address the rows themselves, one locale at a time.
 */
export class PublicBulkIdsDto {
    /** Entry ids to act on. */
    @ApiProperty({
        type: [String],
        format: 'uuid',
        minItems: 1,
        maxItems: BULK_MAX_IDS,
        example: ['3f1a7c1e-9d2b-4a6f-8c11-5b8e2f0d7a91'],
        description: `Entry ids to act on — non-empty and capped at ${BULK_MAX_IDS}. Ids outside this workspace simply do not match; nothing distinguishes them from ids that never existed.`
    })
    @IsArray()
    @ArrayNotEmpty()
    @ArrayMaxSize(BULK_MAX_IDS)
    @IsUUID('4', { each: true })
    ids!: string[];
}
