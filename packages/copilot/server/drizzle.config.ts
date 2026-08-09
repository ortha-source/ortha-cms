import { defineConfig } from 'drizzle-kit';

/**
 * Generation config for the copilot plugin's schema. `db:generate` (the
 * `@ortha-cms/nx` plugin) runs drizzle-kit against this; it only diffs the
 * schema against the snapshot and never connects to a database, so no
 * `dbCredentials` (and no secret) is needed here. The host applies the emitted
 * migrations under the `__drizzle_migrations_copilot` tracking table.
 */
export default defineConfig({
    dialect: 'postgresql',
    schema: './src/lib/chat/infrastructure/schema/index.ts',
    out: './migrations'
});
