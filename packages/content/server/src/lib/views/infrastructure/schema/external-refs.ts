import { pgTable, uuid } from 'drizzle-orm/pg-core';

/**
 * Reference-only projections of the tables this feature's foreign keys target.
 * Identity owns `users` and workspaces owns `workspaces` (with all their
 * columns and their own migrations); these stubs exist so that:
 *
 *  - the generated migration can emit the cross-context FKs
 *    `saved_views.owner_id → users(id)` and
 *    `saved_views.workspace_id → workspaces(id)` — the host applies identity's
 *    and workspaces' migrations before this plugin's, so both physical tables
 *    already exist when this one runs; and
 *  - `drizzle-kit generate` bundles a **pure-Drizzle** schema graph. Importing
 *    either runtime barrel here would pull NestJS providers into drizzle-kit's
 *    esbuild pass, which has no `experimentalDecorators` and fails on their
 *    parameter decorators.
 *
 * Deliberately **not** re-exported from `schema/index.ts`, so drizzle-kit
 * references them only in the FKs and never emits a duplicate `CREATE TABLE`.
 */
export const users = pgTable('users', {
    id: uuid('id').primaryKey()
});

/** @see users — same reference-only rationale, for the workspaces table. */
export const workspaces = pgTable('workspaces', {
    id: uuid('id').primaryKey()
});
