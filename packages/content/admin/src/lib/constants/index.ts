/**
 * Shared string constants for the Content Library, kept here so route segments,
 * route params, and keyboard keys live in one place instead of being repeated as
 * magic literals across the page, the sidebar, and the plugin factory.
 */

/** Permission required to browse content. Granted to all system roles. */
export const CONTENT_READ = 'content:read';

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
