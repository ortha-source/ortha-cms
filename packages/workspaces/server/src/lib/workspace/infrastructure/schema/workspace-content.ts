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
        /** Row creation timestamp. */
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow()
    },
    (table) => [
        // A workspace grants a given (kind, slug) at most once.
        unique('workspace_content_unique').on(
            table.workspaceId,
            table.kind,
            table.slug
        ),
        // Covers "list a workspace's grants".
        index('workspace_content_workspace_id_idx').on(table.workspaceId)
    ]
);
