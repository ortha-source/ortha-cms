/**
 * The segmentation plugin's Drizzle schema.
 *
 * `drizzle.config.ts` points drizzle-kit at this barrel, so a table that is not
 * re-exported here is invisible to `db:generate` and will never reach a
 * migration.
 */

export {
    segmentTypes,
    segmentCardinality,
    segmentTypeState,
    segmentTypeManagedBy
} from './segment-types';
export { segments, segmentKind } from './segments';
export { accessRules, accessFallback, accessTargetKind } from './access-rules';
export { accessAssignments, segmentGrants } from './access-assignments';
export { entryAccess, slotColumnNames } from './entry-access';
