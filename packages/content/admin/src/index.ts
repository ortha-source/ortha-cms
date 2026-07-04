export { ContentPlugin } from './lib/utils/contentPlugin';
export type { ContentAdminPlugin } from './lib/utils/contentPlugin';

export {
    ENTRY_PARAMS_SLOT,
    ENTRY_SIDEBAR_WIDGET_SLOT,
    RECORDS_COLUMN_SLOT,
    RECORDS_FILTER_FIELDS_SLOT,
    RECORDS_TOOLBAR_SLOT
} from './lib/slots/contentSlots';
export type {
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
