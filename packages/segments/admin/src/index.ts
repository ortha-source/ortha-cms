export { SegmentsPlugin } from './lib/presentation/segmentsPlugin';
export type { SegmentsAdminPlugin } from './lib/presentation/segmentsPlugin';
export {
    useSegments,
    useEntryAccess,
    SEGMENTS_READ,
    SEGMENTS_MANAGE
} from './lib/application/hooks';
export { segmentsKeys } from './lib/infrastructure/segmentsGateway';
export {
    isOpen,
    sameAccess,
    stateOf,
    withState,
    OPEN_ACCESS,
    SEGMENT_STATE
} from './lib/domain/types';
export type {
    EntryAccess,
    EntryAccessStaging,
    Segment,
    SegmentState
} from './lib/domain/types';
export { ENTRY_ACCESS_PRESAVE_ID } from './lib/application/useEntryAccessPresave';
