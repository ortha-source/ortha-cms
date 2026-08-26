/**
 * Which way a segment is pointed at one entry.
 *
 * Two values, and no third. An entry lists the segments somebody made a
 * decision about; a segment nobody mentioned is simply absent, which is not the
 * same as either — see {@link canRead}.
 */
export const ACCESS_MODE = {
    /** This segment may read the entry. */
    Allow: 'allow',
    /** This segment may not, whatever any allow says. */
    Deny: 'deny'
} as const;

/** One value of {@link ACCESS_MODE}. */
export type AccessMode = (typeof ACCESS_MODE)[keyof typeof ACCESS_MODE];

/** One entry's decisions — the segment ids on each side. */
export interface EntryAccess {
    /** Segments that may read it. **Empty means everyone.** */
    readonly allow: readonly string[];
    /** Segments that may not, whatever `allow` says. */
    readonly deny: readonly string[];
}

/** An entry nobody has decided anything about. */
export const OPEN_ACCESS: EntryAccess = { allow: [], deny: [] };

/**
 * Whether a reader may read the entry.
 *
 * Three rules, in this order, and the order is the whole specification:
 *
 * 1. **A deny wins.** A reader in any denied segment is out, however many allow
 *    lists they are also in. Put the other way round and "everyone in Europe
 *    except this one customer" would be unsayable.
 * 2. **An empty allow list means everyone.** Not nobody. The two look like the
 *    same emptiness and are opposite: an entry nobody has restricted is the
 *    state every entry starts in, and reading it as a closed door would black
 *    out a library the day the feature is switched on.
 * 3. **Otherwise the reader must be in the allow list.** Including the
 *    anonymous reader, who is in no segment at all and therefore sees only
 *    entries with an empty allow list.
 *
 * That is the entire model. There is no inheritance, no rule object, no
 * ordering between entries, and nothing to resolve — an entry's two lists are
 * the answer, so what an editor sets is exactly what a reader gets.
 */
export function canRead(
    access: EntryAccess,
    readerSegmentIds: ReadonlySet<string>
): boolean {
    for (const id of access.deny) {
        if (readerSegmentIds.has(id)) return false;
    }
    if (!access.allow.length) return true;
    return access.allow.some((id) => readerSegmentIds.has(id));
}

/**
 * Whether an entry's lists restrict anybody.
 *
 * What the editor's badge and the storage layer both key on: an unrestricted
 * entry is stored as **no row at all**, so a reader's query finds nothing and
 * pays an index probe rather than a comparison.
 */
export function isOpen(access: EntryAccess): boolean {
    return access.allow.length === 0 && access.deny.length === 0;
}

/**
 * Whether two sets of lists say the same thing.
 *
 * Order-insensitive, because the lists are **sets** everywhere they matter —
 * `canRead` asks about membership, the stored arrays come back in insertion
 * order, and a caller that resent the same audiences in a different order is
 * asking for no change at all.
 *
 * Three callers depend on that reading: the editor's staging clears itself when
 * a toggle returns to what is stored, the entry-write extension skips a write —
 * and therefore a permission check — that would change nothing, and the same
 * extension decides from it whether a locale group is already in step.
 */
export function sameAccess(a: EntryAccess, b: EntryAccess): boolean {
    const equal = (left: readonly string[], right: readonly string[]) =>
        left.length === right.length &&
        [...left].sort().join() === [...right].sort().join();
    return equal(a.allow, b.allow) && equal(a.deny, b.deny);
}
