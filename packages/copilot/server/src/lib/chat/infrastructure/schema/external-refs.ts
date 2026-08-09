import { pgTable, uuid } from 'drizzle-orm/pg-core';

/**
 * Reference-only projections of tables other plugins own, carrying just the
 * `id` column this plugin's foreign keys target. Same pattern (and same two
 * reasons) as `workspaces/server`'s `external-refs.ts`:
 *
 *  - the generated copilot migration can emit the cross-context FKs
 *    `copilot_conversations.user_id → users(id)` and
 *    `… .workspace_id → workspaces(id)` — the host applies identity's and
 *    workspaces' migrations first, so both physical tables already exist when
 *    this one runs; and
 *  - `drizzle-kit generate` sees a **pure-Drizzle** schema graph. Importing
 *    another plugin's runtime barrel here would pull its NestJS providers into
 *    drizzle-kit's esbuild pass, which has no `experimentalDecorators` and
 *    dies on their parameter decorators.
 *
 * Deliberately **not** re-exported from `schema/index.ts`, so drizzle-kit
 * references these only in the FKs and never emits a duplicate `CREATE TABLE`.
 */
export const users = pgTable('users', {
    id: uuid('id').primaryKey()
});

export const workspaces = pgTable('workspaces', {
    id: uuid('id').primaryKey()
});
