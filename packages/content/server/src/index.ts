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

export {
    MEDIA_ASSET_RESOLVER,
    InjectMediaAssetResolver
} from './lib/extension/media-asset-resolver';
export type {
    MediaAssetResolver,
    ResolvedMediaAsset
} from './lib/extension/media-asset-resolver';

// Row ↔ record mappers, exported for extension plugins (e.g. i18n's
// translation copy) so their wire shapes can't drift from the pipeline's.
export {
    toColumns,
    toRecord
} from './lib/entries/infrastructure/persistence/entry-row';
export type {
    EntryListView,
    EntryMediaView,
    EntryRecord,
    MediaRef
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
export { MEDIA_KIND_VALUES } from './lib/types/fields';
export type {
    AdminProps,
    AnyFieldSpec,
    BaseFieldOptions,
    FieldSpec,
    FieldType,
    FieldValidation,
    FieldValue,
    MediaAccept,
    MediaFieldOptions,
    MediaKindValue,
    RelationFieldOptions,
    RelationOnDelete,
    RelationSpec
} from './lib/types/fields';

// --- Public content API (`/api/v1/...`) ---
// The token-authenticated read surface. The wire contracts are exported so a
// consumer inside the monorepo (or a generated client) can type against them;
// the guards, so a plugin adding a route to the same surface reuses the exact
// authentication and workspace-resolution rules instead of restating them.
export type {
    PublicEntry,
    PublicEntryListView
} from './lib/public-api/types/public-entry';
export type { PublicContentTypeListView } from './lib/public-api/http/controllers/public-content-types.controller';
export { ApiTokenGuard } from './lib/public-api/http/guards/api-token.guard';
export { ApiTokenWorkspaceGuard } from './lib/public-api/http/guards/api-token-workspace.guard';
export { CurrentApiToken } from './lib/public-api/http/decorators/current-api-token.decorator';
export type {
    ApiTokenRequest,
    PublicApiToken
} from './lib/public-api/http/api-token-request';
