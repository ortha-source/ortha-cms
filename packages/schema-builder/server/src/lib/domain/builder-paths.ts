import {
    DEFAULT_CONTENT_DIR,
    DEFAULT_MIGRATIONS_DIR,
    type SchemaBuilderPluginConfig
} from '../types/schema-builder-config';

/** The folders the builder reads and writes, relative to the project root. */
export interface BuilderPaths {
    /** `src/content` — the types and the manifest. */
    readonly content: string;
    /** `migrations` — the host's content migrations and drizzle-kit's snapshots. */
    readonly migrations: string;
}

/** The configured folders, with their defaults. */
export const builderPaths = (
    config: SchemaBuilderPluginConfig
): BuilderPaths => ({
    content: config.contentDir ?? DEFAULT_CONTENT_DIR,
    migrations: config.migrationsDir ?? DEFAULT_MIGRATIONS_DIR
});
