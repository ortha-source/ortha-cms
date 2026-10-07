/**
 * Public API of `@orthacms/publishing-admin` — the **Publish Manager**: one
 * page for publishing a set of records together, with their translations and
 * the drafts they link to, through content's own dry run and bulk publish.
 */

export { PublishingPlugin } from './lib/presentation/publishingPlugin';
export type { PublishingAdminPlugin } from './lib/presentation/publishingPlugin';

// The two seams another plugin fills: extra cells for a set's records (the
// i18n plugin's translations) and per-entry notes (protection's approvals).
export {
    PUBLISH_ANNOTATION_SLOT,
    PUBLISH_EXPANSION_SLOT
} from './lib/presentation/slots/publishingSlots';
export type {
    PublishAnnotation,
    PublishAnnotationItem,
    PublishAnnotations,
    PublishAnnotationTone,
    PublishExpansion,
    PublishExpansionItem,
    PublishReadState,
    PublishSlotContext
} from './lib/presentation/slots/publishingSlots';
export type {
    PublishAxis,
    PublishCell,
    PublishEntry,
    PublishRecord,
    PublishVia
} from './lib/domain/types';
export { BASE_AXIS } from './lib/domain/types';

// Opening the page on a set, for a plugin with its own reason to start one.
export { useOpenInPublishManager } from './lib/presentation/hooks/useOpenInPublishManager';
