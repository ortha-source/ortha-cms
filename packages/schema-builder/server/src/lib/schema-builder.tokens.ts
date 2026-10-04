/** The plugin's resolved {@link SchemaBuilderPluginConfig}. */
export const SCHEMA_BUILDER_CONFIG = Symbol('SCHEMA_BUILDER_CONFIG');

/** This process's boot id — see `newBootId`. */
export const BOOT_ID = Symbol('SCHEMA_BUILDER_BOOT_ID');

/** The {@link SourceTree} port — the app's files, relative to its root. */
export const SOURCE_TREE = Symbol('SCHEMA_BUILDER_SOURCE_TREE');

/** The {@link CodeFormatter} port. */
export const CODE_FORMATTER = Symbol('SCHEMA_BUILDER_CODE_FORMATTER');

/** The {@link MigrationGenerator} port. */
export const MIGRATION_GENERATOR = Symbol('SCHEMA_BUILDER_MIGRATION_GENERATOR');

/** The {@link ContentStats} port. */
export const CONTENT_STATS = Symbol('SCHEMA_BUILDER_CONTENT_STATS');

/** The {@link ApplyLock} port. */
export const APPLY_LOCK = Symbol('SCHEMA_BUILDER_APPLY_LOCK');

/** The {@link OperationLog} port. */
export const OPERATION_LOG = Symbol('SCHEMA_BUILDER_OPERATION_LOG');

/** The {@link MigrationRunner} port. */
export const MIGRATION_RUNNER = Symbol('SCHEMA_BUILDER_MIGRATION_RUNNER');

/** The {@link SchemaAudit} port. */
export const SCHEMA_AUDIT = Symbol('SCHEMA_BUILDER_SCHEMA_AUDIT');
