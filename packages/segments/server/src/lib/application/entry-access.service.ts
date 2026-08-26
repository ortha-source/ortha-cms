import { BadRequestException, Injectable } from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';
import { InjectDatabase, type Database } from '@orthacms/database';
import { isOpen, type EntryAccess } from '@orthacms/segments-domain';
import { entryAccess } from '../schema/entry-access';
import { SegmentCatalogService } from './segment-catalog.service';

/** One entry's two lists, as the editor reads and writes them. */
export interface EntryAccessView extends EntryAccess {
    allow: string[];
    deny: string[];
}

/** Nothing set. */
const OPEN: EntryAccessView = { allow: [], deny: [] };

/**
 * Where a read or write runs.
 *
 * Ordinarily the plugin's own connection; on the entry-write path it is the
 * **entry save's transaction**, handed over by content's
 * `EntryWriteExtension` port so the access row, the entry row and the version
 * recording both commit together. Drizzle's transaction handle carries the same
 * query surface, which is what lets one method serve both.
 */
export type AccessExecutor = Pick<
    Database,
    'select' | 'insert' | 'delete' | 'update'
>;

/**
 * Reading and writing one entry's access.
 *
 * The whole write path, and it is a single upsert — there is nothing to
 * resolve, nothing to project and nothing else to re-derive, because the row an
 * editor saves is the row a reader is matched against. That is the property the
 * simple model buys, and it is why this file is the size it is.
 */
@Injectable()
export class EntryAccessService {
    constructor(
        @InjectDatabase() private readonly db: Database,
        private readonly catalog: SegmentCatalogService
    ) {}

    /** One entry's lists. An entry nobody restricted reads as two empty ones. */
    async get(
        workspaceId: string,
        entryId: string,
        executor: AccessExecutor = this.db
    ): Promise<EntryAccessView> {
        const [row] = await executor
            .select()
            .from(entryAccess)
            .where(
                and(
                    eq(entryAccess.entryId, entryId),
                    eq(entryAccess.workspaceId, workspaceId)
                )
            )
            .limit(1);
        return row ? { allow: row.allow ?? [], deny: row.deny ?? [] } : OPEN;
    }

    /** Many entries' lists at once, for the records list. Omits open entries. */
    async getMany(
        workspaceId: string,
        entryIds: readonly string[]
    ): Promise<Map<string, EntryAccessView>> {
        if (!entryIds.length) return new Map();
        const rows = await this.db
            .select()
            .from(entryAccess)
            .where(
                and(
                    eq(entryAccess.workspaceId, workspaceId),
                    inArray(entryAccess.entryId, [...entryIds])
                )
            );
        return new Map(
            rows.map((row) => [
                row.entryId,
                { allow: row.allow ?? [], deny: row.deny ?? [] }
            ])
        );
    }

    /**
     * Replace one entry's lists.
     *
     * **Replace, not merge.** The editor submits the whole state of the two
     * lists, which is the only shape that can express a removal — a merge has
     * no spelling for "this segment is no longer mentioned".
     *
     * Two empty lists **delete the row** rather than storing it. An entry with
     * no row is unrestricted, which is what the read predicate's
     * `COALESCE(…, true)` relies on; storing empty arrays instead would work,
     * and would leave every entry anyone ever opened paying for a row.
     */
    async set(input: {
        workspaceId: string;
        typeSlug: string;
        entryId: string;
        allow: readonly string[];
        deny: readonly string[];
        /**
         * Where to write. Defaults to the plugin's own connection (the `PUT`
         * route); the entry-write extension passes the **entry save's**
         * transaction, so a restriction and the record it restricts commit as
         * one — and the version taken moments later reads back what committed.
         */
        executor?: AccessExecutor;
    }): Promise<EntryAccessView> {
        const executor = input.executor ?? this.db;
        const allow = this.validate(input.allow);
        const deny = this.validate(input.deny);

        if (isOpen({ allow, deny })) {
            await executor
                .delete(entryAccess)
                .where(eq(entryAccess.entryId, input.entryId));
            return OPEN;
        }

        await executor
            .insert(entryAccess)
            .values({
                entryId: input.entryId,
                workspaceId: input.workspaceId,
                typeSlug: input.typeSlug,
                allow,
                deny
            })
            .onConflictDoUpdate({
                target: entryAccess.entryId,
                set: {
                    workspaceId: input.workspaceId,
                    typeSlug: input.typeSlug,
                    allow,
                    deny,
                    updatedAt: new Date()
                }
            });
        return { allow, deny };
    }

    /**
     * Deduplicates and checks that every id is a segment that exists.
     *
     * An unknown id is refused rather than stored. Kept, it would be a decision
     * that matches nobody — closing content on the allow side and doing nothing
     * on the deny side — with nothing on screen to say the entry is governed by
     * a segment that is not there.
     */
    private validate(ids: readonly string[]): string[] {
        const unique = [...new Set(ids)];
        const known = new Set(this.catalog.all().map((segment) => segment.id));
        const unknown = unique.filter((id) => !known.has(id));
        if (unknown.length) {
            throw new BadRequestException(
                `Unknown segment(s): ${unknown.join(', ')}.`
            );
        }
        return unique;
    }
}
