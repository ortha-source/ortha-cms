/**
 * Settings the host passes to `SchemaBuilderPlugin`. Only
 * `apps/server/orthacms.config.ts` reads the environment; this is the typed
 * result.
 */
export interface SchemaBuilderPluginConfig {
    /**
     * Editing was asked for (`SCHEMA_BUILDER=true`). Editing still needs a
     * non-production server and a source tree — ADR-0020.
     */
    enabled: boolean;
    /** The server runs with `NODE_ENV=production`; editing is refused whatever `enabled` says. */
    production: boolean;
    /** Absolute path of the host app (`apps/server`), whose `src/content/` the builder reads and edits. */
    projectRoot: string;
    /** The content folder, relative to `projectRoot`. Defaults to `src/content`. */
    contentDir?: string;
    /**
     * Whether a watcher restarts this process when `src/` changes (`watch`, the
     * default under `npm run dev` / `orthacms dev`) or the user has to (`manual`).
     */
    restart?: 'watch' | 'manual';
    /** The host's content migrations, relative to `projectRoot`. Defaults to `migrations`. */
    migrationsDir?: string;
    /**
     * The table that tracks the content migrations — the host's descriptor
     * for `ContentPlugin` names it. Defaults to `__drizzle_migrations_content`.
     */
    migrationsTable?: string;
    /** How long one drizzle-kit run may take before it is killed. Defaults to 60 s. */
    generateTimeoutMs?: number;
}

/** The content folder the builder works in when the host does not say. */
export const DEFAULT_CONTENT_DIR = 'src/content';

/** The migrations folder drizzle-kit writes to when the host does not say. */
export const DEFAULT_MIGRATIONS_DIR = 'migrations';

/** The content migrations' tracking table when the host does not say. */
export const DEFAULT_MIGRATIONS_TABLE = '__drizzle_migrations_content';

/** Where plans and applies stage their work, relative to `projectRoot` — never under `src/`. */
export const WORK_DIR = '.orthacms';

/** A drizzle-kit run's deadline when the host does not say. */
export const DEFAULT_GENERATE_TIMEOUT_MS = 60_000;
