export { ContentPlugin } from './lib/utils/contentPlugin';
export type { ContentAdminPlugin } from './lib/utils/contentPlugin';

export {
    ENTRY_HEADER_SLOT,
    ENTRY_PARAMS_SLOT,
    ENTRY_SIDEBAR_WIDGET_SLOT,
    RECORDS_COLUMN_SLOT,
    RECORDS_FILTER_FIELDS_SLOT,
    RECORDS_TOOLBAR_SLOT
} from './lib/slots/contentSlots';
export type {
    EntryHeaderItem,
    EntryParamsItem,
    EntrySlotContext,
    EntrySidebarWidgetItem,
    RecordsColumnCellContext,
    RecordsColumnItem,
    RecordsFilterFieldsItem,
    RecordsToolbarContext,
    RecordsToolbarItem
} from './lib/slots/contentSlots';

export type {
    ContentField,
    ContentType,
    ContentTypeDetail,
    EntryRecord,
    EntryStatus
} from './lib/types/contentType';
export { ENTRY_MODE, type EntryMode } from './lib/constants';

// Query-key builders, exported so a slot contributor can invalidate the
// library's caches after its own mutations (e.g. creating a translation).
export {
    contentEntriesPrefix
} from './lib/api/useContentEntries';
export { contentEntryKey } from './lib/api/useContentEntry';
