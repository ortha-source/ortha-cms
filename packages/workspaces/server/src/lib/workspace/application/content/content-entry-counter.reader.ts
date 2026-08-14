import { Inject, Injectable, Optional } from '@nestjs/common';
import {
    CONTENT_ENTRY_COUNTER,
    type ContentEntryCounter
} from '../ports/content-entry-counter.port';

/**
 * Reads content entry counts through the {@link CONTENT_ENTRY_COUNTER} port.
 *
 * With no content plugin bound the counts read `0`, which is fine for the
 * read-only pre-check endpoints but **must not** be taken as proof of emptiness
 * by a destructive change: the `content_*` tables are created by migrations and
 * outlive any one boot's plugin list, so a host started without the content
 * plugin can face a database full of entries while reporting none. Callers that
 * destroy data check {@link isBound} first and refuse when it is `false`.
 */
@Injectable()
export class ContentEntryCounterReader {
    constructor(
        @Optional()
        @Inject(CONTENT_ENTRY_COUNTER)
        private readonly counter?: ContentEntryCounter
    ) {}

    /**
     * Whether a real counter is bound. `false` means the counts below are the
     * unbound fallback rather than a measurement — destructive callers must
     * refuse rather than trust them.
     */
    get isBound(): boolean {
        return this.counter !== undefined;
    }

    /** Entries of content type `slug` in `workspaceId`; `0` when unbound. */
    countEntries(workspaceId: string, slug: string): Promise<number> {
        return (
            this.counter?.countEntries(workspaceId, slug) ?? Promise.resolve(0)
        );
    }

    /** Entries across every content type in `workspaceId`; `0` when unbound. */
    countWorkspaceEntries(workspaceId: string): Promise<number> {
        return (
            this.counter?.countWorkspaceEntries(workspaceId) ??
            Promise.resolve(0)
        );
    }
}
