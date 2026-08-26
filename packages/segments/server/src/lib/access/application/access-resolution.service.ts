import { Injectable, Logger } from '@nestjs/common';
import { and, eq, gt, inArray, isNull, or, type SQL } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { InjectDatabase, type Database } from '@orthacms/database';
import {
    ACCESS_LEVEL,
    CONDITION_MODE,
    MAX_CONDITION_GROUPS,
    resolveAccess,
    type AuthoredAccessRule,
    type AuthoredConditionGroup,
    type Exclusions,
    type ResolvedAccessRule,
    type SegmentTypeKey
} from '@orthacms/segments-domain';
import { accessRules } from '../infrastructure/schema/access-rules';
import { accessAssignments } from '../infrastructure/schema/access-assignments';
import { segmentGrants } from '../infrastructure/schema/access-assignments';
import { SegmentCatalogService } from './segment-catalog.service';

/** What an entry's access resolved to, and where it came from. */
export interface ResolvedEntryAccess {
    /** What `evaluate` — and the projector — takes. */
    readonly rule: ResolvedAccessRule;
    /** The nearest assigned rule, for explanation. Null when only grants apply. */
    readonly ruleId: string | null;
    /** Levels that contributed, outermost first. */
    readonly contributors: readonly string[];
}

/** One rule row as stored. */
type RuleRow = typeof accessRules.$inferSelect;

/** An assignment joined to the rule it applies. */
interface AssignmentRow {
    readonly targetKind: 'workspace' | 'type' | 'entry';
    readonly targetEntryId: string | null;
    readonly rule: RuleRow;
}

/** A live grant, reduced to what resolution needs. */
interface GrantRow {
    readonly segmentId: string;
    readonly targetKind: 'workspace' | 'type' | 'entry';
    readonly targetEntryId: string | null;
}

/**
 * Resolves the rule that governs an entry — the chain of assignments above it,
 * plus whatever the segment side granted.
 *
 * Two sources meet here, and they are not symmetric:
 *
 * - **Assignments** attach a rule to a workspace, a content type or one entry.
 *   The chain is collapsed by the kernel's `resolveAccess`, which merges rather
 *   than replaces, so a type's restriction survives an entry being edited.
 * - **Grants** attach a *segment* to the same three levels, and can only ever
 *   widen: each becomes one more OR-ed condition group. That is the whole
 *   reason a grant carries no mode — "everyone except Globex" through grants
 *   would be 399 rows out of 400, which is the complement the projection
 *   invariant forbids.
 *
 * Exclusions still outrank both. A granted segment that a rule excludes does
 * not get in, because `evaluate` checks exclusions before it looks at a single
 * group.
 */
@Injectable()
export class AccessResolutionService {
    private readonly logger = new Logger(AccessResolutionService.name);

    constructor(
        @InjectDatabase() private readonly db: Database,
        private readonly catalog: SegmentCatalogService
    ) {}

    /** Resolve one entry — what the entry write hook calls. */
    async resolveEntry(input: {
        workspaceId: string;
        typeSlug: string;
        entryId: string;
    }): Promise<ResolvedEntryAccess> {
        const resolved = await this.resolveMany(
            input.workspaceId,
            input.typeSlug,
            [input.entryId]
        );
        return resolved.get(input.entryId) ?? this.empty();
    }

    /**
     * Resolve a batch of entries of one type.
     *
     * The workspace and type levels are read **once** for the whole batch and
     * the entry level in one query each — re-projecting a type is otherwise
     * three round trips per entry, which on a large collection is the
     * difference between a background job and an outage.
     */
    async resolveMany(
        workspaceId: string,
        typeSlug: string,
        entryIds: readonly string[]
    ): Promise<Map<string, ResolvedEntryAccess>> {
        const out = new Map<string, ResolvedEntryAccess>();
        if (!entryIds.length) {
            return out;
        }

        const [assignments, grants] = await Promise.all([
            this.loadAssignments(workspaceId, typeSlug, entryIds),
            this.loadGrants(workspaceId, typeSlug, entryIds)
        ]);

        const workspaceRule = assignments.find(
            (row) => row.targetKind === 'workspace'
        )?.rule;
        const typeRule = assignments.find(
            (row) => row.targetKind === 'type'
        )?.rule;
        const entryRules = new Map(
            assignments
                .filter((row) => row.targetKind === 'entry')
                .map((row) => [row.targetEntryId as string, row.rule])
        );

        const scopeGrants = grants.filter((row) => row.targetKind !== 'entry');
        const entryGrants = new Map<string, GrantRow[]>();
        for (const grant of grants) {
            if (grant.targetKind !== 'entry' || !grant.targetEntryId) continue;
            const bucket = entryGrants.get(grant.targetEntryId);
            if (bucket) bucket.push(grant);
            else entryGrants.set(grant.targetEntryId, [grant]);
        }

        for (const entryId of entryIds) {
            const entryRule = entryRules.get(entryId);
            const chain = resolveAccess([
                {
                    name: ACCESS_LEVEL.Workspace,
                    rule: toAuthored(workspaceRule)
                },
                { name: ACCESS_LEVEL.Type, rule: toAuthored(typeRule) },
                { name: ACCESS_LEVEL.Entry, rule: toAuthored(entryRule) }
            ]);
            const rule = this.withGrants(chain.rule, [
                ...scopeGrants,
                ...(entryGrants.get(entryId) ?? [])
            ]);
            out.set(entryId, {
                rule,
                ruleId:
                    entryRule?.id ?? typeRule?.id ?? workspaceRule?.id ?? null,
                contributors: chain.contributors
            });
        }
        return out;
    }

    /**
     * Fold grants into a resolved rule as extra OR-ed groups.
     *
     * Grants of the same segment type are collapsed into one group, so two
     * organisations granted the same report are `only [acme, initech]` rather
     * than two groups — that is an OR either way, and it keeps the group budget
     * for what an editor authored.
     */
    private withGrants(
        rule: ResolvedAccessRule,
        grants: readonly GrantRow[]
    ): ResolvedAccessRule {
        if (!grants.length) {
            return rule;
        }
        const byType = new Map<SegmentTypeKey, string[]>();
        for (const grant of grants) {
            const typeKey = this.catalog.typeKeyOfSegment(grant.segmentId);
            // A grant naming a segment the catalogue no longer holds is
            // dropped. Dropping it narrows access, which is the safe direction
            // — the alternative is guessing which axis it belonged to.
            if (!typeKey) continue;
            const bucket = byType.get(typeKey);
            if (bucket) {
                if (!bucket.includes(grant.segmentId))
                    bucket.push(grant.segmentId);
            } else {
                byType.set(typeKey, [grant.segmentId]);
            }
        }

        const grantGroups = [...byType.entries()].map(
            ([typeKey, segmentIds]) => ({
                conditions: {
                    [typeKey]: {
                        mode: CONDITION_MODE.Only,
                        segmentIds
                    }
                },
                source: ACCESS_LEVEL.Workspace
            })
        );

        const groups = [...rule.groups, ...grantGroups];
        if (groups.length <= MAX_CONDITION_GROUPS) {
            return { ...rule, groups };
        }

        // Never a silent cap: what was dropped is named, and the authored
        // groups are kept ahead of the granted ones because an editor's rule
        // outranks an administrative grant when something has to give.
        const kept = groups.slice(0, MAX_CONDITION_GROUPS);
        this.logger.warn(
            `Access resolution exceeded ${MAX_CONDITION_GROUPS} condition groups; ` +
                `${groups.length - kept.length} granted group(s) dropped for segment types ` +
                `${[...byType.keys()].slice(MAX_CONDITION_GROUPS - rule.groups.length).join(', ')}.`
        );
        return { ...rule, groups: kept };
    }

    /** Assignments reaching this batch, joined to their rules. */
    private async loadAssignments(
        workspaceId: string,
        typeSlug: string,
        entryIds: readonly string[]
    ): Promise<AssignmentRow[]> {
        const rows = await this.db
            .select({
                targetKind: accessAssignments.targetKind,
                targetEntryId: accessAssignments.targetEntryId,
                rule: accessRules
            })
            .from(accessAssignments)
            .innerJoin(
                accessRules,
                eq(accessRules.id, accessAssignments.ruleId)
            )
            .where(
                and(
                    eq(accessAssignments.workspaceId, workspaceId),
                    this.targetMatches(
                        accessAssignments.targetKind,
                        accessAssignments.targetSlug,
                        accessAssignments.targetEntryId,
                        typeSlug,
                        entryIds
                    )
                )
            );
        return rows as AssignmentRow[];
    }

    /** Live grants reaching this batch. */
    private async loadGrants(
        workspaceId: string,
        typeSlug: string,
        entryIds: readonly string[]
    ): Promise<GrantRow[]> {
        const rows = await this.db
            .select({
                segmentId: segmentGrants.segmentId,
                targetKind: segmentGrants.targetKind,
                targetEntryId: segmentGrants.targetEntryId
            })
            .from(segmentGrants)
            .where(
                and(
                    eq(segmentGrants.workspaceId, workspaceId),
                    // An expired grant is inert but kept, so the history of who
                    // had access when is not erased by the clock.
                    or(
                        isNull(segmentGrants.expiresAt),
                        gt(segmentGrants.expiresAt, new Date())
                    ),
                    this.targetMatches(
                        segmentGrants.targetKind,
                        segmentGrants.targetSlug,
                        segmentGrants.targetEntryId,
                        typeSlug,
                        entryIds
                    )
                )
            );
        return rows as GrantRow[];
    }

    /** The three target shapes, as one predicate. */
    private targetMatches(
        // Typed loosely on purpose: the assignments and the grants tables
        // carry the same three target columns, and one predicate for both is
        // what keeps "where does this apply" from drifting between them.
        kindColumn: AnyPgColumn,
        slugColumn: AnyPgColumn,
        entryColumn: AnyPgColumn,
        typeSlug: string,
        entryIds: readonly string[]
    ): SQL | undefined {
        return or(
            eq(kindColumn, 'workspace'),
            and(eq(kindColumn, 'type'), eq(slugColumn, typeSlug)),
            and(eq(kindColumn, 'entry'), inArray(entryColumn, [...entryIds]))
        );
    }

    /** A chain that said nothing. */
    private empty(): ResolvedEntryAccess {
        const chain = resolveAccess([]);
        return { rule: chain.rule, ruleId: null, contributors: [] };
    }
}

/** A stored rule row as the kernel's authored shape. */
function toAuthored(row: RuleRow | undefined): AuthoredAccessRule | null {
    if (!row) return null;
    return {
        exclusions: (row.exclusions ?? {}) as Exclusions,
        groups: (row.groups ?? []) as AuthoredConditionGroup[],
        startsAt: row.startsAt,
        endsAt: row.endsAt,
        fallback: row.fallback
    };
}
