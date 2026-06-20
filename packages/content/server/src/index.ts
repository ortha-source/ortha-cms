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

export type {
    AnyContentType,
    ContentType,
    ContentTypeKind,
    ContentTypeOptions,
    EntryEnvelope,
    InferEntry,
    InferValues,
    SingleOptions
} from './lib/types/content-type';
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
