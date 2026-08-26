import {
    index,
    integer,
    jsonb,
    pgEnum,
    pgTable,
    primaryKey,
    text,
    timestamp,
    unique,
    uuid
} from 'drizzle-orm/pg-core';
import { users, workspaces } from './external-refs';
import type { SavedViewPayload } from '../../domain/saved-view';
import { VIEW_VISIBILITY_VALUES } from '../../domain/saved-view';

/** Who may see a saved view. Mirrors `VIEW_VISIBILITY` in the domain module. */
export const viewVisibility = pgEnum(
    'view_visibility',
    VIEW_VISIBILITY_VALUES as [string, ...string[]]
);

/**
 * A named slice of a list — the filter, sort, columns and page size an editor
 * returns to. Scoped to a workspace, keyed by the list it belongs to (`scope`,
 * `content:<typeName>` today), and owned by the user who saved it.
 *
 * A view is a **bookmark, not a grant**: its payload is replayed through the
 * ordinary list query with the reader's own permissions and workspace scope, so
 * a shared view shows a narrower reader fewer rows, never more.
 */
export const savedViews = pgTable(
    'saved_views',
    {
        /** Primary key. */
        id: uuid('id').primaryKey().defaultRandom(),
        /** The workspace this view belongs to. */
        workspaceId: uuid('workspace_id')
            .notNull()
            .references(() => workspaces.id, { onDelete: 'cascade' }),
        /** The list this view is over (`content:<typeName>`). */
        scope: text('scope').notNull(),
        /** The user who saved it. */
        ownerId: uuid('owner_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        /** `private` (owner only) or `workspace` (every member). */
        visibility: viewVisibility('visibility').notNull().default('private'),
        /** Display name. */
        name: text('name').notNull(),
        /** The slice this view restores. @see SavedViewPayload */
        payload: jsonb('payload').$type<SavedViewPayload>().notNull(),
        /** Manual ordering within its scope; ties break on `createdAt`. */
        position: integer('position').notNull().default(0),
        /** Row creation timestamp. */
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
        /** Last-modified timestamp; refreshed on every update. */
        updatedAt: timestamp('updated_at', { withTimezone: true })
            .notNull()
            .defaultNow()
            .$onUpdate(() => new Date())
    },
    (table) => [
        // The list query's shape: every view in one workspace + scope, both
        // the caller's private ones and the workspace-visible ones.
        index('saved_views_workspace_scope_idx').on(
            table.workspaceId,
            table.scope
        ),
        // A person's own view names are unique per list, so "Save as new" with
        // an existing name is a clean 409 rather than a second, indistinguishable
        // row in the switcher. Scoped to the owner: two people may each have a
        // "Needs review".
        unique('saved_views_owner_name_unique').on(
            table.workspaceId,
            table.scope,
            table.ownerId,
            table.name
        )
    ]
);

/**
 * Which view a user lands on when they open a list with no explicit params.
 *
 * A table rather than an `isDefault` column because the choice is **personal**:
 * one shared view may be one member's default and not another's, which a column
 * on the view itself cannot express. `viewId` cascades, so deleting a view
 * silently drops the defaults pointing at it instead of stranding them.
 */
export const savedViewDefaults = pgTable(
    'saved_view_defaults',
    {
        /** The user whose default this is. */
        userId: uuid('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        /** The list the default applies to. */
        scope: text('scope').notNull(),
        /** The view to open. */
        viewId: uuid('view_id')
            .notNull()
            .references(() => savedViews.id, { onDelete: 'cascade' }),
        /** Last-modified timestamp. */
        updatedAt: timestamp('updated_at', { withTimezone: true })
            .notNull()
            .defaultNow()
            .$onUpdate(() => new Date())
    },
    (table) => [
        // One default per user per list.
        primaryKey({ columns: [table.userId, table.scope] }),
        // Covers the cascade probe when a view is deleted.
        index('saved_view_defaults_view_id_idx').on(table.viewId)
    ]
);
