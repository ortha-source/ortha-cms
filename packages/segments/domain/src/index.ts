/**
 * Public API of `@orthacms/segments-domain` — who may **read** published
 * content, decided by one pure function over two lists.
 *
 * Deliberately small. A segment is a named set of reader tags; an entry names
 * the segments that may read it and the segments that may not; `canRead` is the
 * whole decision. There is no rule object, no inheritance and no resolution
 * step, because what an editor sets on the entry *is* what a reader gets.
 *
 * Not RBAC, and not `workspace_content`: those answer who may **touch**
 * content, and they already exist.
 */

export { segmentIdsForTags } from './lib/segment';
export type { Segment } from './lib/segment';

export { ACCESS_MODE, OPEN_ACCESS, canRead, isOpen } from './lib/entry-access';
export type { AccessMode, EntryAccess } from './lib/entry-access';

export {
    anonymousSegmentResolver,
    staticSegmentResolver
} from './lib/segment-resolver.port';
export type { SegmentResolver } from './lib/segment-resolver.port';
