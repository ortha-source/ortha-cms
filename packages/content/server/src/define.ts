/**
 * Decorator-free entry point: just the definition DSL and its types.
 *
 * Collection files (and the host's drizzle-kit schema entry that imports
 * them) MUST import from `@ortha-cms/content-server/define`, not the main
 * barrel — drizzle-kit bundles the schema's whole import graph with plain
 * esbuild, which rejects the NestJS decorators the main barrel pulls in
 * via its controllers.
 */

export { collection, single, joinTableOf } from './lib/collection/define';
export { field } from './lib/fields';

export { CONTENT_TYPE_KIND } from './lib/types/content-type';
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
