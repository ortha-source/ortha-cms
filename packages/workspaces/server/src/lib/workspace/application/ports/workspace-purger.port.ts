/**
 * What one plugin removes when a workspace is deleted.
 *
 * ## Why this exists
 *
 * A workspace's rows live in **many** plugins, and only some of them can carry
 * a foreign key back to `workspaces`. `memberships`, `workspace_content` and
 * copilot's three tables do, so they cascade. `media_asset`, `media_folder` and
 * `api_token_workspaces` deliberately do **not** — a cross-plugin FK would
 * couple their schemas to this one, which is exactly what the plugin split is
 * for — so nothing removed them and a delete left them behind, pointing at a
 * workspace id that no longer existed. Orphaned media rows also stranded their
 * stored bytes, which no later request could ever reach to reclaim.
 *
 * Content is the case that already worked, and it works differently on purpose:
 * a workspace holding entries is **refused** (409) rather than purged, because
 * entries are authored records a user must delete deliberately. Purging is for
 * the rows that are pure *scoping* — a folder tree, a token's workspace bucket —
 * which carry no independent meaning once the workspace is gone.
 *
 * ## Two phases, because bytes are not transactional
 *
 * {@link purge} runs **inside** the delete's transaction, so its rows commit or
 * roll back with the workspace. Anything outside the database — blobs in object
 * storage — cannot join that transaction, so a purger returns a {@link reclaim}
 * thunk instead and the use case runs it **after** the commit. This is the same
 * ordering `DeleteAssetsUseCase` already uses for a single asset: a rolled-back
 * delete must never destroy bytes belonging to a row that still exists.
 *
 * ## Registration is a call, not a DI multi-binding
 *
 * Nest has no multi-provider token, so a contributor injects
 * `WorkspacePurgeRegistry` `@Optional()` and registers itself in
 * `onModuleInit` — the same shape `ToolProvider` uses, for the same reason.
 * `@Optional()` because this package may boot without the contributing plugin.
 *
 * **Where an implementation lives is decided by the dependency direction, not
 * by taste.** `media/server` depends on this package (its routes use
 * `WorkspaceGuard`), so its purger lives there and registers itself — the
 * inversion. `identity/server` is the opposite: *this* package depends on
 * identity, so identity cannot depend back, and the purger for
 * `api_token_workspaces` lives here instead, in `infrastructure/purge/`. That
 * mirrors `DrizzleMemberProvisioner`, which already writes identity's `users`
 * table for the same reason.
 */
export interface WorkspacePurger {
    /**
     * Stable name for this contributor, used in the failure message when one
     * purger throws — "which plugin refused to let the delete through" is
     * otherwise invisible from inside a transaction that rolled back.
     */
    readonly purgeName: string;

    /**
     * Remove this plugin's rows for `workspaceId`.
     *
     * Runs inside the delete transaction, through `UnitOfWork.current()`, so it
     * commits with the workspace and rolls back with it. Throwing aborts the
     * whole delete — which is the right outcome, since a partial purge is
     * exactly the orphaning this port exists to prevent.
     */
    purge(workspaceId: string): Promise<WorkspacePurgeOutcome>;
}

/** What one purger removed, plus any non-transactional cleanup it deferred. */
export interface WorkspacePurgeOutcome {
    /**
     * How many rows this purger deleted. Reported for the audit trail and the
     * logs — a delete that silently removed 4 000 media rows should not look
     * identical to one that removed none.
     */
    rows: number;

    /**
     * Cleanup that cannot be transactional — reclaiming stored blobs, calling
     * an external service. Run by the use case **after** the transaction
     * commits, and never if it rolled back. A rejection here is logged and
     * swallowed: the rows are already gone, so failing the request would report
     * a delete that in fact succeeded, and the caller has nothing to retry.
     */
    reclaim?: () => Promise<void>;
}
