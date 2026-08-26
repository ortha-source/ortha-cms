import {
    BadRequestException,
    Injectable,
    NotFoundException
} from '@nestjs/common';
import { and, eq, isNull, or } from 'drizzle-orm';
import { InjectDatabase, type Database } from '@orthacms/database';
import { ContentTypeRegistry } from '@orthacms/content-server';
import { accessRules } from '../infrastructure/schema/access-rules';
import {
    accessAssignments,
    segmentGrants
} from '../infrastructure/schema/access-assignments';
import { segments } from '../infrastructure/schema/segments';
import { ReprojectionService } from './reprojection.service';

/** Which level something attaches to. */
export type TargetKind = 'workspace' | 'type' | 'entry';

/** Where a rule or a grant applies. */
export interface AccessTarget {
    kind: TargetKind;
    /** Content type slug — required for `type` and `entry`. */
    typeSlug?: string;
    /** Entry id — required for `entry`. */
    entryId?: string;
}

/** One assignment as the admin sees it. */
export interface AssignmentView {
    id: string;
    ruleId: string;
    ruleLabel: string;
    workspaceId: string;
    target: AccessTarget;
}

/** One grant as the segment card shows it. */
export interface GrantView {
    id: string;
    segmentId: string;
    segmentLabel: string;
    workspaceId: string;
    target: AccessTarget;
    expiresAt: string | null;
}

/**
 * The two ways access is declared, and the re-projection that makes either one
 * take effect.
 *
 * **Assignments** attach a rule to a level, from the content side.
 * **Grants** attach a segment to a level, from the segment side — "what is this
 * client allowed to reach". They meet in `AccessResolutionService`, where a
 * grant becomes one more OR-ed group.
 *
 * A grant carries **no mode**, and that is the load-bearing asymmetry: "everyone
 * except Globex" from the segment side would be 399 grants out of 400, storing
 * the complement instead of the exclusion — the one thing the projection
 * invariant forbids, because onboarding an organisation would then rewrite
 * every entry in the library. Exclusions live on the content side, in a rule.
 *
 * Every write here ends in a re-projection of the target, for the same reason
 * a rule edit does: the entries did not move, so nothing else re-derives them.
 */
@Injectable()
export class AssignmentsService {
    constructor(
        @InjectDatabase() private readonly db: Database,
        private readonly registry: ContentTypeRegistry,
        private readonly reprojection: ReprojectionService
    ) {}

    /** Every assignment in one workspace. */
    async listAssignments(workspaceId: string): Promise<AssignmentView[]> {
        const rows = await this.db
            .select({
                id: accessAssignments.id,
                ruleId: accessAssignments.ruleId,
                ruleLabel: accessRules.label,
                targetKind: accessAssignments.targetKind,
                targetSlug: accessAssignments.targetSlug,
                targetEntryId: accessAssignments.targetEntryId
            })
            .from(accessAssignments)
            .innerJoin(
                accessRules,
                eq(accessRules.id, accessAssignments.ruleId)
            )
            .where(eq(accessAssignments.workspaceId, workspaceId));
        return rows.map((row) => ({
            id: row.id,
            ruleId: row.ruleId,
            ruleLabel: row.ruleLabel,
            workspaceId,
            target: toTarget(row)
        }));
    }

    /**
     * Assign a rule to a target, replacing whatever was there.
     *
     * Replace rather than append: one rule governs a level, and two assignments
     * on one target would make "which rule applies here" an ordering question
     * with no answer an editor could predict.
     */
    async assign(
        workspaceId: string,
        input: { ruleId: string; target: AccessTarget; actorId: string | null }
    ): Promise<AssignmentView> {
        const rule = await this.ruleFor(workspaceId, input.ruleId);
        this.assertTarget(input.target);

        await this.clearAssignment(workspaceId, input.target);
        const [row] = await this.db
            .insert(accessAssignments)
            .values({
                ruleId: rule.id,
                workspaceId,
                targetKind: input.target.kind,
                targetSlug: input.target.typeSlug ?? null,
                targetEntryId: input.target.entryId ?? null,
                createdBy: input.actorId
            })
            .returning();

        await this.reproject(workspaceId, input.target);
        return {
            id: row.id,
            ruleId: rule.id,
            ruleLabel: rule.label,
            workspaceId,
            target: input.target
        };
    }

    /** Remove an assignment, then re-project what it used to govern. */
    async unassign(workspaceId: string, id: string): Promise<void> {
        const [row] = await this.db
            .select()
            .from(accessAssignments)
            .where(
                and(
                    eq(accessAssignments.id, id),
                    eq(accessAssignments.workspaceId, workspaceId)
                )
            )
            .limit(1);
        if (!row) throw new NotFoundException('Unknown assignment.');
        await this.db
            .delete(accessAssignments)
            .where(eq(accessAssignments.id, id));
        await this.reproject(workspaceId, toTarget(row));
    }

    /** Every live and lapsed grant of one segment. */
    async listGrants(segmentId: string): Promise<GrantView[]> {
        const rows = await this.db
            .select({
                id: segmentGrants.id,
                segmentId: segmentGrants.segmentId,
                segmentLabel: segments.label,
                workspaceId: segmentGrants.workspaceId,
                targetKind: segmentGrants.targetKind,
                targetSlug: segmentGrants.targetSlug,
                targetEntryId: segmentGrants.targetEntryId,
                expiresAt: segmentGrants.expiresAt
            })
            .from(segmentGrants)
            .innerJoin(segments, eq(segments.id, segmentGrants.segmentId))
            .where(eq(segmentGrants.segmentId, segmentId));
        return rows.map((row) => ({
            id: row.id,
            segmentId: row.segmentId,
            segmentLabel: row.segmentLabel,
            workspaceId: row.workspaceId,
            target: toTarget(row),
            expiresAt: row.expiresAt?.toISOString() ?? null
        }));
    }

    /** Grant a segment access to a target. */
    async grant(
        workspaceId: string,
        input: {
            segmentId: string;
            target: AccessTarget;
            expiresAt?: string;
            actorId: string | null;
        }
    ): Promise<GrantView> {
        const [segment] = await this.db
            .select()
            .from(segments)
            .where(eq(segments.id, input.segmentId))
            .limit(1);
        if (!segment) throw new NotFoundException('Unknown segment.');
        this.assertTarget(input.target);

        const [row] = await this.db
            .insert(segmentGrants)
            .values({
                segmentId: segment.id,
                workspaceId,
                targetKind: input.target.kind,
                targetSlug: input.target.typeSlug ?? null,
                targetEntryId: input.target.entryId ?? null,
                expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
                createdBy: input.actorId
            })
            .onConflictDoNothing()
            .returning();
        if (!row) {
            throw new BadRequestException(
                'That segment already has this grant.'
            );
        }

        await this.reproject(workspaceId, input.target);
        return {
            id: row.id,
            segmentId: segment.id,
            segmentLabel: segment.label,
            workspaceId,
            target: input.target,
            expiresAt: row.expiresAt?.toISOString() ?? null
        };
    }

    /** Revoke a grant, then re-project. */
    async revoke(workspaceId: string, id: string): Promise<void> {
        const [row] = await this.db
            .select()
            .from(segmentGrants)
            .where(
                and(
                    eq(segmentGrants.id, id),
                    eq(segmentGrants.workspaceId, workspaceId)
                )
            )
            .limit(1);
        if (!row) throw new NotFoundException('Unknown grant.');
        await this.db.delete(segmentGrants).where(eq(segmentGrants.id, id));
        await this.reproject(workspaceId, toTarget(row));
    }

    /** Re-project exactly what a target covers. */
    private async reproject(
        workspaceId: string,
        target: AccessTarget
    ): Promise<void> {
        if (target.kind === 'workspace') {
            await this.reprojection.reprojectWorkspace(workspaceId);
            return;
        }
        // An entry-level change still walks its type. Narrower would be
        // possible, but a rule change reaching one entry is also the cheapest
        // walk there is, and one code path is worth more than the saving.
        await this.reprojection.reprojectType(
            workspaceId,
            target.typeSlug as string
        );
    }

    /** Delete the assignment already on a target, if any. */
    private async clearAssignment(
        workspaceId: string,
        target: AccessTarget
    ): Promise<void> {
        const scope =
            target.kind === 'workspace'
                ? eq(accessAssignments.targetKind, 'workspace')
                : target.kind === 'type'
                  ? and(
                        eq(accessAssignments.targetKind, 'type'),
                        eq(
                            accessAssignments.targetSlug,
                            target.typeSlug as string
                        )
                    )
                  : and(
                        eq(accessAssignments.targetKind, 'entry'),
                        eq(
                            accessAssignments.targetEntryId,
                            target.entryId as string
                        )
                    );
        await this.db
            .delete(accessAssignments)
            .where(and(eq(accessAssignments.workspaceId, workspaceId), scope));
    }

    /** A rule this workspace may use, or a 404. */
    private async ruleFor(workspaceId: string, ruleId: string) {
        const [row] = await this.db
            .select()
            .from(accessRules)
            .where(
                and(
                    eq(accessRules.id, ruleId),
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

    /**
     * A target names what it must name, and the type it names exists.
     *
     * An assignment onto an unregistered type is silently inert — nothing would
     * ever walk it — so it is rejected here rather than accepted and forgotten.
     */
    private assertTarget(target: AccessTarget): void {
        if (target.kind === 'workspace') return;
        if (!target.typeSlug) {
            throw new BadRequestException(
                `A ${target.kind} target must name a content type.`
            );
        }
        if (!this.registry.get(target.typeSlug)) {
            throw new BadRequestException(
                `Unknown content type "${target.typeSlug}".`
            );
        }
        if (target.kind === 'entry' && !target.entryId) {
            throw new BadRequestException(
                'An entry target must name an entry.'
            );
        }
    }
}

/** Row → the wire's target shape. */
function toTarget(row: {
    targetKind: TargetKind;
    targetSlug: string | null;
    targetEntryId: string | null;
}): AccessTarget {
    return {
        kind: row.targetKind,
        ...(row.targetSlug ? { typeSlug: row.targetSlug } : {}),
        ...(row.targetEntryId ? { entryId: row.targetEntryId } : {})
    };
}
