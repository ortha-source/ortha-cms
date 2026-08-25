import { Injectable } from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';
import { InjectDatabase, type Database } from '@orthacms/database';
import {
    CONDITION_MODE,
    MAX_CONDITION_GROUPS,
    isUnrestricted,
    type ResolvedAccessRule,
    type ResolvedConditionGroup,
    type SegmentTypeKey
} from '@orthacms/segments-domain';
import { entryAccess } from '../infrastructure/schema/entry-access';
import { SegmentCatalogService } from './segment-catalog.service';

/** One entry to project, and the rule that applies to it. */
export interface ProjectionTarget {
    readonly workspaceId: string;
    readonly typeSlug: string;
    readonly entryId: string;
}

/** The slot arrays for one group, keyed by slot number. */
type SlotValues = Map<number, { allow: string[]; deny: string[] }>;

/** Anything Drizzle will accept as an executor — a connection or a transaction. */
type Executor = Pick<Database, 'insert' | 'delete'>;

/**
 * Writes the projection — the translation from "this rule applies here" into
 * the rows the read predicate matches against.
 *
 * The mapping is small but it is where the model's asymmetries become storage,
 * so each one is stated at the point it happens rather than in a comment
 * somewhere else:
 *
 * - **One row per condition group.** The read OR-s an entry's rows, which is
 *   how the disjunction survives into SQL without the predicate having to know
 *   how many groups an entry has.
 * - **An unrestricted rule writes nothing.** Rows are deleted instead, so an
 *   open entry is an index probe that finds nothing rather than a row of empty
 *   arrays. `COALESCE(…, true)` in the predicate is the other half of this.
 * - **Exclusions are copied onto every row.** They are absolute, and a row is
 *   only ever considered on its own, so duplicating them per group is what
 *   makes "denied" survive an OR that would otherwise let another group admit
 *   the reader.
 * - **`all` writes an empty allow array**, not the type's mask. "Any reader"
 *   and "any reader carrying a tag of this type" are different statements, and
 *   only the second one is a segment.
 */
@Injectable()
export class ProjectionService {
    constructor(
        @InjectDatabase() private readonly db: Database,
        private readonly catalog: SegmentCatalogService
    ) {}

    /**
     * Replace one entry's projection.
     *
     * Delete-then-insert rather than an upsert: the number of rows is the
     * number of groups and may shrink, so a merge would leave the tail of a
     * previous, longer rule behind — and a stale group is an OR branch nobody
     * authored, which can only ever widen access.
     *
     * Takes an optional executor so a caller inside a transaction can project
     * atomically with the write that changed the entry.
     */
    async project(
        target: ProjectionTarget,
        rule: ResolvedAccessRule,
        ruleId: string | null = null,
        executor: Executor = this.db
    ): Promise<void> {
        await executor
            .delete(entryAccess)
            .where(eq(entryAccess.entryId, target.entryId));

        if (isUnrestricted(rule)) {
            return;
        }

        const rows = this.rowsFor(target, rule, ruleId);
        if (rows.length) {
            await executor.insert(entryAccess).values(rows);
        }
    }

    /** Drop an entry's projection entirely — used when an entry is purged. */
    async clear(entryId: string, executor: Executor = this.db): Promise<void> {
        await executor
            .delete(entryAccess)
            .where(eq(entryAccess.entryId, entryId));
    }

    /** Drop the projection of many entries in one statement. */
    async clearMany(
        entryIds: readonly string[],
        executor: Executor = this.db
    ): Promise<void> {
        if (!entryIds.length) return;
        await executor
            .delete(entryAccess)
            .where(inArray(entryAccess.entryId, [...entryIds]));
    }

    /** Drop the projection of a whole content type in one workspace. */
    async clearType(
        workspaceId: string,
        typeSlug: string,
        executor: Executor = this.db
    ): Promise<void> {
        await executor
            .delete(entryAccess)
            .where(
                and(
                    eq(entryAccess.workspaceId, workspaceId),
                    eq(entryAccess.typeSlug, typeSlug)
                )
            );
    }

    /**
     * The rows one resolved rule projects to.
     *
     * Exposed for the unit tests and for the impact preview, which needs to
     * count what a change would write without writing it.
     */
    rowsFor(
        target: ProjectionTarget,
        rule: ResolvedAccessRule,
        ruleId: string | null = null
    ): (typeof entryAccess.$inferInsert)[] {
        // A rule that only excludes still needs one row to carry the exclusion:
        // with no rows at all the predicate reads the entry as unrestricted.
        const groups: readonly ResolvedConditionGroup[] = rule.groups.length
            ? rule.groups
            : [{ conditions: {} }];

        if (groups.length > MAX_CONDITION_GROUPS) {
            throw new Error(
                `segments: a rule may hold at most ${MAX_CONDITION_GROUPS} condition groups, got ${groups.length}.`
            );
        }

        return groups.map((group, index) => {
            const slots = this.slotValuesFor(group, rule.exclusions);
            return {
                entryId: target.entryId,
                groupNo: index,
                workspaceId: target.workspaceId,
                typeSlug: target.typeSlug,
                accessFrom: rule.startsAt,
                accessTo: rule.endsAt,
                ruleId,
                fallback: rule.fallback,
                ...slotColumnValues(slots)
            };
        });
    }

    /** Turn one group plus the rule's exclusions into per-slot arrays. */
    private slotValuesFor(
        group: ResolvedConditionGroup,
        exclusions: ResolvedAccessRule['exclusions']
    ): SlotValues {
        const values: SlotValues = new Map();
        const bucket = (typeKey: SegmentTypeKey) => {
            const type = this.catalog.typeForKey(typeKey);
            // A condition naming a type that no longer exists is dropped rather
            // than guessed at. Dropping an `only` would widen access, so the
            // catalogue is reloaded before a projection run and a missing type
            // here means the type was deleted mid-run — rare, and safer to skip
            // than to write into someone else's slot.
            if (!type) return undefined;
            let entry = values.get(type.slot);
            if (!entry) {
                entry = { allow: [], deny: [] };
                values.set(type.slot, entry);
            }
            return entry;
        };

        for (const [typeKey, condition] of Object.entries(group.conditions)) {
            const slot = bucket(typeKey);
            if (!slot) continue;
            if (condition.mode === CONDITION_MODE.Only) {
                slot.allow.push(...condition.segmentIds);
            } else if (condition.mode === CONDITION_MODE.AllExcept) {
                slot.deny.push(...condition.segmentIds);
            }
            // `all` contributes nothing — an empty allow array is what the
            // predicate reads as "this group does not constrain this type".
        }

        for (const [typeKey, segmentIds] of Object.entries(exclusions)) {
            const slot = bucket(typeKey);
            if (!slot) continue;
            for (const id of segmentIds) {
                if (!slot.deny.includes(id)) slot.deny.push(id);
            }
        }

        return values;
    }
}

/** Spread a slot map onto the eight column pairs, defaulting the untouched ones. */
function slotColumnValues(values: SlotValues): Record<string, string[]> {
    const out: Record<string, string[]> = {};
    for (let slot = 1; slot <= 8; slot += 1) {
        const value = values.get(slot);
        out[`allowD${slot}`] = value?.allow ?? [];
        out[`denyD${slot}`] = value?.deny ?? [];
    }
    return out;
}
