import { Injectable } from '@nestjs/common';
import { count, eq, type AnyColumn } from 'drizzle-orm';
import { InjectDatabase, type Database } from '@ortha-cms/database';
import type { ContentEntryCounter } from '@ortha-cms/identity-server';
import { InjectContentRegistry } from '../../content.tokens';
import type { ContentTypeRegistry } from '../../registry/content-type-registry';
import type { AnyContentType } from '../../types/content-type';

/** A generated content table seen as a bag of columns by property name. */
type ContentTable = Record<string, AnyColumn>;

/**
 * Implements identity's {@link ContentEntryCounter} port over the generated
 * `content_<name>` tables: counts how many entries of a content type a
 * workspace holds. Bound to `CONTENT_ENTRY_COUNTER` in {@link ContentModule},
 * so identity's "revoke a content-type grant only when empty" rule resolves
 * against the real stored entries.
 */
@Injectable()
export class EntryCounterService implements ContentEntryCounter {
    constructor(
        @InjectDatabase() private readonly db: Database,
        @InjectContentRegistry() private readonly registry: ContentTypeRegistry
    ) {}

    /**
     * Every stored row of content type `slug` in `workspaceId`. Counts the
     * whole workspace slice of the type's table — including soft-deleted rows
     * for paranoid types (data that still exists must keep the grant). An
     * unknown slug (no such content type) counts as `0`.
     */
    async countEntries(workspaceId: string, slug: string): Promise<number> {
        const type = this.registry.get(slug);
        if (!type) return 0;
        return this.countTable(type, workspaceId);
    }

    /**
     * Every stored row the workspace holds across **all** content types —
     * summed over each type's table. Backs the workspace-delete guard (delete is
     * refused until this is zero). The per-type counts run concurrently.
     */
    async countWorkspaceEntries(workspaceId: string): Promise<number> {
        const counts = await Promise.all(
            this.registry
                .all()
                .map((type) => this.countTable(type, workspaceId))
        );
        return counts.reduce((sum, n) => sum + n, 0);
    }

    /** Counts a single content type's rows in a workspace. */
    private async countTable(
        type: AnyContentType,
        workspaceId: string
    ): Promise<number> {
        const table = type.table as unknown as ContentTable;
        const [{ total }] = await this.db
            .select({ total: count() })
            .from(type.table)
            .where(eq(table['workspaceId'], workspaceId));
        return total;
    }
}
