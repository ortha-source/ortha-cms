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
}

/** The content folder the builder works in when the host does not say. */
export const DEFAULT_CONTENT_DIR = 'src/content';
