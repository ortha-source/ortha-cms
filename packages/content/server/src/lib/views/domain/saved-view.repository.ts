import type { SavedViewPayload, ViewVisibility } from './saved-view';

/** A stored view row, before the per-caller flags are derived. */
export interface SavedViewRecord {
    /** Primary key. */
    id: string;
    /** The workspace it belongs to. */
    workspaceId: string;
    /** The list it is over. */
    scope: string;
    /** The user who saved it. */
    ownerId: string;
    /** Who may see it. */
    visibility: ViewVisibility;
    /** Display name. */
    name: string;
    /** The slice it restores. */
    payload: SavedViewPayload;
    /** Manual ordering within its scope. */
    position: number;
    /** Last-modified timestamp. */
    updatedAt: Date;
}

/** Everything needed to store a new view. */
export interface NewSavedView {
    /** The workspace it belongs to. */
    workspaceId: string;
    /** The list it is over. */
    scope: string;
    /** The user saving it. */
    ownerId: string;
    /** Who may see it. */
    visibility: ViewVisibility;
    /** Display name. */
    name: string;
    /** The slice it restores. */
    payload: SavedViewPayload;
}

/** The fields an update may change; absent keys are left alone. */
export interface SavedViewPatch {
    /** New display name. */
    name?: string;
    /** New visibility. */
    visibility?: ViewVisibility;
    /** New slice. */
    payload?: SavedViewPayload;
}

/**
 * Persistence port for saved views. The interface lives in `domain/` and the
 * Drizzle adapter in `infrastructure/`, per ADR-0003 — nothing here knows about
 * SQL, and the use-cases depend on this shape rather than on a table.
 */
export interface SavedViewRepository {
    /**
     * Every view in this workspace + scope the reader may see: their own
     * (whatever the visibility) plus everyone's workspace-visible ones.
     */
    listVisible(
        workspaceId: string,
        scope: string,
        readerId: string
    ): Promise<SavedViewRecord[]>;

    /** One view by id, or `null` when it does not exist. */
    findById(id: string): Promise<SavedViewRecord | null>;

    /** How many views this owner already holds in this workspace + scope. */
    countForOwner(
        workspaceId: string,
        scope: string,
        ownerId: string
    ): Promise<number>;

    /** Stores a new view and returns it. */
    create(view: NewSavedView): Promise<SavedViewRecord>;

    /** Applies a patch and returns the updated row. */
    update(id: string, patch: SavedViewPatch): Promise<SavedViewRecord>;

    /** Removes a view. Defaults pointing at it are cascaded away. */
    delete(id: string): Promise<void>;

    /** The view this reader defaults to for a scope, or `null`. */
    findDefaultId(userId: string, scope: string): Promise<string | null>;

    /** Makes `viewId` this user's default for the scope, replacing any prior. */
    setDefault(userId: string, scope: string, viewId: string): Promise<void>;

    /** Clears this user's default for the scope, if any. */
    clearDefault(userId: string, scope: string): Promise<void>;
}

/** DI token for {@link SavedViewRepository}. */
export const SAVED_VIEW_REPOSITORY = Symbol('SAVED_VIEW_REPOSITORY');
