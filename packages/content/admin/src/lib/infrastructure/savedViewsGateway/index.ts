import type {
    SavedView,
    ViewPayload,
    ViewVisibility
} from '../../domain/types/savedView';

/** Body of a "Save current as view" submit. */
export type CreateViewInput = {
    /** The list the view is over (`content:<typeName>`). */
    scope: string;
    /** Display name. */
    name: string;
    /** Who may see it. */
    visibility: ViewVisibility;
    /** The slice it stores. */
    payload: ViewPayload;
    /** Whether to land on it when the list opens. */
    makeDefault?: boolean;
};

/** The fields an update may change; absent keys are left alone. */
export type UpdateViewInput = {
    /** New display name. */
    name?: string;
    /** New visibility. */
    visibility?: ViewVisibility;
    /** New slice. */
    payload?: ViewPayload;
};

/**
 * Transport port for saved views. The presentation and application layers
 * depend on this interface, never on `apiClient` — same seam as
 * {@link ContentGateway}, kept separate because the two are different
 * endpoints with different lifetimes.
 */
export type SavedViewsGateway = {
    /** Every view the caller may see for one list. */
    list(scope: string): Promise<SavedView[]>;
    /** Saves a new view. */
    create(input: CreateViewInput): Promise<SavedView>;
    /** Renames, re-shares, or re-captures a view the caller owns. */
    update(id: string, input: UpdateViewInput): Promise<SavedView>;
    /** Deletes a view the caller owns. */
    remove(id: string): Promise<void>;
    /** Makes a view the caller's default for its list. */
    setDefault(id: string): Promise<void>;
    /** Clears the caller's default for the list `id` belongs to. */
    clearDefault(id: string): Promise<void>;
};
