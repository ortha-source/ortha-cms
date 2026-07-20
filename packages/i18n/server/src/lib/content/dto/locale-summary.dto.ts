import { ArrayMaxSize, IsArray, IsUUID } from 'class-validator';
import { LOCALE_SUMMARY_MAX_GROUPS } from '../../i18n.constants';

/**
 * Body for `POST /api/i18n/content/:typeName/locale-summary` — the records
 * table's batched per-page read (POST, not GET: a page of uuids outgrows a
 * query string). Capped so a request can't fan out unbounded.
 */
export class LocaleSummaryDto {
    /** Translation-group ids to summarize (one page's worth). */
    @IsArray()
    @ArrayMaxSize(LOCALE_SUMMARY_MAX_GROUPS)
    @IsUUID(undefined, { each: true })
    groupIds!: string[];
}
