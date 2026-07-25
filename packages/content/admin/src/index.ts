export { ContentPlugin } from './lib/presentation/contentPlugin';
export type { ContentAdminPlugin } from './lib/presentation/contentPlugin';

export {
    CONTENT_OVERLAY_SLOT,
    ENTRY_HEADER_SLOT,
    ENTRY_PARAMS_SLOT,
    ENTRY_SIDEBAR_WIDGET_SLOT,
    ENTRY_TAB_SLOT,
    RECORDS_COLUMN_SLOT,
    RECORDS_FILTER_FIELDS_SLOT,
    RECORDS_TOOLBAR_SLOT
} from './lib/presentation/slots/contentSlots';
export type {
    ContentOverlayItem,
    EntryHeaderItem,
    EntryParamsItem,
    EntrySlotContext,
    EntrySidebarWidgetItem,
    EntryTabContext,
    EntryTabForm,
    EntryTabItem,
    RecordsColumnCellContext,
    RecordsColumnItem,
    RecordsFilterFieldsItem,
    RecordsToolbarContext,
    RecordsToolbarItem
} from './lib/presentation/slots/contentSlots';

export type {
    ContentField,
    ContentType,
    ContentTypeDetail,
    EntryRecord,
    EntryStatus,
    MediaRef
} from './lib/domain/types/contentType';
export { ENTRY_MODE, type EntryMode } from './lib/domain/constants';
export { CONTENT_FIELD_TYPE, ENTRY_TAB } from './lib/domain/constants';

// The publish-state classification + its one rendering, exported so a plugin
// contributing its own view of an entry (the i18n locale rows and the records
// Locales column) shows the same four states with the same labels and tints —
// rather than re-deriving Published/Draft and losing "Modified".
export {
    entryStatusView,
    ENTRY_STATUS_VIEW,
    ENTRY_STATUS_VIEW_VARIANT,
    type EntryStatusView
} from './lib/domain/entryStatusView';
export { EntryStatusBadge } from './lib/presentation/components/EntryStatusBadge';

// Query-key builders, exported so a slot contributor can invalidate the
// library's caches after its own mutations (e.g. creating a translation).
export {
    contentEntriesPrefix
} from './lib/application/useContentEntries';
export { contentEntryKey } from './lib/application/useContentEntry';
