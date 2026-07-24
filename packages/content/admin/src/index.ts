export { ContentPlugin } from './lib/presentation/contentPlugin';
export type { ContentAdminPlugin } from './lib/presentation/contentPlugin';

export {
    ENTRY_HEADER_SLOT,
    ENTRY_PARAMS_SLOT,
    ENTRY_SIDEBAR_WIDGET_SLOT,
    ENTRY_TAB_SLOT,
    RECORDS_COLUMN_SLOT,
    RECORDS_FILTER_FIELDS_SLOT,
    RECORDS_TOOLBAR_SLOT
} from './lib/presentation/slots/contentSlots';
export type {
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

// Query-key builders, exported so a slot contributor can invalidate the
// library's caches after its own mutations (e.g. creating a translation).
export {
    contentEntriesPrefix
} from './lib/application/useContentEntries';
export { contentEntryKey } from './lib/application/useContentEntry';
