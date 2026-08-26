import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException
} from '@nestjs/common';
import { and, asc, eq, isNull, or, sql } from 'drizzle-orm';
import { InjectDatabase, type Database } from '@orthacms/database';
import {
    CONDITION_MODE,
    INHERIT,
    MAX_CONDITION_GROUPS,
    type AuthoredCondition,
    type AuthoredConditionGroup
} from '@orthacms/segments-domain';
import { accessRules } from '../infrastructure/schema/access-rules';
import { accessAssignments } from '../infrastructure/schema/access-assignments';
import { SegmentCatalogService } from './segment-catalog.service';
import { ReprojectionService } from './reprojection.service';

/** One rule as the library shows it. */
export interface AccessRuleView {
    id: string;
    workspaceId: string | null;
    key: string;
    label: string;
    exclusions: Record<string, string[]>;
    /**
     * Wrapped the same way the request wraps them, so the shape a caller sends
     * is the shape it reads back. Stored flat — a group *is* the map from
     * segment type to condition — and the wrapper is the wire's.
     */
    groups: { conditions: AuthoredConditionGroup }[];
    startsAt: string | null;
    endsAt: string | null;
    fallback: 'hidden' | 'teaser' | 'paywall';
    /** Assignments naming this rule — "used by 412 entries in 3 workspaces". */
    assignmentCount: number;
}

/** What a caller submits. */
export interface SaveAccessRuleInput {
    key: string;
    label: string;
    exclusions?: Record<string, string[]>;
    groups?: {
        conditions: Record<string, { mode: string; segmentIds?: string[] }>;
    }[];
    startsAt?: string;
    endsAt?: string;
    fallback?: 'hidden' | 'teaser' | 'paywall';
}

/**
 * The rule library — the reusable unit an assignment points at.
 *
 * Editing a rule is the operation with the widest blast radius in the whole
 * feature: one row changes what every entry it is assigned to shows every
 * reader. So every write here ends in a re-projection of exactly the targets
 * that rule reaches, and nothing is left to a background sweep.
 *
 * Validation is deliberately semantic rather than structural. The DTO checks
 * shapes; this checks the two things that make a rule *mean* something — that
 * every segment id exists, and that every segment named under a type key
 * actually belongs to that type. A rule naming a plan under `org` would resolve
 * to a condition nobody can satisfy, closing content with no error anywhere.
 */
@Injectable()
export class AccessRulesService {
    constructor(
        @InjectDatabase() private readonly db: Database,
        private readonly catalog: SegmentCatalogService,
        private readonly reprojection: ReprojectionService
    ) {}

    /** Every rule visible from one workspace: its own, plus the global ones. */
    async list(workspaceId: string): Promise<AccessRuleView[]> {
        const rows = await this.db
            .select()
            .from(accessRules)
            .where(
                or(
                    eq(accessRules.workspaceId, workspaceId),
                    isNull(accessRules.workspaceId)
                )
            )
            .orderBy(asc(accessRules.label));
        const counts = await this.db
            .select({
                ruleId: accessAssignments.ruleId,
                count: sql<number>`count(*)::int`
            })
            .from(accessAssignments)
            .groupBy(accessAssignments.ruleId);
        const byRule = new Map(counts.map((row) => [row.ruleId, row.count]));
        return rows.map((row) => this.view(row, byRule.get(row.id) ?? 0));
    }

    /** Create a workspace-scoped rule. */
    async create(
        workspaceId: string,
        input: SaveAccessRuleInput
    ): Promise<AccessRuleView> {
        this.assertValid(input);
        const [clash] = await this.db
            .select({ id: accessRules.id })
            .from(accessRules)
            .where(
                and(
                    eq(accessRules.workspaceId, workspaceId),
                    eq(accessRules.key, input.key)
                )
            )
            .limit(1);
        if (clash) {
            throw new ConflictException(
                `A rule with the key "${input.key}" already exists in this workspace.`
            );
        }
        const [row] = await this.db
            .insert(accessRules)
            .values({
                workspaceId,
                key: input.key,
                label: input.label,
                exclusions: input.exclusions ?? {},
                groups: normaliseGroups(input.groups),
                startsAt: input.startsAt ? new Date(input.startsAt) : null,
                endsAt: input.endsAt ? new Date(input.endsAt) : null,
                fallback: input.fallback ?? 'teaser'
            })
            .returning();
        // A brand-new rule reaches nothing yet — it is an assignment that puts
        // it to work — so there is nothing to re-project.
        return this.view(row, 0);
    }

    /**
     * Replace a rule's contents.
     *
     * Then re-project every target it is assigned to. Skipping this is the
     * mistake that matters here: the entries did not move, so nothing else
     * would ever re-derive them, and the rule and the projection would disagree
     * indefinitely — the projection being what readers actually get.
     */
    async update(
        workspaceId: string,
        id: string,
        input: SaveAccessRuleInput
    ): Promise<AccessRuleView> {
        this.assertValid(input);
        const current = await this.byId(id, workspaceId);
        if (current.workspaceId === null) {
            throw new BadRequestException(
                'This is an installation-wide rule and cannot be edited from a workspace.'
            );
        }
        const [row] = await this.db
            .update(accessRules)
            .set({
                key: input.key,
                label: input.label,
                exclusions: input.exclusions ?? {},
                groups: normaliseGroups(input.groups),
                startsAt: input.startsAt ? new Date(input.startsAt) : null,
                endsAt: input.endsAt ? new Date(input.endsAt) : null,
                fallback: input.fallback ?? 'teaser',
                updatedAt: new Date()
            })
            .where(eq(accessRules.id, id))
            .returning();
        await this.reprojectTargetsOf(id);
        return this.view(row, await this.assignmentCount(id));
    }

    /** Delete a rule nothing is assigned to. */
    async remove(workspaceId: string, id: string): Promise<void> {
        const current = await this.byId(id, workspaceId);
        if (current.workspaceId === null) {
            throw new BadRequestException(
                'This is an installation-wide rule and cannot be deleted from a workspace.'
            );
        }
        const count = await this.assignmentCount(id);
        if (count > 0) {
            throw new ConflictException(
                `"${current.label}" is assigned in ${count} place${count === 1 ? '' : 's'}. Remove the assignments first — deleting it would silently open everything it governs.`
            );
        }
        await this.db.delete(accessRules).where(eq(accessRules.id, id));
    }

    /** Re-project everything one rule reaches. */
    async reprojectTargetsOf(ruleId: string): Promise<void> {
        const targets = await this.db
            .select({
                workspaceId: accessAssignments.workspaceId,
                targetKind: accessAssignments.targetKind,
                targetSlug: accessAssignments.targetSlug
            })
            .from(accessAssignments)
            .where(eq(accessAssignments.ruleId, ruleId));
        await this.reprojection.reprojectRuleTargets(
            targets.map((target) => ({
                workspaceId: target.workspaceId,
                // A workspace- or entry-level assignment does not name a type,
                // so the whole workspace is walked. An entry-level one could be
                // narrower, but a rule assigned to a handful of entries is also
                // the case where the walk is cheapest.
                typeSlug:
                    target.targetKind === 'type' ? target.targetSlug : null
            }))
        );
    }

    /**
     * The semantic checks the DTO cannot make.
     *
     * Every named segment must exist, and must belong to the type it is named
     * under. Both failures produce a rule that silently refuses everyone rather
     * than an error, which is why they are rejected at the door.
     */
    private assertValid(input: SaveAccessRuleInput): void {
        const { segments } = this.catalog.snapshot();
        const byId = new Map(segments.map((segment) => [segment.id, segment]));

        const check = (typeKey: string, ids: readonly string[]) => {
            for (const id of ids) {
                const segment = byId.get(id);
                if (!segment) {
                    throw new BadRequestException(`Unknown segment "${id}".`);
                }
                if (segment.typeKey !== typeKey) {
                    throw new BadRequestException(
                        `Segment "${segment.label}" belongs to "${segment.typeKey}", not "${typeKey}".`
                    );
                }
            }
        };

        for (const [typeKey, ids] of Object.entries(input.exclusions ?? {})) {
            if (!this.catalog.typeForKey(typeKey)) {
                throw new BadRequestException(
                    `Unknown segment type "${typeKey}".`
                );
            }
            check(typeKey, ids);
        }

        const groups = input.groups ?? [];
        if (groups.length > MAX_CONDITION_GROUPS) {
            throw new BadRequestException(
                `A rule may hold at most ${MAX_CONDITION_GROUPS} condition groups.`
            );
        }
        for (const group of groups) {
            for (const [typeKey, condition] of Object.entries(
                group.conditions ?? {}
            )) {
                if (!this.catalog.typeForKey(typeKey)) {
                    throw new BadRequestException(
                        `Unknown segment type "${typeKey}".`
                    );
                }
                if (
                    condition.mode === CONDITION_MODE.Only ||
                    condition.mode === CONDITION_MODE.AllExcept
                ) {
                    check(typeKey, condition.segmentIds ?? []);
                }
            }
        }
    }

    /** One rule reachable from this workspace, or a 404. */
    private async byId(id: string, workspaceId: string) {
        const [row] = await this.db
            .select()
            .from(accessRules)
            .where(
                and(
                    eq(accessRules.id, id),
                    or(
                        eq(accessRules.workspaceId, workspaceId),
                        isNull(accessRules.workspaceId)
                    )
                )
            )
            .limit(1);
        if (!row) throw new NotFoundException('Unknown access rule.');
        return row;
    }

    /** How many assignments name a rule. */
    private async assignmentCount(ruleId: string): Promise<number> {
        const [row] = await this.db
            .select({ count: sql<number>`count(*)::int` })
            .from(accessAssignments)
            .where(eq(accessAssignments.ruleId, ruleId));
        return row?.count ?? 0;
    }

    /** Row → wire shape. */
    private view(
        row: typeof accessRules.$inferSelect,
        assignmentCount: number
    ): AccessRuleView {
        return {
            id: row.id,
            workspaceId: row.workspaceId,
            key: row.key,
            label: row.label,
            exclusions: (row.exclusions ?? {}) as Record<string, string[]>,
            groups: ((row.groups ?? []) as AuthoredConditionGroup[]).map(
                (conditions) => ({ conditions })
            ),
            startsAt: row.startsAt?.toISOString() ?? null,
            endsAt: row.endsAt?.toISOString() ?? null,
            fallback: row.fallback,
            assignmentCount
        };
    }
}

/** Wire groups → the kernel's authored shape, defaulting absent id lists. */
function normaliseGroups(
    groups: SaveAccessRuleInput['groups']
): AuthoredConditionGroup[] {
    return (groups ?? []).map((group) => {
        const conditions: Record<string, AuthoredCondition> = {};
        for (const [typeKey, condition] of Object.entries(
            group.conditions ?? {}
        )) {
            conditions[typeKey] = {
                mode: condition.mode as typeof INHERIT,
                segmentIds: condition.segmentIds ?? []
            };
        }
        return conditions as AuthoredConditionGroup;
    });
}
