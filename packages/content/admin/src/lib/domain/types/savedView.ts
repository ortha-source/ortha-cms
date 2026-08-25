/** Saved list views — the admin's view of the `/api/views` contract. */

/**
 * Longest accepted view name. Mirrors the server DTO's `@MaxLength`, so the
 * field stops accepting characters at the same point the API would start
 * rejecting them.
 */
export const VIEW_NAME_MAX_LENGTH = 80;

/** Who may see a saved view. Mirrors the server's `view_visibility` enum. */
export const VIEW_VISIBILITY = {
    /** Only its owner. */
    Private: 'private',
    /** Every member of the workspace. */
    Workspace: 'workspace'
} as const;

/** One visibility value. */
export type ViewVisibility =
    (typeof VIEW_VISIBILITY)[keyof typeof VIEW_VISIBILITY];

/**
 * The slice a view restores.
 *
 * Deliberately the records page's **URL params**, not a re-modelling of them:
 * `filter` and `sort` are the raw `?filter=` / `?sort=` strings, so a saved view
 * and a pasted link replay through one code path. `search` and `page` are absent
 * by design — a search is a one-off question, and a page is a reading position.
 */
export type ViewPayload = {
    /** The `?filter=` JSON string. */
    filter?: string;
    /** The `?sort=` spec (`updatedAt` / `-updatedAt`). */
    sort?: string;
    /** Rows per page. */
    pageSize?: number;
    /** Visible column ids, **in display order**. */
    columns?: string[];
    /**
     * Slot-owned list params (the i18n plugin's `locale`, and whatever a later
     * plugin contributes), as an opaque string map.
     */
    extra?: Record<string, string>;
};

/** A saved view as the switcher renders it. */
export type SavedView = {
    /** Primary key. */
    id: string;
    /** The list it is over (`content:<typeName>`). */
    scope: string;
    /** Display name. */
    name: string;
    /** Who may see it. */
    visibility: ViewVisibility;
    /** The user who created it. */
    ownerId: string;
    /** Whether the current user owns it — gates Save, Rename and Delete. */
    isOwn: boolean;
    /** Whether it is the current user's default for this list. */
    isDefault: boolean;
    /** The slice it restores. */
    payload: ViewPayload;
    /** Last-modified timestamp, ISO-8601. */
    updatedAt: string;
};
