/** Public API of @orthacms/segments-server. */

export { SegmentsPlugin } from './lib/utils/segments-plugin';
export type { SegmentsServerPluginType } from './lib/utils/segments-plugin';
export type {
    DeclaredSegmentType,
    SegmentsPluginConfig
} from './lib/types/segments-config';

export { SegmentsModule } from './lib/segments.module';
export { SEGMENTS_CONFIG, InjectSegmentsConfig } from './lib/segments.tokens';

// The catalogue and the projection are exported because the management API and
// the entry write hook — both following in their own packages — drive them.
export { SegmentCatalogService } from './lib/access/application/segment-catalog.service';
export type { CatalogSnapshot } from './lib/access/application/segment-catalog.service';
export { ProjectionService } from './lib/access/application/projection.service';
export type { ProjectionTarget } from './lib/access/application/projection.service';
export {
    CallerSegmentsStore,
    ANONYMOUS_CALLER
} from './lib/access/application/caller-segments.store';
export type { CallerSegments } from './lib/access/application/caller-segments.store';
export { MASK_SEGMENT_KEY } from './lib/access/application/declared-types.reconciler';

// The management surface's services, exported for the admin's own server-side
// callers and for tests. The controllers are internal.
export { AccessResolutionService } from './lib/access/application/access-resolution.service';
export type { ResolvedEntryAccess } from './lib/access/application/access-resolution.service';
export { ReprojectionService } from './lib/access/application/reprojection.service';
export type { ReprojectionResult } from './lib/access/application/reprojection.service';
export { ExplainService } from './lib/access/application/explain.service';
export type {
    ExplainResult,
    ExplainStep
} from './lib/access/application/explain.service';
export type { SegmentTypeView } from './lib/access/application/segment-types.service';
export type { SegmentView } from './lib/access/application/segments.service';
export type { AccessRuleView } from './lib/access/application/access-rules.service';
export type {
    AccessTarget,
    AssignmentView,
    GrantView
} from './lib/access/application/assignments.service';

// The predicate halves are exported for tests and for the impact preview, which
// has to reason about what a read would match without issuing one.
export { planAccessPredicate } from './lib/access/infrastructure/predicate/access-plan';
export type {
    AccessPlan,
    CallerSegmentsByType,
    SlotPlan
} from './lib/access/infrastructure/predicate/access-plan';
export { buildAccessPredicate } from './lib/access/infrastructure/predicate/access-predicate';

// The schema, re-exported so a consumer (and the host's drizzle-kit entry) can
// reach the tables this plugin owns.
export * from './lib/access/infrastructure/schema';
