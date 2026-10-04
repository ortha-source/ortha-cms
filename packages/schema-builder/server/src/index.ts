/**
 * Public API of `@orthacms/schema-builder-server` — the schema builder's server
 * plugin (ADR-0020).
 */
export { SchemaBuilderPlugin } from './lib/utils/schema-builder-plugin';
export { SchemaBuilderModule } from './lib/schema-builder.module';
export { LoadDocumentUseCase } from './lib/application/load-document.use-case';
export { toDocument } from './lib/application/to-document/to-document';
export { DEFAULT_CONTENT_DIR } from './lib/types/schema-builder-config';
export type { SchemaBuilderPluginConfig } from './lib/types/schema-builder-config';
