import type { ContentGrantKind } from '../../domain/content-grant';

/** One content type a shared workspace offers — one of its own grants. */
export interface SharedContentOffer {
    /** The code-defined content type's slug. */
    slug: string;
    /** Whether `slug` names a collection or a single page. */
    kind: ContentGrantKind;
}

/**
 * A shared, non-archived workspace and the content types it offers (its own
 * grants) — one item of `GET /workspaces/:id/shared-sources`.
 */
export interface SharedContentSource {
    /** The shared workspace's id. */
    workspaceId: string;
    /** Its display name. */
    workspaceName: string;
    /** Its own grants, i.e. what another workspace may take a shared grant of. */
    content: SharedContentOffer[];
}

/**
 * Reads which workspaces may serve a **shared content grant** (ADR-0019,
 * "Explicit per-source grants"): shared, not archived, and holding their own
 * grant for the slug. Cross-aggregate, so it is a port the application asks
 * rather than state the {@link Workspace} aggregate carries.
 */
export interface SharedContentSources {
    /**
     * Every shared, non-archived workspace other than `excludingWorkspaceId`,
     * with its own grants, ordered by name.
     */
    list(excludingWorkspaceId: string | null): Promise<SharedContentSource[]>;

    /**
     * The kind of `slug` when `sourceWorkspaceId` may serve a shared grant of
     * it — shared, active, and holding its own grant for `slug` — else `null`.
     * Joins the caller's unit of work when one is open.
     */
    offeredKind(
        sourceWorkspaceId: string,
        slug: string
    ): Promise<ContentGrantKind | null>;
}

/** DI token for {@link SharedContentSources}. */
export const SHARED_CONTENT_SOURCES = Symbol('SHARED_CONTENT_SOURCES');
