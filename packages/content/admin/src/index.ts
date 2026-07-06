export { ContentPlugin } from './lib/utils/contentPlugin';
export type { ContentAdminPlugin } from './lib/utils/contentPlugin';

// The record editor's right-rail extension point, for plugins that contribute
// record-scoped widgets (rendered after the built-in Publish gate / Details /
// Locale widgets).
export { RECORD_WIDGET_SLOT } from './lib/slots/recordWidgetSlot';
export type {
    RecordWidget,
    RecordWidgetContext
} from './lib/slots/recordWidgetSlot';

// The record editor's field-control registry, for plugins that register a
// custom field type's editor.
export {
    registerFieldControl,
    FieldRenderer
} from './lib/components/RecordEditor/FieldRenderer';
export type {
    FieldControl,
    FieldControlProps
} from './lib/components/RecordEditor/FieldRenderer';
export type {
    FieldDef,
    FieldType,
    RecordDraft
} from './lib/types/recordDraft';
