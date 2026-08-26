import { Injectable } from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';
import { InjectDatabase, type Database } from '@orthacms/database';
import type {
    EntryAccessDescription,
    EntryAccessQuery,
    EntryAccessSource
} from '@orthacms/content-server';
import { MAX_SEGMENT_TYPES } from '@orthacms/segments-domain';
import { entryAccess } from '../schema/entry-access';
import { SegmentCatalogService } from '../../application/segment-catalog.service';

/**
 * Tells a protocol adapter which of the entries it just served were
 * reader-scoped.
 *
 * The whole answer comes from the **presence of projection rows**, which is
 * exactly the invariant the read predicate relies on: an entry with no rows is
 * unrestricted, and the projector deletes an entry's rows the moment its
 * resolved rule stops restricting anyone. So this is the same fact the read
 * already decided on, read back — not a second evaluation of the rule, which
 * could disagree with the one that admitted the entry.
 *
 * It reports **axes, never segments**. Which segment types took part is a hint
 * a client can vary its own cache on; which segments are admitted would tell a
 * consumer who *else* may read the entry, and a consumer of published content
 * is not a member of the workspace.
 *
 * One query for the page. The adapter labels a whole result set at once, and a
 * query per entry would turn a one-page read into a per-row fan-out on the
 * public API's hot path.
 */
@Injectable()
export class SegmentEntryAccessSource implements EntryAccessSource {
    constructor(
        @InjectDatabase() private readonly db: Database,
        private readonly catalog: SegmentCatalogService
    ) {}

    /** Describes one page of entries, omitting the ones nothing restricts. */
    async describe(
        query: EntryAccessQuery
    ): Promise<ReadonlyMap<string, EntryAccessDescription>> {
        const described = new Map<string, EntryAccessDescription>();
        if (!query.entryIds.length) {
            return described;
        }

        const rows = await this.db
            .select()
            .from(entryAccess)
            .where(
                and(
                    eq(entryAccess.workspaceId, query.workspaceId),
                    inArray(entryAccess.entryId, [...query.entryIds])
                )
            );
        if (!rows.length) {
            return described;
        }

        // Slot → type key, taken from the catalogue rather than from the row:
        // the row names slots, and only the catalogue knows which axis holds
        // which one. A `draining` type is deliberately included — its columns
        // still carry ids until the retirement zeroes them, and reporting the
        // entry as unrestricted before that happened would be the one direction
        // of this answer a cache acts on.
        const byType = new Map(
            this.catalog
                .snapshot()
                .types.map((type) => [type.slot, type.key] as const)
        );

        for (const row of rows) {
            const dimensions = new Set(
                described.get(row.entryId)?.dimensions ?? []
            );
            for (let slot = 1; slot <= MAX_SEGMENT_TYPES; slot += 1) {
                const key = byType.get(slot);
                if (!key) continue;
                const allow = row[`allowD${slot}` as keyof typeof row];
                const deny = row[`denyD${slot}` as keyof typeof row];
                if (nonEmpty(allow) || nonEmpty(deny)) {
                    dimensions.add(key);
                }
            }
            described.set(row.entryId, {
                // A row exists, so something restricts the entry — even a row
                // whose slots are all empty, which is what a rule that only
                // carries a date window or an exclusion projects to.
                restricted: true,
                dimensions: [...dimensions].sort()
            });
        }
        return described;
    }
}

/** Whether a slot column holds anything. */
function nonEmpty(value: unknown): boolean {
    return Array.isArray(value) && value.length > 0;
}
