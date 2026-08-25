import {
    Injectable,
    Logger,
    type OnApplicationBootstrap
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { InjectDatabase, type Database } from '@orthacms/database';
import {
    SEGMENT_KIND,
    SEGMENT_TYPE_STATE,
    groupSegmentIdsByType,
    segmentIdsForTags,
    type Segment,
    type SegmentTag,
    type SegmentType,
    type SegmentTypeKey
} from '@orthacms/segments-domain';
import { segmentTypes } from '../infrastructure/schema/segment-types';
import { segments as segmentsTable } from '../infrastructure/schema/segments';

/** The catalogue as one immutable snapshot. */
export interface CatalogSnapshot {
    /** Every declared type, `draining` ones included. */
    readonly types: readonly SegmentType[];
    /** Every segment of every type. */
    readonly segments: readonly Segment[];
    /** Bumped on every reload, so a cached compilation knows it is stale. */
    readonly version: number;
}

const EMPTY: CatalogSnapshot = { types: [], segments: [], version: 0 };

/**
 * The segment catalogue, cached in memory and read **synchronously** by the
 * predicate compiler.
 *
 * Synchronous is the requirement that shapes this class. `CONTENT_READ_SCOPE`
 * is called inside the query builder and cannot await, so the types and
 * segments have to be in hand before a read starts. They are: the catalogue is
 * small (types are bounded by the slot count, segments by the tenant's own
 * directory), it changes only when an administrator changes it, and it is
 * loaded at boot.
 *
 * Loading at boot rather than lazily is also what keeps the failure mode
 * honest. `onApplicationBootstrap` runs inside `app.init()`, so a catalogue that
 * cannot be read aborts start-up — rather than leaving a server that serves
 * restricted content as though nothing were configured.
 */
@Injectable()
export class SegmentCatalogService implements OnApplicationBootstrap {
    private readonly logger = new Logger(SegmentCatalogService.name);
    private cache: CatalogSnapshot = EMPTY;

    constructor(@InjectDatabase() private readonly db: Database) {}

    /** Loads the catalogue before the app serves its first request. */
    async onApplicationBootstrap(): Promise<void> {
        await this.reload();
        const active = this.cache.types.filter(
            (type) => type.state === SEGMENT_TYPE_STATE.Active
        ).length;
        this.logger.log(
            `Segmentation catalogue loaded: ${active} active segment type(s), ${this.cache.segments.length} segment(s).`
        );
    }

    /** The current snapshot. Never null — an unloaded catalogue is empty. */
    snapshot(): CatalogSnapshot {
        return this.cache;
    }

    /**
     * Re-read the catalogue and bump the version.
     *
     * Called after any write to the types or segments tables. The whole
     * catalogue is re-read rather than patched: it is a handful of rows, and a
     * differential update is exactly the kind of code that drifts from the
     * table it mirrors.
     */
    async reload(): Promise<CatalogSnapshot> {
        const [typeRows, segmentRows] = await Promise.all([
            this.db.select().from(segmentTypes),
            this.db.select().from(segmentsTable)
        ]);

        const byId = new Map(typeRows.map((row) => [row.id, row.key]));
        const types: SegmentType[] = typeRows.map((row) => ({
            id: row.id,
            key: row.key,
            label: row.label,
            cardinality: row.cardinality,
            slot: row.slot,
            state: row.state,
            managedBy: row.managedBy
        }));
        const segments: Segment[] = segmentRows.flatMap((row) => {
            const typeKey = byId.get(row.typeId);
            // A segment whose type vanished is skipped rather than defaulted:
            // guessing a namespace would silently move it to another axis.
            if (!typeKey) return [];
            return [
                {
                    id: row.id,
                    typeKey,
                    key: row.key,
                    label: row.label,
                    kind: row.kind ?? SEGMENT_KIND.Set,
                    tags: row.tags ?? []
                }
            ];
        });

        this.cache = { types, segments, version: this.cache.version + 1 };
        return this.cache;
    }

    /** Whether any type currently participates in the decision. */
    hasActiveTypes(): boolean {
        return this.cache.types.some(
            (type) => type.state === SEGMENT_TYPE_STATE.Active
        );
    }

    /** The type owning one slot, if any type does. */
    typeForKey(key: SegmentTypeKey): SegmentType | undefined {
        return this.cache.types.find((type) => type.key === key);
    }

    /**
     * Resolve a reader's raw tags into their segments, grouped by type.
     *
     * This is where masks are handled — a prefix match over a bounded
     * in-memory list — which is what keeps the SQL predicate a plain
     * intersection of two id arrays.
     */
    resolveTags(
        tags: Iterable<SegmentTag>
    ): ReadonlyMap<SegmentTypeKey, readonly string[]> {
        const { segments } = this.cache;
        const ids = segmentIdsForTags(segments, tags);
        return groupSegmentIdsByType(segments, ids);
    }

    /** Reload after a write, swallowing nothing — a failed reload must surface. */
    async invalidate(): Promise<void> {
        await this.reload();
    }

    /** Segment ids of one type, by key — used when projecting a rule. */
    segmentIdsOfType(typeKey: SegmentTypeKey): readonly string[] {
        return this.cache.segments
            .filter((segment) => segment.typeKey === typeKey)
            .map((segment) => segment.id);
    }

    /** The type a segment belongs to, or undefined for an unknown id. */
    typeKeyOfSegment(segmentId: string): SegmentTypeKey | undefined {
        return this.cache.segments.find((segment) => segment.id === segmentId)
            ?.typeKey;
    }

    /** Drop the cache — for tests and for a controlled re-read. */
    reset(): void {
        this.cache = EMPTY;
    }

    /** A type row read straight from the database, bypassing the cache. */
    async findTypeByKey(key: SegmentTypeKey) {
        const [row] = await this.db
            .select()
            .from(segmentTypes)
            .where(eq(segmentTypes.key, key))
            .limit(1);
        return row;
    }
}
