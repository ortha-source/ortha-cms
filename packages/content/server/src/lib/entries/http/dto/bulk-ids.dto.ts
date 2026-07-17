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
    @IsArray()
    @ArrayNotEmpty()
    @ArrayMaxSize(BULK_MAX_IDS)
    @IsUUID('4', { each: true })
    ids!: string[];
}
