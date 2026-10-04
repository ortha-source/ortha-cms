import {
    assertDisposable,
    ensureDatabase,
    loadDotEnv,
    resolveTestDatabaseUrl
} from './support/db';

/**
 * Creates and migrates the e2e database once for the whole run.
 *
 * Migrations go through `applyPluginMigrations` — the same function
 * `orthacms migrate` calls — so the schema under test is the real shipped schema,
 * applied in the same plugin order. A hand-rolled setup would drift from what
 * the app does the first time a plugin is added.
 *
 * The app's config and plugin list are pulled in with **dynamic** imports, and
 * that is load-bearing rather than stylistic: `orthacms.config.ts` reads
 * `process.env` at import time and throws without `DATABASE_URL`. A static
 * import is hoisted above every statement here, so it would run before `.env`
 * is loaded and before the URL is pointed at the test database — and the whole
 * suite would fail on a variable that is sitting in a file two lines away.
 */
export default async function globalSetup(): Promise<void> {
    loadDotEnv();

    const url = resolveTestDatabaseUrl();
    assertDisposable(url);
    await ensureDatabase(url);

    // Only now is it safe to let the config load.
    process.env['DATABASE_URL'] = url;

    // The app's own modules through `require`, not `import()`. Under the
    // `node16` resolution this app compiles with, an `import()` in a CommonJS
    // file resolves as ESM and demands a file extension the `.ts` source does
    // not have. `require` is exactly as lazy — it runs here, after the URL is
    // repointed — and `typeof import(…)` keeps the result typed.
    const { applyPluginMigrations } = await import('@orthacms/cli');
    const { default: config } =
        require('../../server/orthacms.config') as typeof import('../../server/orthacms.config');
    const { buildPlugins } =
        require('../../server/src/plugins') as typeof import('../../server/src/plugins');

    await applyPluginMigrations(buildPlugins(config), url);
}
