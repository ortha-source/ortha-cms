import { httpContentGateway } from '../../infrastructure/httpContentGateway';
import type {
    BulkPublishPreview,
    BulkPublishResult,
    PublishContext
} from '../../domain/types/contentType';

/**
 * The bulk-publish calls as **plain functions**, for a caller acting on records
 * of several types at once — the Publish Manager runs one dry run and one
 * commit per type in a set, which a per-type hook (`useBulkEntryActions`)
 * cannot express without a hook per type. Each goes through the content
 * gateway, so chunking at the server's `BULK_MAX_IDS` and error normalization
 * are the library's, not the caller's.
 *
 * They **do not refresh caches** — a caller that commits runs
 * `refreshEntryCaches` for each type it touched, once, at the end.
 */

/** What publishing `ids` would involve: each entry, plus the drafts it links to. */
export function fetchPublishContext(
    typeName: string,
    ids: string[]
): Promise<PublishContext> {
    return httpContentGateway.bulkPublishContext(typeName, ids);
}

/** Dry-runs a publish of `ids` (validates each, writes nothing). */
export function previewBulkPublish(
    typeName: string,
    ids: string[]
): Promise<BulkPublishPreview> {
    return httpContentGateway.bulkPreviewPublish(typeName, ids);
}

/** Commits a publish of `ids`; partial success, as the server reports it. */
export function commitBulkPublish(
    typeName: string,
    ids: string[]
): Promise<BulkPublishResult> {
    return httpContentGateway.bulkPublish(typeName, ids);
}
