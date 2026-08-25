import {
    Injectable,
    Logger,
    type OnApplicationBootstrap
} from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { InjectDatabase, type Database } from '@orthacms/database';
import {
    MAX_SEGMENT_TYPES,
    SEGMENT_KIND,
    SEGMENT_TYPE_MANAGED_BY,
    SEGMENT_TYPE_STATE
} from '@orthacms/segments-domain';
import { InjectSegmentsConfig } from '../../segments.tokens';
import type { SegmentsPluginConfig } from '../../types/segments-config';
import { segmentTypes } from '../infrastructure/schema/segment-types';
import { segments } from '../infrastructure/schema/segments';
import { SegmentCatalogService } from './segment-catalog.service';

/** The key of the mask segment every type gets. */
export const MASK_SEGMENT_KEY = '*';

/**
 * Reconciles the segment types an app declares in `ortha.config.ts` into the
 * catalogue at boot.
 *
 * Three rules, and the third is the one that matters:
 *
 * - A declared type that does not exist is **created**, claiming the lowest
 *   free slot.
 * - A declared type that exists is **updated** in place — label and cardinality
 *   only. Its slot is never moved: the slot is what the projection's columns
 *   mean, and re-pointing it would reinterpret every row already written.
 * - A type that has **disappeared from the config is left alone**, not deleted.
 *   Removing a type unrestricts whatever it was hiding, which is not a thing to
 *   do as a side effect of editing a config file. Retiring one is an explicit
 *   act through the admin, and goes through `draining` so its slot is zeroed
 *   before anyone else can claim it.
 *
 * Every type also gets its **mask** segment — the one that matches any tag in
 * the namespace. Without it "everyone except these three" cannot be written as
 * an exclusion, and would have to be stored as its complement.
 */
@Injectable()
export class DeclaredTypesReconciler implements OnApplicationBootstrap {
    private readonly logger = new Logger(DeclaredTypesReconciler.name);

    constructor(
        @InjectDatabase() private readonly db: Database,
        @InjectSegmentsConfig() private readonly config: SegmentsPluginConfig,
        private readonly catalog: SegmentCatalogService
    ) {}

    /** Runs inside `app.init()`, so a failure aborts boot rather than serving. */
    async onApplicationBootstrap(): Promise<void> {
        const declared = this.config.types ?? [];
        if (declared.length) {
            await this.reconcile();
        }
        await this.ensureMasks();
        await this.catalog.reload();
    }

    /** Create or update every declared type. */
    private async reconcile(): Promise<void> {
        const declared = this.config.types ?? [];
        const existing = await this.db.select().from(segmentTypes);
        const byKey = new Map(existing.map((row) => [row.key, row]));
        const takenSlots = new Set(
            existing
                .filter((row) => row.state !== SEGMENT_TYPE_STATE.Free)
                .map((row) => row.slot)
        );

        for (const type of declared) {
            const current = byKey.get(type.key);
            if (current) {
                await this.db
                    .update(segmentTypes)
                    .set({
                        label: type.label,
                        cardinality: type.cardinality ?? current.cardinality,
                        managedBy: SEGMENT_TYPE_MANAGED_BY.Config,
                        updatedAt: new Date()
                    })
                    .where(eq(segmentTypes.id, current.id));
                continue;
            }

            const slot = this.lowestFreeSlot(takenSlots);
            if (slot === null) {
                // Refusing to boot beats booting with a declared axis silently
                // absent: the app would then serve content it believes is
                // segmented by a type that does not exist.
                throw new Error(
                    `SegmentsPlugin: no free projection slot for segment type "${type.key}". ` +
                        `All ${MAX_SEGMENT_TYPES} slots are held; retire a type or add the next batch of slots by migration.`
                );
            }
            takenSlots.add(slot);
            await this.db.insert(segmentTypes).values({
                key: type.key,
                label: type.label,
                cardinality: type.cardinality ?? 'low',
                slot,
                state: SEGMENT_TYPE_STATE.Active,
                managedBy: SEGMENT_TYPE_MANAGED_BY.Config
            });
            this.logger.log(
                `Declared segment type "${type.key}" created on slot ${slot}.`
            );
        }
    }

    /** Give every type its mask segment, idempotently. */
    private async ensureMasks(): Promise<void> {
        const types = await this.db.select().from(segmentTypes);
        for (const type of types) {
            const [mask] = await this.db
                .select({ id: segments.id })
                .from(segments)
                .where(
                    and(
                        eq(segments.typeId, type.id),
                        eq(segments.key, MASK_SEGMENT_KEY)
                    )
                )
                .limit(1);
            if (mask) continue;
            await this.db.insert(segments).values({
                typeId: type.id,
                key: MASK_SEGMENT_KEY,
                label: `Any ${type.label}`,
                kind: SEGMENT_KIND.Mask,
                tags: []
            });
        }
    }

    /** The lowest slot number nobody holds, or null when the pool is full. */
    private lowestFreeSlot(taken: ReadonlySet<number>): number | null {
        for (let slot = 1; slot <= MAX_SEGMENT_TYPES; slot += 1) {
            if (!taken.has(slot)) return slot;
        }
        return null;
    }
}
