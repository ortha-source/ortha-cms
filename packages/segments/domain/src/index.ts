/** Public API of @orthacms/segments-domain. */

export {
    SEGMENT_CARDINALITY,
    SEGMENT_SOURCE_KIND,
    SEGMENT_TYPE_MANAGED_BY,
    SEGMENT_TYPE_STATE,
    tagNamespace
} from './lib/segment-type';
export type {
    SegmentCardinality,
    SegmentSourceKind,
    SegmentTag,
    SegmentType,
    SegmentTypeKey,
    SegmentTypeManagedBy,
    SegmentTypeState
} from './lib/segment-type';

export {
    SEGMENT_KIND,
    groupSegmentIdsByType,
    segmentIdsForTags,
    segmentMatchesTag
} from './lib/segment';
export type { Segment, SegmentKind } from './lib/segment';

export {
    ACCESS_FALLBACK,
    ACCESS_LEVEL,
    CONDITION_MODE,
    INHERIT,
    OPEN_ACCESS,
    isUnrestricted
} from './lib/access-rule';
export type {
    AccessFallback,
    AccessLevelName,
    AuthoredAccessRule,
    AuthoredCondition,
    AuthoredConditionGroup,
    ConditionMode,
    Exclusions,
    ResolvedAccessRule,
    ResolvedCondition,
    ResolvedConditionGroup
} from './lib/access-rule';

export { DENIAL_REASON, evaluate } from './lib/evaluate';
export type {
    AccessDecision,
    ClosestGroup,
    DenialReason,
    EvaluationInput
} from './lib/evaluate';

export { resolveAccess } from './lib/inheritance';
export type { AccessLevel, ResolvedAccess } from './lib/inheritance';

export {
    anonymousSegmentResolver,
    staticSegmentResolver
} from './lib/segment-resolver.port';
export type { SegmentResolver } from './lib/segment-resolver.port';

export { MAX_CONDITION_GROUPS, MAX_SEGMENT_TYPES } from './lib/limits';

// Adoption: the mapping from the relation-pair scheme almost every CMS starts
// with (an "included" and an "excluded" list on the entry) onto a rule. Shipped
// as a tested function rather than a script, because the old scheme lives in the
// adopting app's own fields — see `docs/segments-adoption.md`.
export {
    groupByRelationSets,
    relationSetsFit,
    ruleFromRelationSets
} from './lib/adopt-relation-sets';
export type {
    RelationSetGroup,
    RelationSetGrouping,
    RelationSets
} from './lib/adopt-relation-sets';
