/**
 * Shared string constants for the Content Library, kept here so route segments,
 * route params, and keyboard keys live in one place instead of being repeated as
 * magic literals across the page, the sidebar, and the plugin factory.
 */

/** Permission required to browse content. Granted to all system roles. */
export const CONTENT_READ = 'content:read';

/** Permission required to create an entry. */
export const CONTENT_CREATE = 'content:create';

/** Permission required to edit an entry's values. */
export const CONTENT_UPDATE = 'content:update';

/** Permission required to publish/unpublish an entry. */
export const CONTENT_PUBLISH = 'content:publish';

/** Permission required to delete/restore an entry. */
export const CONTENT_DELETE = 'content:delete';

/**
 * Path segment under the workspace shell where the Content Library mounts
 * (`/workspaces/:id/content`). Shared by the plugin's slot contribution and the
 * page's `basePath` so they can never drift apart.
 */
export const CONTENT_SEGMENT = 'content';

/** Sub-route segment for the History pane. */
export const HISTORY_SEGMENT = 'history';

/** Sub-route segment for the Trash pane. */
export const TRASH_SEGMENT = 'trash';

/**
 * Route param holding the selected content type's machine name. Declared in the
 * route as `:${TYPE_PARAM}` and read back via `useParams()`.
 */
export const TYPE_PARAM = 'typeName';

/** Key that, with ⌘/Ctrl, toggles the search command palette. */
export const SEARCH_SHORTCUT_KEY = 'k';

/**
 * Sub-route segment under a collection for the create-entry view
 * (`/workspaces/:id/content/:typeName/new`). A static segment, so React Router
 * ranks it above the `:${ENTRY_PARAM}` route.
 */
export const NEW_SEGMENT = 'new';

/**
 * Route param holding the selected entry's id, under a collection
 * (`/workspaces/:id/content/:typeName/:entryId`).
 */
export const ENTRY_PARAM = 'entryId';

/**
 * Query-param name holding a collection table's text search. The records view's
 * URL source of truth (via `useTableUrlState`), alongside `filter`/`page`/
 * `pageSize`.
 */
export const SEARCH_PARAM = 'q';

/**
 * Query-param name holding a collection table's sort: a column id for ascending,
 * or `-`-prefixed for descending (e.g. `text`, `-updatedAt`). Absent means
 * default (insertion) order. The bare-`-` convention keeps the URL unescaped.
 */
export const SORT_PARAM = 'sort';

/** Default rows-per-page for a collection's records table. */
export const DEFAULT_PAGE_SIZE = 10;

/**
 * Content field type identifiers — the admin mirror of the server's
 * `CONTENT_FIELD_TYPE` (`@ortha-cms/content-server`). Kept as a local constant
 * (the admin deliberately doesn't import across the server boundary, like its
 * wire types) so every `switch (field.type)` references a named member instead
 * of a bare string literal. Must stay in lock-step with the server set.
 */
export const CONTENT_FIELD_TYPE = {
    Text: 'text',
    RichText: 'richtext',
    Number: 'number',
    Money: 'money',
    Boolean: 'boolean',
    Date: 'date',
    Datetime: 'datetime',
    Select: 'select',
    Multiselect: 'multiselect',
    Json: 'json',
    Relation: 'relation'
} as const;

/**
 * Per-entry verdicts in a bulk-publish dry run — the admin mirror of the
 * server's `BULK_VERDICT` (`@ortha-cms/content-server`). Drives the icon/label
 * for each row in the {@link BulkPublishDialog}. Must stay in lock-step.
 */
export const BULK_VERDICT = {
    Publishable: 'publishable',
    AlreadyPublished: 'already-published',
    Blocked: 'blocked',
    NotFound: 'not-found'
} as const;

/** Multi-entry collection vs. standalone page — mirror of the server's `kind`. */
export const CONTENT_TYPE_KIND = {
    Collection: 'collection',
    Single: 'single'
} as const;

/** Publish state of an entry on a publishable type. */
export const ENTRY_STATUS = {
    Draft: 'draft',
    Published: 'published'
} as const;

/**
 * Which form the entry editor opens: a blank `create` (`/:type/new`), an existing
 * record `edit` (`/:type/:entryId`), or a `single` page (the type's one entry).
 * Named so the editor and its route adapters reference a member instead of a bare
 * string literal.
 */
export const ENTRY_MODE = {
    Create: 'create',
    Edit: 'edit',
    Single: 'single'
} as const;

/** Which form the entry editor opens (see {@link ENTRY_MODE}). */
export type EntryMode = (typeof ENTRY_MODE)[keyof typeof ENTRY_MODE];

/**
 * The kinds of column the records table can show: a schema `field`, one of
 * the two envelope columns (`status`, `updated`), or an `extension` column
 * contributed through `RECORDS_COLUMN_SLOT`. The discriminant of
 * {@link EntryColumn}.
 */
export const COLUMN_KIND = {
    Field: 'field',
    Status: 'status',
    Updated: 'updated',
    Extension: 'extension'
} as const;

/**
 * Column ids for the platform-owned envelope columns. These double as the
 * `?sort=` column ids and must match the server's sortable whitelist
 * (`createdAt`/`updatedAt`/`status`).
 */
export const ENVELOPE_COLUMN = {
    Status: 'status',
    UpdatedAt: 'updatedAt'
} as const;
