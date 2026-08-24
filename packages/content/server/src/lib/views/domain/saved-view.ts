/**
 * A saved list view — the named slice of a collection an editor returns to.
 *
 * Framework-free by ADR-0003: this module is the contract the HTTP layer, the
 * repository adapter and the admin all agree on, and it imports nothing.
 */

/** Who may see a saved view. */
export const VIEW_VISIBILITY = {
    /** Only its owner. */
    Private: 'private',
    /** Every member of the workspace it belongs to. */
    Workspace: 'workspace'
} as const;

/** One visibility value. */
export type ViewVisibility =
    (typeof VIEW_VISIBILITY)[keyof typeof VIEW_VISIBILITY];

/** Every visibility, for validators and the OpenAPI enum. */
export const VIEW_VISIBILITY_VALUES = Object.values(VIEW_VISIBILITY);

/**
 * The slice a view restores, stored as one opaque-ish JSON document.
 *
 * Deliberately mirrors the **URL params** the records page already owns rather
 * than re-modelling them: `filter` and `sort` are the raw `?filter=` / `?sort=`
 * strings, so a view round-trips through the same code path a hand-edited link
 * does. Two things are absent on purpose — `search` is a one-off question, not
 * a property of the slice, and `page` is a reading position, so a view always
 * opens on the first page.
 */
export interface SavedViewPayload {
    /** The `?filter=` JSON string, or absent for no filter. */
    filter?: string;
    /** The `?sort=` spec (`updatedAt` / `-updatedAt`), or absent for unsorted. */
    sort?: string;
    /** Rows per page. */
    pageSize?: number;
    /** Visible column ids, **in display order**. */
    columns?: string[];
    /**
     * Slot-owned list params (the i18n plugin's `?locale=`, and whatever a
     * later plugin contributes), as an opaque string map. Opaque because the
     * keys come from `RECORDS_TOOLBAR_SLOT.listParamKeys` at runtime — naming
     * them here would break the next plugin's params silently.
     */
    extra?: Record<string, string>;
}

/** A saved view as the API returns it. */
export interface SavedView {
    /** Primary key. */
    id: string;
    /** The list this view belongs to (`content:<typeName>`). */
    scope: string;
    /** Display name, unique per owner within a workspace + scope. */
    name: string;
    /** Who may see it. */
    visibility: ViewVisibility;
    /** The user who created it. */
    ownerId: string;
    /** Whether the caller owns it — the admin gates Save and Delete on this. */
    isOwn: boolean;
    /** Whether it is the caller's default for this scope. */
    isDefault: boolean;
    /** The slice it restores. */
    payload: SavedViewPayload;
    /** Last-modified timestamp, ISO-8601. */
    updatedAt: string;
}
