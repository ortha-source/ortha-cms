import {
    ConflictException,
    Injectable,
    NotFoundException
} from '@nestjs/common';
import { asc, eq, ilike, or, sql } from 'drizzle-orm';
import { InjectDatabase, type Database } from '@orthacms/database';
import { segments } from '../schema/segments';
import { entryAccess } from '../schema/entry-access';
import { SegmentCatalogService } from './segment-catalog.service';

/** One segment as the admin sees it. */
export interface SegmentView {
    id: string;
    key: string;
    label: string;
    tags: string[];
    /** How many entries name it, either way — "is this one actually used?". */
    usageCount: number;
}

/** Longest accepted search term, so a needle cannot be a payload. */
const QUERY_MAX = 200;

/**
 * The segment directory — create, rename, retag, delete.
 *
 * Every write reloads the catalogue, because the read path holds it in memory
 * and a rename that does not reach it is a rename nobody sees. A full reload of
 * a list this size is cheaper than any narrower scheme would be to get right.
 */
@Injectable()
export class SegmentsService {
    constructor(
        @InjectDatabase() private readonly db: Database,
        private readonly catalog: SegmentCatalogService
    ) {}

    /** Every segment, with its usage count, optionally narrowed by a search. */
    async list(query?: string): Promise<SegmentView[]> {
        const needle = query?.trim();
        const rows = await this.db
            .select()
            .from(segments)
            .where(
                needle
                    ? or(
                          ilike(segments.label, `%${escapeLike(needle)}%`),
                          ilike(segments.key, `%${escapeLike(needle)}%`)
                      )
                    : undefined
            )
            .orderBy(asc(segments.label));

        const usage = await this.usageCounts();
        return rows.map((row) => ({
            id: row.id,
            key: row.key,
            label: row.label,
            tags: row.tags ?? [],
            usageCount: usage.get(row.id) ?? 0
        }));
    }

    /** Create a segment. */
    async create(input: {
        key: string;
        label: string;
        tags?: readonly string[];
    }): Promise<SegmentView> {
        const [existing] = await this.db
            .select({ id: segments.id })
            .from(segments)
            .where(eq(segments.key, input.key))
            .limit(1);
        if (existing) {
            throw new ConflictException(
                `A segment with the key "${input.key}" already exists.`
            );
        }

        // A segment with no tags matches nobody, which is a segment that can
        // only ever close content. Defaulting to the key is what the
        // administrator meant in every case but the one where they say
        // otherwise.
        const [row] = await this.db
            .insert(segments)
            .values({
                key: input.key,
                label: input.label,
                tags: input.tags?.length ? [...input.tags] : [input.key]
            })
            .returning();
        await this.catalog.reload();
        return { ...toView(row), usageCount: 0 };
    }

    /**
     * Rename a segment, or change the tags it answers to.
     *
     * Changing `tags` is the operation the indirection exists for: an
     * identifier renamed upstream is one row edited here, and every entry that
     * named the segment keeps working, because none of them ever named a tag.
     */
    async update(
        id: string,
        input: { label?: string; tags?: readonly string[] }
    ): Promise<SegmentView> {
        const current = await this.byId(id);
        const [row] = await this.db
            .update(segments)
            .set({
                label: input.label ?? current.label,
                tags: input.tags ? [...input.tags] : current.tags,
                updatedAt: new Date()
            })
            .where(eq(segments.id, id))
            .returning();
        await this.catalog.reload();
        const usage = await this.usageCounts();
        return { ...toView(row), usageCount: usage.get(row.id) ?? 0 };
    }

    /**
     * Delete a segment, and remove it from every entry that named it.
     *
     * The two halves are one transaction on purpose. Leaving the id behind
     * would leave entries pointing at a segment that resolves to nobody — which
     * on the allow side silently closes content and on the deny side silently
     * opens it, both without anything on screen to say why.
     *
     * An entry left with two empty lists loses its row entirely, which is the
     * same "no row means open" the writer maintains.
     */
    async remove(id: string): Promise<void> {
        await this.byId(id);
        await this.db.transaction(async (tx) => {
            await tx.delete(segments).where(eq(segments.id, id));
            await tx
                .update(entryAccess)
                .set({
                    allow: sql`array_remove(${entryAccess.allow}, ${id}::uuid)`,
                    deny: sql`array_remove(${entryAccess.deny}, ${id}::uuid)`,
                    updatedAt: new Date()
                })
                .where(
                    sql`${entryAccess.allow} @> ARRAY[${id}::uuid] OR ${entryAccess.deny} @> ARRAY[${id}::uuid]`
                );
            await tx
                .delete(entryAccess)
                .where(
                    sql`cardinality(${entryAccess.allow}) = 0 AND cardinality(${entryAccess.deny}) = 0`
                );
        });
        await this.catalog.reload();
    }

    /**
     * How many entries name each segment.
     *
     * One grouped query over both columns rather than a count per segment: the
     * directory asks about every segment at once, and a query per row is the
     * N+1 that makes the page slow exactly when a business has enough customers
     * to need the feature.
     */
    private async usageCounts(): Promise<Map<string, number>> {
        const result = (await this.db.execute(
            sql`SELECT segment_id::text AS id, count(DISTINCT entry_id)::int AS count
                FROM ${entryAccess},
                     LATERAL unnest(${entryAccess.allow} || ${entryAccess.deny}) AS segment_id
                GROUP BY segment_id`
        )) as unknown as { rows?: { id: string; count: number }[] };
        const list =
            result.rows ??
            (result as unknown as { id: string; count: number }[]);
        return new Map(list.map((row) => [row.id, Number(row.count)]));
    }

    /** One segment, or a 404. */
    private async byId(id: string) {
        const [row] = await this.db
            .select()
            .from(segments)
            .where(eq(segments.id, id))
            .limit(1);
        if (!row) throw new NotFoundException('Unknown segment.');
        return row;
    }
}

/** Row → wire shape, without the usage count. */
function toView(
    row: typeof segments.$inferSelect
): Omit<SegmentView, 'usageCount'> {
    return {
        id: row.id,
        key: row.key,
        label: row.label,
        tags: row.tags ?? []
    };
}

/** Escape the ILIKE metacharacters so a search term is read literally. */
function escapeLike(value: string): string {
    return value.slice(0, QUERY_MAX).replace(/[\\%_]/g, (char) => `\\${char}`);
}
