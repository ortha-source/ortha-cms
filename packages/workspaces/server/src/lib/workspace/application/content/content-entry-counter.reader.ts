import { Inject, Injectable, Optional } from '@nestjs/common';
import {
    CONTENT_ENTRY_COUNTER,
    type ContentEntryCounter
} from '../ports/content-entry-counter.port';

/**
 * Reads content entry counts through the {@link CONTENT_ENTRY_COUNTER} port,
 * returning `0` when no content plugin is bound (there are no entry tables at
 * all, so every type is empty). Backs the aggregate's "revoke / delete only when
 * empty" invariants and the settings UI's pre-check endpoints.
 */
@Injectable()
export class ContentEntryCounterReader {
    constructor(
        @Optional()
        @Inject(CONTENT_ENTRY_COUNTER)
        private readonly counter?: ContentEntryCounter
    ) {}

    /** Entries of content type `slug` in `workspaceId`; `0` when unbound. */
    countEntries(workspaceId: string, slug: string): Promise<number> {
        return this.counter?.countEntries(workspaceId, slug) ?? Promise.resolve(0);
    }

    /** Entries across every content type in `workspaceId`; `0` when unbound. */
    countWorkspaceEntries(workspaceId: string): Promise<number> {
        return (
            this.counter?.countWorkspaceEntries(workspaceId) ??
            Promise.resolve(0)
        );
    }
}
