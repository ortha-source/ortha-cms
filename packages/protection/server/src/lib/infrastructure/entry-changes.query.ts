import { Injectable } from '@nestjs/common';
import {
    InjectContentRegistry,
    InjectRevisionStore,
    diffSnapshots,
    type ContentTypeRegistry,
    type RevisionSnapshot,
    type RevisionStore
} from '@orthacms/content-server';

/** What a never-published entry is compared against: nothing at all. */
const NOTHING_LIVE: RevisionSnapshot = { values: {}, relations: {} };

/**
 * How many fields an entry's head changed since its live version — the "3
 * fields changed" a reviewer reads in the queue before opening anything.
 *
 * **Compared through content's own `diffSnapshots`**, never a comparison written
 * here. The queue panel draws the same changes with content-admin's
 * `diffRevision`, which `diffSnapshots` documents mirroring rule for rule —
 * empties collapse, link sets compare in order — so the number on the line and
 * the rows in the panel cannot disagree about what counts as a change.
 *
 * Asked of content's `RevisionStore` port for the reason `HeadRevisionQuery`
 * gives: the revisions table is host-owned and this package has no business
 * knowing its columns.
 */
@Injectable()
export class EntryChangesQuery {
    constructor(
        @InjectRevisionStore() private readonly revisions: RevisionStore,
        @InjectContentRegistry()
        private readonly registry: ContentTypeRegistry
    ) {}

    /**
     * Fields that differ between the live version and the head.
     *
     * - The head **is** live: `0` — there is nothing new to read.
     * - Never published: every field the head fills, compared against an empty
     *   document, which is what "changes since it was last published" means for
     *   a record that never was.
     * - A type no longer registered, or a revision that has gone: `null`, so
     *   the line says nothing rather than a number it could not compute.
     */
    async fieldsChanged(
        contentType: string,
        entryId: string,
        workspaceId: string,
        headNumber: number,
        liveNumber: number | null
    ): Promise<number | null> {
        if (liveNumber === headNumber) return 0;
        const type = this.registry.serialize(contentType);
        if (!type) return null;
        const [head, live] = await Promise.all([
            this.revisions.get(contentType, entryId, workspaceId, headNumber),
            liveNumber == null
                ? Promise.resolve(undefined)
                : this.revisions.get(
                      contentType,
                      entryId,
                      workspaceId,
                      liveNumber
                  )
        ]);
        if (!head) return null;
        if (liveNumber != null && !live) return null;
        return diffSnapshots(
            type,
            live?.snapshot ?? NOTHING_LIVE,
            head.snapshot
        ).changes.length;
    }
}
