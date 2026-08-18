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

/** Where one queued upload has got to. */
export const UPLOAD_STATUS = {
    /** Queued, waiting for a concurrency slot. */
    Pending: 'pending',
    /** Bytes are on the wire. */
    Uploading: 'uploading',
    Done: 'done',
    Failed: 'failed',
    /** Aborted by the user before it finished. */
    Cancelled: 'cancelled'
} as const;

/** One queued upload's state. */
export type UploadStatus = (typeof UPLOAD_STATUS)[keyof typeof UPLOAD_STATUS];

/**
 * How many files upload at once. Above ~3 the browser queues the rest anyway
 * (per-host connection limits) while each one's progress bar crawls, which
 * reads as a stall; a small pool keeps every active bar visibly moving.
 */
export const UPLOAD_CONCURRENCY = 3;

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

/**
 * Assets per page in the library grid, and the sizes the pager offers.
 *
 * 24 matches the server's own default and divides evenly by the grid's column
 * counts (2/3/4/5), so a full page never leaves a ragged last row. The server
 * caps a page at 100, so nothing above it is offered.
 */
export const DEFAULT_ASSETS_PAGE_SIZE = 24;

/** The page sizes the library's pager offers, smallest first. */
export const ASSETS_PAGE_SIZE_OPTIONS = [24, 48, 96];

/**
 * Assets fetched by a surface that browses without a pager — the picker
 * dialog, which narrows by searching rather than by paging. The server's
 * ceiling, so it is one request whatever the folder holds.
 */
export const PICKER_ASSETS_PAGE_SIZE = 100;

/** How long the search box waits after a keystroke before it queries. */
export const SEARCH_DEBOUNCE_MS = 300;

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
