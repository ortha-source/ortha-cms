/**
 * Shared string constants for the Media Library, kept here so route segments,
 * layout keys, and enum-like option values live in one place instead of being
 * repeated as magic literals across the page, sidebar, toolbar, and dialogs.
 */

/** Permission required to browse media. Mirrors the (future) server matrix. */
export const MEDIA_READ = 'media:read';

/** Permission required to upload / create assets. */
export const MEDIA_CREATE = 'media:create';

/** Permission required to rename / move / replace assets. */
export const MEDIA_UPDATE = 'media:update';

/** Permission required to delete assets and folders. */
export const MEDIA_DELETE = 'media:delete';

/**
 * Path segment under the workspace shell where the Media Library mounts
 * (`/workspaces/:id/media`). Shared by the plugin's slot contribution and the
 * page so they can never drift apart.
 */
export const MEDIA_SEGMENT = 'media';

/** The synthetic root folder id — the library's top level ("All media"). */
export const ROOT_FOLDER_ID = 'root';

/** The two ways the asset browser can render its contents. */
export const MEDIA_VIEW = {
    Grid: 'grid',
    List: 'list'
} as const;

/** A rendering mode for the asset browser (`grid` | `list`). */
export type MediaView = (typeof MEDIA_VIEW)[keyof typeof MEDIA_VIEW];

/** The kinds of asset the library recognises, driving icons and filters. */
export const MEDIA_KIND = {
    Image: 'image',
    Video: 'video',
    Audio: 'audio',
    Document: 'document',
    Archive: 'archive'
} as const;

/** One recognised asset kind. */
export type MediaKind = (typeof MEDIA_KIND)[keyof typeof MEDIA_KIND];

/** The special "no filter" sentinel for the kind filter control. */
export const KIND_FILTER_ALL = 'all';

/** How the visible assets are ordered. */
export const MEDIA_SORT = {
    NameAsc: 'name-asc',
    NameDesc: 'name-desc',
    Newest: 'newest',
    Oldest: 'oldest',
    Largest: 'largest',
    Smallest: 'smallest'
} as const;

/** One asset-ordering option. */
export type MediaSort = (typeof MEDIA_SORT)[keyof typeof MEDIA_SORT];
