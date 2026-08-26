import type {
    SegmentCardinality,
    SegmentType
} from '../../domain/types/segmentType';
import type { Segment } from '../../domain/types/segment';
import type {
    AccessFallback,
    AccessRule,
    ConditionGroup
} from '../../domain/types/accessRule';
import type {
    AccessTarget,
    Assignment,
    Grant
} from '../../domain/types/accessTarget';
import type { ExplainResult } from '../../domain/types/explain';
import type { SegmentsListParams } from '../segmentsKeys';

/** What the create-type dialog submits. */
export type CreateSegmentTypeInput = {
    /** The tag namespace the type owns — lowercase, no colon. */
    key: string;
    /** Human-readable name. */
    label: string;
    /** Rendering hint; the server defaults to `low`. */
    cardinality?: SegmentCardinality;
};

/** A partial type edit; the key and the slot are immutable. */
export type UpdateSegmentTypeInput = {
    /** The type to edit. */
    id: string;
    /** New label. */
    label?: string;
    /** New rendering hint. */
    cardinality?: SegmentCardinality;
};

/** What the create-segment dialog submits. */
export type CreateSegmentInput = {
    /** The owning type's key. */
    typeKey: string;
    /** Key within the type — `acme` under `org` is the tag `org:acme`. */
    key: string;
    /** Human-readable name. */
    label: string;
    /** Reader tags to match; the server defaults to `<type>:<key>`. */
    tags?: string[];
};

/** A partial segment edit. */
export type UpdateSegmentInput = {
    /** The owning type's key (the route is nested under it). */
    typeKey: string;
    /** The segment to edit. */
    id: string;
    /** New label. */
    label?: string;
    /** New reader tags. Refused on a mask. */
    tags?: string[];
};

/** Identifies the segment to delete, and the type its route is nested under. */
export type DeleteSegmentInput = {
    typeKey: string;
    id: string;
};

/** What the rule editor submits — the same body for create and replace. */
export type SaveAccessRuleInput = {
    /** Url-safe key, unique within the workspace. */
    key: string;
    /** Human-readable name. */
    label: string;
    /** Segment type key → segment ids that never see the content. */
    exclusions?: Record<string, string[]>;
    /** OR-ed condition groups. */
    groups?: ConditionGroup[];
    /** Start of the visibility window, ISO-8601. */
    startsAt?: string;
    /** End of the visibility window, ISO-8601. */
    endsAt?: string;
    /** What a refused reader is served. */
    fallback?: AccessFallback;
};

/** A rule replacement carries the id alongside the body. */
export type UpdateAccessRuleInput = SaveAccessRuleInput & { id: string };

/** Attach a rule to a level. */
export type AssignRuleInput = {
    ruleId: string;
    target: AccessTarget;
};

/** Attach a segment to a level. */
export type GrantAccessInput = {
    segmentId: string;
    target: AccessTarget;
    /** When the grant lapses, ISO-8601; omit for open-ended. */
    expiresAt?: string;
};

/** Ask what one reader would see. */
export type ExplainAccessInput = {
    /** The content type the entry belongs to. */
    typeSlug: string;
    /** The entry to ask about. */
    entryId: string;
    /** The reader's tags; an empty list is the anonymous reader. */
    tags: string[];
};

/**
 * The port over the segmentation management API — the one seam this plugin
 * talks to instead of `apiClient` directly. {@link httpSegmentsGateway} is the
 * HTTP implementation.
 *
 * The two halves have **different scopes and that is not an accident**. The
 * catalogue methods (`listTypes`, `listSegments`, …) are installation-wide: a
 * segment type is an axis like a content type, and scoping it per workspace
 * would make `org` a different slot in each one. Everything else is
 * workspace-scoped, reaching the server through `apiClient`'s ambient
 * `X-Workspace-Id` header — so those methods are only callable from inside a
 * workspace route, and their cache keys carry the workspace id explicitly.
 */
export type SegmentsGateway = {
    /** Every segment type, with its slot and segment count. */
    listTypes(): Promise<SegmentType[]>;
    /** Creates a type on the lowest free slot, with its mask segment. */
    createType(input: CreateSegmentTypeInput): Promise<SegmentType>;
    /** Renames a type or changes how it renders. */
    updateType(input: UpdateSegmentTypeInput): Promise<SegmentType>;
    /** Retires a type: out of the predicate, slot zeroed, slot freed. */
    retireType(id: string): Promise<SegmentType>;

    /** One type's segments, optionally narrowed by a search term. */
    listSegments(
        typeKey: string,
        params?: SegmentsListParams
    ): Promise<Segment[]>;
    /** Creates a segment by hand. */
    createSegment(input: CreateSegmentInput): Promise<Segment>;
    /** Renames a segment or changes the reader tags it matches. */
    updateSegment(input: UpdateSegmentInput): Promise<Segment>;
    /** Deletes a segment nothing references. */
    deleteSegment(input: DeleteSegmentInput): Promise<void>;

    /** Every rule this workspace can use, its own and the global ones. */
    listRules(): Promise<AccessRule[]>;
    /** Creates a workspace-scoped rule. */
    createRule(input: SaveAccessRuleInput): Promise<AccessRule>;
    /** Replaces a rule and re-projects everything it reaches. */
    updateRule(input: UpdateAccessRuleInput): Promise<AccessRule>;
    /** Deletes a rule nothing is assigned to. */
    deleteRule(id: string): Promise<void>;

    /** Every assignment in the open workspace. */
    listAssignments(): Promise<Assignment[]>;
    /** Assigns a rule to a level, replacing whatever was there. */
    assign(input: AssignRuleInput): Promise<Assignment>;
    /** Removes an assignment and re-projects what it used to govern. */
    unassign(id: string): Promise<void>;

    /** One segment's grants, lapsed ones included. */
    listGrants(segmentId: string): Promise<Grant[]>;
    /** Grants a segment access to a level. */
    grant(input: GrantAccessInput): Promise<Grant>;
    /** Revokes a grant and re-projects. */
    revokeGrant(id: string): Promise<void>;

    /** Explains one reader's access to one entry, step by step. */
    explain(input: ExplainAccessInput): Promise<ExplainResult>;
};
