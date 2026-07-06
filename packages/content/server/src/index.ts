/** Public API of @ortha-cms/content-server. */

export { ContentPlugin } from './lib/utils/content-plugin';
export type {
    ContentPluginOptions,
    ContentServerPlugin
} from './lib/utils/content-plugin';

export { collection, single, joinTableOf } from './lib/collection/define';
export { field } from './lib/fields';

export { ContentModule } from './lib/content.module';
export { CONTENT_REGISTRY, InjectContentRegistry } from './lib/content.tokens';

export { CONTENT_ENTRY_EXTENSION } from './lib/extension/entry-extension';
export type {
    ContentEntryExtension,
    EntryFilterContext,
    EntryFilterExtension,
    EntryScopeParams,
    EntryTransaction
} from './lib/extension/entry-extension';
export { isPerLocaleRelation } from './lib/extension/per-locale-relation';

// Row ↔ record mappers, exported for extension plugins (e.g. i18n's
// translation copy) so their wire shapes can't drift from the pipeline's.
export { toColumns, toRecord } from './lib/entries/services/entry-row';
export type {
    EntryListView,
    EntryRecord
} from './lib/entries/types/entry-list-view';

export { ContentTypeRegistry } from './lib/registry/content-type-registry';
export type {
    SerializedContentType,
    SerializedContentTypeSummary,
    SerializedField
} from './lib/registry/content-type-registry';

export { EntryValidationService } from './lib/validation/services/entry-validation.service';
export type {
    ValidationIssue,
    ValidationResult
} from './lib/validation/services/entry-validation.service';

export { CONTENT_TYPE_KIND, ENTRY_STATUS } from './lib/types/content-type';
export type {
    AnyContentType,
    ContentType,
    ContentTypeKind,
    EntryStatus,
    ContentTypeOptions,
    EntryEnvelope,
    InferEntry,
    InferValues,
    SingleOptions
} from './lib/types/content-type';
export { CONTENT_FIELD_TYPE } from './lib/types/fields';
export type {
    AdminProps,
    AnyFieldSpec,
    BaseFieldOptions,
    FieldSpec,
    FieldType,
    FieldValidation,
    FieldValue,
    RelationFieldOptions,
    RelationOnDelete,
    RelationSpec
} from './lib/types/fields';
