import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsUUID } from 'class-validator';
import { BULK_MAX_IDS } from '../../entries.constants';

/**
 * Body for the bulk endpoints (`/bulk/publish`, `/bulk/unpublish`,
 * `/bulk/delete`, `/bulk/restore`, and the publish dry run): the set of entry
 * ids to act on. Non-empty, uuid-typed, and capped at {@link BULK_MAX_IDS} so a
 * single request can't fan out unbounded work.
 */
export class BulkIdsDto {
    /** Entry ids to act on. */
    @ApiProperty({
        type: [String],
        format: 'uuid',
        minItems: 1,
        maxItems: BULK_MAX_IDS,
        example: ['3f1a7c1e-9d2b-4a6f-8c11-5b8e2f0d7a91'],
        description: `Entry ids to act on — v4 uuids, non-empty and capped at ${BULK_MAX_IDS} so one request can't fan out unbounded work.`
    })
    @IsArray()
    @ArrayNotEmpty()
    @ArrayMaxSize(BULK_MAX_IDS)
    @IsUUID('4', { each: true })
    ids!: string[];
}
