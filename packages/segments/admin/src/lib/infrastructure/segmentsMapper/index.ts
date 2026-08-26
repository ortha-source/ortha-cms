import type {
    SegmentType,
    SegmentCardinality,
    SegmentTypeManagedBy,
    SegmentTypeState
} from '../../domain/types/segmentType';
import type { Segment, SegmentKind } from '../../domain/types/segment';
import type {
    AccessFallback,
    AccessRule,
    Condition,
    ConditionGroup,
    ConditionMode
} from '../../domain/types/accessRule';
import type {
    AccessTarget,
    Assignment,
    Grant,
    TargetKind
} from '../../domain/types/accessTarget';

/** A segment type as `GET /api/access/segment-types` returns it. */
export type SegmentTypeResponse = {
    id: string;
    key: string;
    label: string;
    cardinality: SegmentCardinality;
    slot: number;
    state: SegmentTypeState;
    managedBy: SegmentTypeManagedBy;
    segmentCount: number;
};

/** A segment as the segments endpoint returns it. */
export type SegmentResponse = {
    id: string;
    typeId: string;
    typeKey: string;
    key: string;
    label: string;
    kind: SegmentKind;
    tags: string[];
    usageCount: number;
};

/** A rule as `GET /api/access/rules` returns it (timestamps are ISO). */
export type AccessRuleResponse = {
    id: string;
    workspaceId: string | null;
    key: string;
    label: string;
    exclusions: Record<string, string[]>;
    groups: {
        conditions: Record<string, { mode: string; segmentIds?: string[] }>;
    }[];
    startsAt: string | null;
    endsAt: string | null;
    fallback: AccessFallback;
    assignmentCount: number;
};

/** A target as either assignment endpoint returns it. */
export type AccessTargetResponse = {
    kind: TargetKind;
    typeSlug?: string;
    entryId?: string;
};

/** An assignment as `GET /api/access/assignments` returns it. */
export type AssignmentResponse = {
    id: string;
    ruleId: string;
    ruleLabel: string;
    workspaceId: string;
    target: AccessTargetResponse;
};

/** A grant as `GET /api/access/grants/segment/:id` returns it. */
export type GrantResponse = {
    id: string;
    segmentId: string;
    segmentLabel: string;
    workspaceId: string;
    target: AccessTargetResponse;
    expiresAt: string | null;
};

/** Maps a segment type from the wire to the admin's model. */
export function toSegmentType(dto: SegmentTypeResponse): SegmentType {
    return {
        id: dto.id,
        key: dto.key,
        label: dto.label,
        cardinality: dto.cardinality,
        slot: dto.slot,
        state: dto.state,
        managedBy: dto.managedBy,
        segmentCount: dto.segmentCount
    };
}

/** Maps a segment from the wire to the admin's model. */
export function toSegment(dto: SegmentResponse): Segment {
    return {
        id: dto.id,
        typeId: dto.typeId,
        typeKey: dto.typeKey,
        key: dto.key,
        label: dto.label,
        kind: dto.kind,
        tags: dto.tags ?? [],
        usageCount: dto.usageCount
    };
}

/**
 * Every mode the editor can render, including the authored-only `inherit`.
 *
 * The wire types a condition's mode as a bare `string` — the server validates
 * it against the same list, but a DTO's `IsIn` is not a type. Narrowing here,
 * rather than casting at the call site, is what keeps an unknown mode from
 * reaching a component that would render `undefined` as the condition's whole
 * meaning. An unrecognised mode falls back to `all`, the one value that cannot
 * silently close content.
 */
const MODES: readonly ConditionMode[] = [
    'all',
    'only',
    'all-except',
    'inherit'
];

/** Narrows the wire's `string` mode, defaulting to the open one. */
function toMode(value: string): ConditionMode {
    return MODES.find((mode) => mode === value) ?? 'all';
}

/** Maps one authored condition. */
function toCondition(dto: { mode: string; segmentIds?: string[] }): Condition {
    return { mode: toMode(dto.mode), segmentIds: [...(dto.segmentIds ?? [])] };
}

/** Maps one AND-group. */
function toConditionGroup(dto: {
    conditions: Record<string, { mode: string; segmentIds?: string[] }>;
}): ConditionGroup {
    const conditions: Record<string, Condition> = {};
    for (const [typeKey, condition] of Object.entries(dto.conditions ?? {})) {
        conditions[typeKey] = toCondition(condition);
    }
    return { conditions };
}

/** Maps a rule from the wire to the admin's model (timestamps → `Date`). */
export function toAccessRule(dto: AccessRuleResponse): AccessRule {
    return {
        id: dto.id,
        workspaceId: dto.workspaceId,
        key: dto.key,
        label: dto.label,
        exclusions: Object.fromEntries(
            Object.entries(dto.exclusions ?? {}).map(([typeKey, ids]) => [
                typeKey,
                [...ids]
            ])
        ),
        groups: (dto.groups ?? []).map(toConditionGroup),
        startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
        fallback: dto.fallback,
        assignmentCount: dto.assignmentCount
    };
}

/** Maps a target, dropping the keys the wire leaves undefined. */
function toTarget(dto: AccessTargetResponse): AccessTarget {
    return {
        kind: dto.kind,
        ...(dto.typeSlug ? { typeSlug: dto.typeSlug } : {}),
        ...(dto.entryId ? { entryId: dto.entryId } : {})
    };
}

/** Maps an assignment from the wire to the admin's model. */
export function toAssignment(dto: AssignmentResponse): Assignment {
    return {
        id: dto.id,
        ruleId: dto.ruleId,
        ruleLabel: dto.ruleLabel,
        workspaceId: dto.workspaceId,
        target: toTarget(dto.target)
    };
}

/** Maps a grant from the wire to the admin's model. */
export function toGrant(dto: GrantResponse): Grant {
    return {
        id: dto.id,
        segmentId: dto.segmentId,
        segmentLabel: dto.segmentLabel,
        workspaceId: dto.workspaceId,
        target: toTarget(dto.target),
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null
    };
}
