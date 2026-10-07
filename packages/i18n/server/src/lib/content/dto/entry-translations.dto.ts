import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsUUID } from 'class-validator';
import { ENTRY_TRANSLATIONS_MAX_IDS } from '../../i18n.constants';

/**
 * Body for `POST /api/i18n/content/:typeName/translations` — the records
 * selection's batched read of each entry's translation group (POST, not GET: a
 * selection of uuids outgrows a query string). Capped like content's own bulk
 * endpoints, so a request can't fan out unbounded.
 */
export class EntryTranslationsDto {
    /** Entry ids whose translation groups to read. */
    @ApiProperty({
        type: [String],
        format: 'uuid',
        maxItems: ENTRY_TRANSLATIONS_MAX_IDS,
        example: ['3f1a7c1e-9d2b-4a6f-8c11-5b8e2f0d7a91'],
        description: `Entry ids whose translation groups to read — a records selection, capped at ${ENTRY_TRANSLATIONS_MAX_IDS}.`
    })
    @IsArray()
    @ArrayMaxSize(ENTRY_TRANSLATIONS_MAX_IDS)
    @IsUUID(undefined, { each: true })
    ids!: string[];
}
