/**
 * Raised when a destructive change needs an entry count but no content plugin
 * is bound, so the count cannot be established.
 *
 * The "delete / revoke only when empty" invariants exist so a change never
 * orphans content rows. Treating an unavailable counter as `0` inverts that
 * guarantee: it is precisely the case where the guard is blindest that it waves
 * the change through. And the reasoning that an absent plugin implies an empty
 * database does not hold — the `content_*` tables are created by migrations and
 * outlive any single boot's plugin list, so a host started without the content
 * plugin can face a database that is full of entries while reporting none.
 * Verified: a workspace holding five rows reported `{"count":0}`, deleted with
 * `204`, and orphaned all five.
 *
 * So the destructive paths fail **closed** on an unknown count while the
 * read-only count endpoints keep answering — refusing an action we cannot prove
 * is safe, rather than silently destroying the evidence.
 */
export class EntryCountUnavailableError extends Error {
    constructor(public readonly workspaceId: string) {
        super(
            `Cannot verify content entries for workspace ${workspaceId}: no content plugin is bound`
        );
        this.name = 'EntryCountUnavailableError';
    }
}
