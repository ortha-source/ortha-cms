import type { RelationRef, StagedRelation } from '../../types/contentType';

/**
 * Overlay a {@link StagedRelation} onto the server-loaded links to get the set
 * the editor should display: drop removed ids, append staged additions, then —
 * when a reorder is staged — sort by the stored sequence (ids outside `order`,
 * e.g. a page loaded after the reorder, keep their natural order at the end).
 * Pure, so it can be unit-tested and shared by the live relation editor.
 */
export function applyStaged(
    serverItems: readonly RelationRef[],
    staged: StagedRelation
): RelationRef[] {
    const removed = new Set(staged.removed);
    const base = serverItems.filter((item) => !removed.has(item.id));
    const merged = [
        ...base,
        ...staged.added.filter((a) => !base.some((b) => b.id === a.id))
    ];
    if (!staged.order) return merged;
    const rank = new Map(staged.order.map((id, i) => [id, i]));
    return [...merged].sort(
        (a, b) =>
            (rank.get(a.id) ?? Number.POSITIVE_INFINITY) -
            (rank.get(b.id) ?? Number.POSITIVE_INFINITY)
    );
}

/**
 * Reconcile the relation picker's chosen id set against what's currently
 * displayed and produce the next {@link StagedRelation} — **no request**. Links
 * the newly-chosen ids (remembering each new target's title from `picked`) and
 * unlinks the ones dropped, folding both into the staged diff:
 *
 * - un-linking a server item records it in `removed`; un-linking a still-staged
 *   addition just drops it from `added`.
 * - re-selecting a previously-removed server item clears it from `removed`
 *   (never duplicated into `added`).
 * - a brand-new id (not already on the server set or in `added`) is appended to
 *   `added` with its picked title/status.
 * - a staged `order` drops any ids that were just removed.
 *
 * Pure — the caller owns the staging and decides when to persist it.
 */
export function reconcileStaged(
    staged: StagedRelation,
    displayedIds: readonly string[],
    serverItems: readonly RelationRef[],
    chosenIds: readonly string[],
    picked: readonly RelationRef[]
): StagedRelation {
    const chosen = new Set(chosenIds);
    const toRemove = displayedIds.filter((id) => !chosen.has(id));
    const toAdd = chosenIds.filter((id) => !displayedIds.includes(id));
    const byId = new Map(picked.map((c) => [c.id, c]));

    let added = [...staged.added];
    let removed = [...staged.removed];
    for (const id of toRemove) {
        if (added.some((a) => a.id === id))
            added = added.filter((a) => a.id !== id);
        else if (!removed.includes(id)) removed = [...removed, id];
    }
    for (const id of toAdd) {
        if (removed.includes(id)) {
            removed = removed.filter((x) => x !== id); // re-link a server item
        } else if (
            !serverItems.some((s) => s.id === id) &&
            !added.some((a) => a.id === id)
        ) {
            const c = byId.get(id);
            added = [
                ...added,
                {
                    id,
                    title: c?.title ?? id,
                    ...(c?.status ? { status: c.status } : {})
                }
            ];
        }
    }
    const order = staged.order
        ? staged.order.filter((x) => !toRemove.includes(x))
        : null;
    return { added, removed, order };
}
