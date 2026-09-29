import type { INestApplication } from '@nestjs/common';
import type { Request } from 'express';
import type { SegmentResolver } from '@orthacms/segments-domain';
import {
    headerSegmentResolver,
    SegmentCatalogService
} from '@orthacms/segments-server';

/** The header the harness's reader resolver reads. */
export const READER_TAGS_HEADER = 'x-reader-tags';

/**
 * The harness's reader resolver: a comma-separated `X-Reader-Tags` header.
 *
 * The one the host installs by default — the shipped resolver, not a test copy
 * of it, so these suites exercise exactly what an operator gets. A request with
 * no header resolves to the **anonymous** reader, which is what every caller
 * that does not send it gets, and the state the read scope must be safe in.
 */
export const readerTagsResolver: SegmentResolver<Request> =
    headerSegmentResolver<Request>(READER_TAGS_HEADER);

/**
 * Re-read the segment catalogue from the database.
 *
 * The catalogue is held **in memory** — the read scope is consulted inside the
 * query builder and cannot await — and reloaded only by writes that go through
 * `SegmentsService`. `resetDb` truncates the tables behind its back, so without
 * this a suite would boot each test with a catalogue still holding the previous
 * one's segments: `configured` stays true, and ids that no longer exist keep
 * validating. Call it right after `resetDb` in any suite that touches segments.
 */
export async function reloadSegmentCatalogue(
    app: INestApplication
): Promise<void> {
    await app.get(SegmentCatalogService).reload();
}
