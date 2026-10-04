/**
 * `@orthacms/schema-builder-admin` — the schema builder's admin page
 * (ADR-0020): the content model, one type at a time, with its fields under the
 * entry editor's built-in tabs. Read-only for now.
 */
export {
    SchemaBuilderPlugin,
    type SchemaBuilderAdminPlugin
} from './lib/utils/schemaBuilderPlugin';
export { useSchemaDocument } from './lib/application/queries/useSchemaDocument';
export { schemaKeys } from './lib/infrastructure/schemaKeys';
export type { SchemaGateway } from './lib/domain/schemaGateway';
