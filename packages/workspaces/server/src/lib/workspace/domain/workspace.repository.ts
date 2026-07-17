import type { Workspace } from './workspace';
import type { WorkspaceId } from './value-objects/workspace-id';

/**
 * The persistence **port** for the {@link Workspace} aggregate. The domain and
 * application layers depend on this interface; the infrastructure layer binds a
 * Drizzle-backed adapter to {@link WORKSPACE_REPOSITORY}. Loads and saves the
 * **whole** aggregate (its memberships and content grants included), so callers
 * never touch the child tables directly.
 */
export interface WorkspaceRepository {
    /**
     * Loads the aggregate for `id`, or `null` when no such workspace exists.
     * Must be called inside the active unit of work so it reads the same
     * transaction the subsequent {@link save} writes to.
     */
    findById(id: WorkspaceId): Promise<Workspace | null>;

    /**
     * Loads the aggregate like {@link findById}, but first serializes against
     * concurrent content-entry writes — the loading strategy for the
     * no-orphaned-content invariants (delete / content-revoke). How that
     * serialization happens (an advisory lock) is an infrastructure detail;
     * the port only promises the ordering guarantee.
     */
    findByIdForContentMutation(id: WorkspaceId): Promise<Workspace | null>;

    /**
     * Persists a workspace: inserts a new aggregate, or applies a loaded
     * aggregate's accumulated changes (profile / status / membership / grant
     * deltas). Idempotent membership/grant writes so a concurrent duplicate is a
     * no-op, never a constraint error.
     */
    save(workspace: Workspace): Promise<void>;

    /** Permanently deletes a workspace; its memberships and grants cascade. */
    delete(workspace: Workspace): Promise<void>;

    /** Whether any workspace already uses `slug` (the cross-aggregate rule). */
    existsBySlug(slug: string): Promise<boolean>;
}

/**
 * DI token the infrastructure adapter binds to a {@link WorkspaceRepository}.
 * A plain `Symbol`, so the domain declares it without importing `@nestjs/*`.
 */
export const WORKSPACE_REPOSITORY = Symbol('WORKSPACE_REPOSITORY');
