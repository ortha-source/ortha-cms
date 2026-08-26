import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException
} from '@nestjs/common';
import { and, asc, eq, ilike, or, sql } from 'drizzle-orm';
import { InjectDatabase, type Database } from '@orthacms/database';
import { SEGMENT_KIND } from '@orthacms/segments-domain';
import { segments } from '../infrastructure/schema/segments';
import { segmentTypes } from '../infrastructure/schema/segment-types';
import { entryAccess } from '../infrastructure/schema/entry-access';
import { slotColumnNames } from '../infrastructure/schema/entry-access';
import { MASK_SEGMENT_KEY } from './declared-types.reconciler';
import { SegmentCatalogService } from './segment-catalog.service';

/** One segment as the picker shows it. */
export interface SegmentView {
    id: string;
    typeId: string;
    typeKey: string;
    key: string;
    label: string;
    kind: 'set' | 'mask';
    tags: readonly string[];
    /** Projection rows naming this segment — "is this one actually used?". */
    usageCount: number;
}

/** Longest accepted key, label and tag. */
const KEY_MAX = 120;

/**
 * The segments of one type — the named sets rules and grants point at.
 *
 * The usage count is not decoration. A picker over four hundred organisations
 * is unreadable without it: it is what tells an administrator that the segment
 * they are about to grant is one nothing references, which is almost always a
 * typo in the key rather than an intention.
 */
@Injectable()
export class SegmentsService {
    constructor(
        @InjectDatabase() private readonly db: Database,
        private readonly catalog: SegmentCatalogService
    ) {}

    /**
     * One type's segments, optionally narrowed by a search term.
     *
     * The search is an ILIKE over the label and the key — the two things a
     * person reads in the picker. Metacharacters are escaped, so a label
     * containing `%` searches for that character rather than for everything.
     */
    async list(typeKey: string, query?: string): Promise<SegmentView[]> {
        const type = await this.typeByKey(typeKey);
        const needle = query?.trim();
        const rows = await this.db
            .select()
            .from(segments)
            .where(
                needle
                    ? and(
                          eq(segments.typeId, type.id),
                          or(
                              ilike(segments.label, `%${escapeLike(needle)}%`),
                              ilike(segments.key, `%${escapeLike(needle)}%`)
                          )
                      )
                    : eq(segments.typeId, type.id)
            )
            .orderBy(asc(segments.label));

        const usage = await this.usageCounts(type.slot);
        return rows.map((row) => ({
            id: row.id,
            typeId: row.typeId,
            typeKey: type.key,
            key: row.key,
            label: row.label,
            kind: row.kind,
            tags: row.tags ?? [],
            usageCount: usage.get(row.id) ?? 0
        }));
    }

    /** Create a segment by hand — the `manual` source's only entry point. */
    async create(input: {
        typeKey: string;
        key: string;
        label: string;
        tags?: readonly string[];
    }): Promise<SegmentView> {
        const type = await this.typeByKey(input.typeKey);
        if (input.key === MASK_SEGMENT_KEY) {
            throw new BadRequestException(
                `"${MASK_SEGMENT_KEY}" is reserved for the type's mask segment.`
            );
        }
        const [existing] = await this.db
            .select({ id: segments.id })
            .from(segments)
            .where(
                and(eq(segments.typeId, type.id), eq(segments.key, input.key))
            )
            .limit(1);
        if (existing) {
            throw new ConflictException(
                `Segment "${input.key}" already exists in "${type.key}".`
            );
        }

        // A segment with no tags matches nobody, which is a segment that can
        // only ever close content. Defaulting to the canonical `<type>:<key>`
        // is what the administrator meant in every case but the one where they
        // say otherwise.
        const tags = input.tags?.length
            ? [...input.tags]
            : [`${type.key}:${input.key}`];

        const [row] = await this.db
            .insert(segments)
            .values({
                typeId: type.id,
                key: input.key,
                label: input.label,
                kind: SEGMENT_KIND.Set,
                tags
            })
            .returning();
        await this.catalog.reload();
        return {
            id: row.id,
            typeId: row.typeId,
            typeKey: type.key,
            key: row.key,
            label: row.label,
            kind: row.kind,
            tags: row.tags ?? [],
            usageCount: 0
        };
    }

    /**
     * Rename a segment or change the tags it matches.
     *
     * Changing `tags` is the operation the whole indirection exists for: a plan
     * renamed in the billing system is one row edited here, and every rule,
     * grant and projected row keeps working because none of them ever named a
     * tag.
     */
    async update(
        id: string,
        input: { label?: string; tags?: readonly string[] }
    ): Promise<SegmentView> {
        const current = await this.byId(id);
        if (current.kind === SEGMENT_KIND.Mask && input.tags) {
            throw new BadRequestException(
                'A mask segment matches its whole namespace and carries no tags of its own.'
            );
        }
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
        const type = await this.typeById(row.typeId);
        return {
            id: row.id,
            typeId: row.typeId,
            typeKey: type.key,
            key: row.key,
            label: row.label,
            kind: row.kind,
            tags: row.tags ?? [],
            usageCount: 0
        };
    }

    /**
     * Delete a segment.
     *
     * Refused while anything still names it. A rule pointing at a deleted
     * segment would resolve to an `only` naming nobody — content closing
     * silently rather than opening, which is the safer direction but still not
     * a thing to do behind an administrator's back.
     */
    async remove(id: string): Promise<void> {
        const current = await this.byId(id);
        if (current.kind === SEGMENT_KIND.Mask) {
            throw new BadRequestException(
                'A type’s mask segment is deleted with the type, not on its own.'
            );
        }
        const type = await this.typeById(current.typeId);
        const usage = await this.usageCounts(type.slot);
        const count = usage.get(id) ?? 0;
        if (count > 0) {
            throw new ConflictException(
                `"${current.label}" is referenced by ${count} projected entr${count === 1 ? 'y' : 'ies'}. Remove it from the rules and grants that name it first.`
            );
        }
        await this.db.delete(segments).where(eq(segments.id, id));
        await this.catalog.reload();
    }

    /**
     * How many projection rows name each segment of one slot.
     *
     * One grouped query over the slot's two array columns rather than a count
     * per segment: a picker asks about every segment of a type at once, and a
     * query per row is the N+1 that makes a four-hundred-entry list unusable.
     */
    private async usageCounts(slot: number): Promise<Map<string, number>> {
        const { allow, deny } = slotColumnNames(slot);
        const rows = (await this.db.execute(
            sql`SELECT segment_id::text AS id, count(*)::int AS count
                FROM ${entryAccess},
                     LATERAL unnest(${sql.raw(allow)} || ${sql.raw(deny)}) AS segment_id
                GROUP BY segment_id`
        )) as unknown as { rows?: { id: string; count: number }[] };
        const list =
            rows.rows ?? (rows as unknown as { id: string; count: number }[]);
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

    /** One type by key, or a 404. */
    private async typeByKey(key: string) {
        const [row] = await this.db
            .select()
            .from(segmentTypes)
            .where(eq(segmentTypes.key, key))
            .limit(1);
        if (!row) throw new NotFoundException('Unknown segment type.');
        return row;
    }

    /** One type by id, or a 404. */
    private async typeById(id: string) {
        const [row] = await this.db
            .select()
            .from(segmentTypes)
            .where(eq(segmentTypes.id, id))
            .limit(1);
        if (!row) throw new NotFoundException('Unknown segment type.');
        return row;
    }
}

/** Escape the ILIKE metacharacters so a search term is read literally. */
function escapeLike(value: string): string {
    return value.slice(0, KEY_MAX).replace(/[\\%_]/g, (char) => `\\${char}`);
}
