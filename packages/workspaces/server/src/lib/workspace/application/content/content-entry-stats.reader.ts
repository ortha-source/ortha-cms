import { Inject, Injectable, Optional } from '@nestjs/common';
import {
    CONTENT_ENTRY_STATS,
    type ContentEntryStats,
    type WorkspaceEntryStat
} from '../ports/content-entry-stats.port';

/**
 * Reads batched entry statistics through the {@link CONTENT_ENTRY_STATS}
 * port. With no content plugin bound it answers `[]` — every workspace reads
 * as holding no records — which is right for the cards and hints this feeds
 * and wrong for anything destructive, so nothing destructive reads it.
 */
@Injectable()
export class ContentEntryStatsReader {
    constructor(
        @Optional()
        @Inject(CONTENT_ENTRY_STATS)
        private readonly stats?: ContentEntryStats
    ) {}

    /** Per-(workspace, type) counts for `workspaceIds`; `[]` when unbound. */
    async entryStats(
        workspaceIds: readonly string[]
    ): Promise<WorkspaceEntryStat[]> {
        if (!this.stats || workspaceIds.length === 0) return [];
        return this.stats.entryStats(workspaceIds);
    }
}
