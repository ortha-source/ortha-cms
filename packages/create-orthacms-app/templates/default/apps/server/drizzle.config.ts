import { defineConfig } from 'drizzle-kit';

/**
 * Generation config for this app's **own** content tables — the types under
 * `src/content/collections/` and `src/content/pages/`, gathered by the
 * generated manifest `src/content/index.ts`. `orthacms generate` runs
 * drizzle-kit against this file; the SQL it writes is applied by
 * `orthacms migrate` through the `migrations` descriptor `ContentPlugin` carries
 * in `src/plugins.ts`.
 *
 * **Both paths are relative to the app root, not to this file.** drizzle-kit
 * resolves `schema` and `out` from the working directory, and `orthacms
 * generate` runs it from the root — so `./src/content/index.ts` here would not
 * be found, and `../../migrations` would write two levels above the project.
 *
 * No `dbCredentials`: generating only diffs the schema against the last
 * snapshot in `migrations/meta/` and never connects, so there is no secret to
 * put here. Kept out of the server build by `tsconfig.json`'s `exclude`.
 */
export default defineConfig({
    dialect: 'postgresql',
    schema: './apps/server/src/content/index.ts',
    out: './apps/server/migrations'
});
