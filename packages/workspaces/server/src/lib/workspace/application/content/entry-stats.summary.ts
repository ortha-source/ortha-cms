import type { WorkspaceEntryStat } from '../ports/content-entry-stats.port';

/** What one workspace's entries add up to. */
export interface WorkspaceEntrySummary {
    /** Entries across every content type. */
    total: number;
    /** Entries per content-type slug; a type with none is absent. */
    byType: Record<string, number>;
    /** When the newest entry last changed; `null` when it holds none. */
    lastEditedAt: Date | null;
}

/** The later of two optional instants. */
export function latest(a: Date | null, b: Date | null): Date | null {
    if (!a) return b;
    if (!b) return a;
    return a.getTime() >= b.getTime() ? a : b;
}

/**
 * Folds the port's per-(workspace, type) rows into one summary per workspace.
 * Pure — the read model supplies the rows, so the arithmetic is testable
 * without a database. A workspace with no rows is absent from the map; read
 * it as `{ total: 0, byType: {}, lastEditedAt: null }`.
 */
export function summarizeEntryStats(
    stats: readonly WorkspaceEntryStat[]
): Map<string, WorkspaceEntrySummary> {
    const byWorkspace = new Map<string, WorkspaceEntrySummary>();
    for (const stat of stats) {
        if (stat.count <= 0) continue;
        const summary = byWorkspace.get(stat.workspaceId) ?? {
            total: 0,
            byType: {},
            lastEditedAt: null
        };
        summary.total += stat.count;
        summary.byType[stat.slug] =
            (summary.byType[stat.slug] ?? 0) + stat.count;
        summary.lastEditedAt = latest(summary.lastEditedAt, stat.lastEditedAt);
        byWorkspace.set(stat.workspaceId, summary);
    }
    return byWorkspace;
}
