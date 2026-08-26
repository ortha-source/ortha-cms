import {
    BadRequestException,
    ConflictException,
    Injectable,
    Logger,
    NotFoundException
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { InjectDatabase, type Database } from '@orthacms/database';
import {
    MAX_SEGMENT_TYPES,
    SEGMENT_KIND,
    SEGMENT_TYPE_MANAGED_BY,
    SEGMENT_TYPE_STATE
} from '@orthacms/segments-domain';
import { segmentTypes } from '../infrastructure/schema/segment-types';
import { segments } from '../infrastructure/schema/segments';
import { entryAccess } from '../infrastructure/schema/entry-access';
import { slotColumnNames } from '../infrastructure/schema/entry-access';
import { sql } from 'drizzle-orm';
import { MASK_SEGMENT_KEY } from './declared-types.reconciler';
import { SegmentCatalogService } from './segment-catalog.service';

/** One segment type as the admin sees it. */
export interface SegmentTypeView {
    id: string;
    key: string;
    label: string;
    cardinality: 'low' | 'high';
    slot: number;
    state: 'active' | 'draining' | 'free';
    managedBy: 'config' | 'ui';
    /** How many segments this type holds, the mask included. */
    segmentCount: number;
}

/**
 * The segment-type directory — creating an axis, renaming one, and retiring
 * one.
 *
 * The whole reason a type can be created at runtime at all is the slot pool:
 * `entry_access` carries eight generic `allow_dN`/`deny_dN` pairs, created by
 * migration, and a type claims one. So creating a type is an INSERT rather than
 * an `ALTER TABLE`, and the schema stays exactly what the checkout says it is.
 *
 * Retiring one is the operation with teeth, and it is deliberately not a
 * DELETE — see {@link retire}.
 */
@Injectable()
export class SegmentTypesService {
    private readonly logger = new Logger(SegmentTypesService.name);

    constructor(
        @InjectDatabase() private readonly db: Database,
        private readonly catalog: SegmentCatalogService
    ) {}

    /** Every declared type, with its segment count. */
    async list(): Promise<SegmentTypeView[]> {
        const rows = await this.db.select().from(segmentTypes);
        const counts = await this.db
            .select({
                typeId: segments.typeId,
                count: sql<number>`count(*)::int`
            })
            .from(segments)
            .groupBy(segments.typeId);
        const byType = new Map(counts.map((row) => [row.typeId, row.count]));
        return rows.map((row) => ({
            id: row.id,
            key: row.key,
            label: row.label,
            cardinality: row.cardinality,
            slot: row.slot,
            state: row.state,
            managedBy: row.managedBy,
            segmentCount: byType.get(row.id) ?? 0
        }));
    }

    /**
     * Create a type on the lowest free slot, with its mask segment.
     *
     * The mask is created here rather than left to the administrator because
     * without it "everyone except these three" is not expressible — the rule
     * would have to name the other three hundred and ninety-seven, which is the
     * complement the projection invariant forbids.
     */
    async create(input: {
        key: string;
        label: string;
        cardinality?: 'low' | 'high';
    }): Promise<SegmentTypeView> {
        const existing = await this.db.select().from(segmentTypes);
        if (existing.some((row) => row.key === input.key)) {
            throw new ConflictException(
                `A segment type with the key "${input.key}" already exists.`
            );
        }
        const taken = new Set(
            existing
                .filter((row) => row.state !== SEGMENT_TYPE_STATE.Free)
                .map((row) => row.slot)
        );
        const slot = this.lowestFreeSlot(taken);
        if (slot === null) {
            throw new ConflictException(
                `All ${MAX_SEGMENT_TYPES} projection slots are held. Retire a segment type, or add the next batch of slots by migration.`
            );
        }

        const [row] = await this.db
            .insert(segmentTypes)
            .values({
                key: input.key,
                label: input.label,
                cardinality: input.cardinality ?? 'low',
                slot,
                state: SEGMENT_TYPE_STATE.Active,
                managedBy: SEGMENT_TYPE_MANAGED_BY.Ui
            })
            .returning();

        await this.db.insert(segments).values({
            typeId: row.id,
            key: MASK_SEGMENT_KEY,
            label: `Any ${row.label}`,
            kind: SEGMENT_KIND.Mask,
            tags: []
        });

        await this.catalog.reload();
        this.logger.log(`Segment type "${row.key}" created on slot ${slot}.`);
        return { ...this.view(row), segmentCount: 1 };
    }

    /** Rename a type or change its rendering hint. Never its slot or key. */
    async update(
        id: string,
        input: { label?: string; cardinality?: 'low' | 'high' }
    ): Promise<SegmentTypeView> {
        const current = await this.byId(id);
        if (current.managedBy === SEGMENT_TYPE_MANAGED_BY.Config) {
            throw new BadRequestException(
                `Segment type "${current.key}" is declared in ortha.config.ts and is read-only here. Edit it there.`
            );
        }
        const [row] = await this.db
            .update(segmentTypes)
            .set({
                label: input.label ?? current.label,
                cardinality: input.cardinality ?? current.cardinality,
                updatedAt: new Date()
            })
            .where(eq(segmentTypes.id, id))
            .returning();
        await this.catalog.reload();
        const counts = await this.list();
        return counts.find((view) => view.id === row.id) ?? this.view(row);
    }

    /**
     * Retire a type: `active → draining`, then zero its slot columns, then
     * `free`.
     *
     * Not a DELETE, and not one step. The slot's columns still hold segment ids
     * that no longer mean anything, and handing the slot to the next type before
     * they are cleared would let that type silently inherit them — an entry
     * restricted to "Acme" reappearing as restricted to whatever claims slot 3
     * next. So the type leaves the predicate first (`draining` is excluded by
     * `planAccessPredicate`), the columns are zeroed, and only then is the slot
     * returned to the pool.
     *
     * Zeroing is also what makes the retirement *visible*: every entry the type
     * was hiding becomes readable, which is the honest consequence of removing
     * an axis and is why the admin asks before doing it.
     */
    async retire(id: string): Promise<SegmentTypeView> {
        const current = await this.byId(id);
        if (current.managedBy === SEGMENT_TYPE_MANAGED_BY.Config) {
            throw new BadRequestException(
                `Segment type "${current.key}" is declared in ortha.config.ts. Remove it there first.`
            );
        }
        if (current.state === SEGMENT_TYPE_STATE.Free) {
            return this.view(current);
        }

        // Out of the predicate first, so nothing matches against the columns
        // while they are being cleared.
        await this.db
            .update(segmentTypes)
            .set({ state: SEGMENT_TYPE_STATE.Draining, updatedAt: new Date() })
            .where(eq(segmentTypes.id, id));
        await this.catalog.reload();

        const { allow, deny } = slotColumnNames(current.slot);
        await this.db.execute(
            sql`UPDATE ${entryAccess} SET ${sql.raw(allow)} = '{}'::uuid[], ${sql.raw(deny)} = '{}'::uuid[]`
        );

        const [row] = await this.db
            .update(segmentTypes)
            .set({ state: SEGMENT_TYPE_STATE.Free, updatedAt: new Date() })
            .where(eq(segmentTypes.id, id))
            .returning();
        await this.catalog.reload();
        this.logger.warn(
            `Segment type "${current.key}" retired; slot ${current.slot} zeroed and returned to the pool.`
        );
        return this.view(row);
    }

    /** One type, or a 404. */
    private async byId(id: string) {
        const [row] = await this.db
            .select()
            .from(segmentTypes)
            .where(eq(segmentTypes.id, id))
            .limit(1);
        if (!row) {
            throw new NotFoundException('Unknown segment type.');
        }
        return row;
    }

    /** The lowest slot nobody holds, or null when the pool is full. */
    private lowestFreeSlot(taken: ReadonlySet<number>): number | null {
        for (let slot = 1; slot <= MAX_SEGMENT_TYPES; slot += 1) {
            if (!taken.has(slot)) return slot;
        }
        return null;
    }

    /** Row → wire shape, without the segment count. */
    private view(row: typeof segmentTypes.$inferSelect): SegmentTypeView {
        return {
            id: row.id,
            key: row.key,
            label: row.label,
            cardinality: row.cardinality,
            slot: row.slot,
            state: row.state,
            managedBy: row.managedBy,
            segmentCount: 0
        };
    }
}
