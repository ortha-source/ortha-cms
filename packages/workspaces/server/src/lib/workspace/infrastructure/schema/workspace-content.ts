import {
    index,
    pgEnum,
    pgTable,
    text,
    timestamp,
    unique,
    uuid
} from 'drizzle-orm/pg-core';
import { workspaces } from './workspaces';

/**
 * Whether a granted content item is a multi-entry collection or a standalone
 * page (`single`). Mirrors the wizard's `ContentTypeKind`.
 */
export const contentKind = pgEnum('content_kind', ['collection', 'single']);

/**
 * workspace ↔ content grant (M:N). The collections and pages themselves live in
 * code, not the DB — this table only *links* a workspace to the slugs it may
 * access. "All content" is expanded to one explicit row per known slug at write
 * time, so a row's presence always means an explicit grant.
 *
 * Two kinds of row share the table (ADR-0019, "Explicit per-source grants"):
 * an **own** grant (`source_workspace_id IS NULL`) lets the workspace author
 * its own records of the type; a **shared** grant names one shared workspace
 * whose published records of the type this workspace may read and link. The
 * two are independent — a workspace may hold either, both, or several shared
 * grants for one slug.
 */
export const workspaceContent = pgTable(
    'workspace_content',
    {
        /** Primary key. */
        id: uuid('id').primaryKey().defaultRandom(),
        /** References the workspace the grant belongs to. */
        workspaceId: uuid('workspace_id')
            .notNull()
            .references(() => workspaces.id, { onDelete: 'cascade' }),
        /** Whether `slug` names a collection or a single page. */
        kind: contentKind('kind').notNull(),
        /** The code-defined collection or page slug being granted. */
        slug: text('slug').notNull(),
        /**
         * `NULL` for an **own** grant; otherwise the shared workspace whose
         * records of `slug` this grant exposes. Cascades, so deleting the
         * source removes the grants that pointed at it. A grant whose source
         * is no longer shared, is archived, or no longer holds its own grant
         * for `slug` is kept but **inert** — it exposes nothing.
         */
        sourceWorkspaceId: uuid('source_workspace_id').references(
            () => workspaces.id,
            { onDelete: 'cascade' }
        ),
        /** Row creation timestamp. */
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow()
    },
    (table) => [
        // A workspace grants a given (kind, slug) at most once per source,
        // the own grant (NULL source) included — hence NULLS NOT DISTINCT.
        unique('workspace_content_unique')
            .on(
                table.workspaceId,
                table.kind,
                table.slug,
                table.sourceWorkspaceId
            )
            .nullsNotDistinct(),
        // Covers "list a workspace's grants".
        index('workspace_content_workspace_id_idx').on(table.workspaceId),
        // Covers the FK cascade from a deleted source workspace.
        index('workspace_content_source_workspace_id_idx').on(
            table.sourceWorkspaceId
        )
    ]
);
