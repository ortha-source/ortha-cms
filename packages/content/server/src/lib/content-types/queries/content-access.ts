/**
 * **Explicit per-source grants** (ADR-0019) — the pure half of the one rule
 * deciding which workspaces' records of a type a workspace may see.
 *
 * A workspace's `workspace_content` rows for one slug are an optional **own**
 * grant (no source) plus any number of **shared** grants, each naming one
 * shared workspace. The rule:
 *
 * ```
 * visibleSources(W, slug) = (W holds an own grant ? [W] : [])
 *                         ∪ { S : W holds a shared grant (slug, S),
 *                                 S is shared and active,
 *                                 S holds its own grant for slug }
 * ```
 *
 * A type is **reachable** from W when that set is non-empty — an own grant or
 * at least one *available* shared grant — and reachability is what gates every
 * read. **Writing** a type needs the own grant.
 *
 * Framework-free and I/O-free: the SQL twin of this rule is
 * `SharedSourcesQuery.foreignVisibleWhere`, and `WorkspaceGrantsQuery` feeds
 * this function the rows it reads, so the rule is written once as data and
 * once as SQL, both next to each other and both specified.
 */

/** A shared workspace a type is readable from. */
export interface ContentAccessSource {
    /** The shared workspace's id. */
    workspaceId: string;
    /** Its display name. */
    workspaceName: string;
}

/** What a workspace may do with one content type. */
export interface ContentAccess {
    /** Whether it holds the own grant — may author records of the type. */
    own: boolean;
    /** The **available** shared sources it may read and link records from. */
    sharedSources: ContentAccessSource[];
}

/** One `workspace_content` row of the reading workspace, as the rule needs it. */
export interface ContentGrantRow {
    /** The granted content type's slug. */
    slug: string;
    /** `null` for an own grant; the source workspace for a shared one. */
    sourceWorkspaceId: string | null;
    /** The source's display name (ignored for an own grant). */
    sourceWorkspaceName?: string | null;
    /**
     * Whether a shared grant's source can serve it right now — shared,
     * active, holding its own grant for `slug`. Ignored for an own grant.
     */
    sourceAvailable?: boolean;
}

/**
 * Folds a workspace's grant rows into per-slug {@link ContentAccess}, keeping
 * only **reachable** slugs: a slug whose every shared grant is inert and which
 * has no own grant is absent, exactly as if it were never granted. Sources are
 * de-duplicated and ordered by name, then id.
 */
export function resolveContentAccess(
    rows: readonly ContentGrantRow[]
): Map<string, ContentAccess> {
    const bySlug = new Map<string, ContentAccess>();
    const entry = (slug: string): ContentAccess => {
        let access = bySlug.get(slug);
        if (!access) {
            access = { own: false, sharedSources: [] };
            bySlug.set(slug, access);
        }
        return access;
    };
    for (const row of rows) {
        if (row.sourceWorkspaceId === null) {
            entry(row.slug).own = true;
            continue;
        }
        if (!row.sourceAvailable) continue;
        const access = entry(row.slug);
        if (
            access.sharedSources.some(
                (source) => source.workspaceId === row.sourceWorkspaceId
            )
        ) {
            continue;
        }
        access.sharedSources.push({
            workspaceId: row.sourceWorkspaceId,
            workspaceName: row.sourceWorkspaceName ?? ''
        });
    }
    for (const access of bySlug.values()) {
        access.sharedSources.sort(
            (a, b) =>
                a.workspaceName.localeCompare(b.workspaceName) ||
                a.workspaceId.localeCompare(b.workspaceId)
        );
    }
    return bySlug;
}

/**
 * `visibleSources(W, slug)` — the workspaces whose records of the type
 * `workspaceId` may read, own id first. Empty when the type is unreachable.
 */
export function visibleSources(
    workspaceId: string,
    access: ContentAccess | undefined
): string[] {
    if (!access) return [];
    return [
        ...(access.own ? [workspaceId] : []),
        ...access.sharedSources.map((source) => source.workspaceId)
    ];
}

/** Whether a type with this access is **reachable** — i.e. readable at all. */
export function isReachable(access: ContentAccess | undefined): boolean {
    return !!access && (access.own || access.sharedSources.length > 0);
}
