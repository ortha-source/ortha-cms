export { SegmentsPlugin } from './lib/presentation/segmentsPlugin';
export type { SegmentsAdminPlugin } from './lib/presentation/segmentsPlugin';
export { useSegmentTypes } from './lib/application/useSegmentTypes';
export { useSegments } from './lib/application/useSegments';
export { useAccessRules } from './lib/application/useAccessRules';
export { useAssignments } from './lib/application/useAssignments';
export { useEntryAccess } from './lib/application/useEntryAccess';
export { segmentsKeys } from './lib/infrastructure/segmentsKeys';
export { resolveEntryAccess } from './lib/domain/entryAccess';
export type { AccessLevel, EntryAccess } from './lib/domain/entryAccess';
export type {
    SegmentType,
    SegmentCardinality,
    SegmentTypeState,
    SegmentTypeManagedBy
} from './lib/domain/types/segmentType';
export type { Segment, SegmentKind } from './lib/domain/types/segment';
export type {
    AccessRule,
    AccessFallback,
    Condition,
    ConditionGroup,
    ConditionMode
} from './lib/domain/types/accessRule';
export type {
    AccessTarget,
    Assignment,
    Grant,
    TargetKind
} from './lib/domain/types/accessTarget';
export type { ExplainResult, ExplainStep } from './lib/domain/types/explain';
