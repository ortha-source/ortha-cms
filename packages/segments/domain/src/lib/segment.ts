/**
 * One audience — a named set of reader tags.
 *
 * The **tags** are the indirection that makes the whole thing worth having. A
 * reader arrives carrying identifiers your application already knows (`acme`,
 * `plan-pro`, an organisation id); a segment says which of those it answers to.
 * So when an identifier changes upstream, one segment row is edited and every
 * entry that named the segment keeps working — nothing outside this file ever
 * compares a raw tag.
 */
export interface Segment {
    /** Stable id — what an entry's allow/deny list holds. */
    readonly id: string;
    /** Url-safe key, unique in the installation. */
    readonly key: string;
    /** Human-readable name, shown in the entry editor. */
    readonly label: string;
    /**
     * Reader tags this segment answers to — **any one** is enough. Defaults to
     * the key, which is what an installation that never renames anything wants.
     */
    readonly tags: readonly string[];
}

/**
 * The segments a reader's tags resolve to.
 *
 * An exact, case-sensitive match on any tag. There is deliberately no pattern,
 * no prefix and no namespace: those exist to express "any of this kind", which
 * is a question this model answers by not asking it — an entry lists the
 * segments that may read it, and "any" is the empty list.
 */
export function segmentIdsForTags(
    segments: readonly Segment[],
    tags: readonly string[]
): Set<string> {
    if (!tags.length) return new Set();
    const carried = new Set(tags);
    const ids = new Set<string>();
    for (const segment of segments) {
        if (segment.tags.some((tag) => carried.has(tag))) {
            ids.add(segment.id);
        }
    }
    return ids;
}
