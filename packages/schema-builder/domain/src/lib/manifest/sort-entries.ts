import type { ManifestEntry } from './manifest-entry';

/**
 * Collections before pages, each by name — so two syncs over the same tree
 * write byte-identical files and a diff shows only real changes. Registration
 * order is also the order the admin lists types in.
 */
export function sortEntries(
    entries: readonly ManifestEntry[]
): ManifestEntry[] {
    return [...entries].sort(
        (a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name)
    );
}
