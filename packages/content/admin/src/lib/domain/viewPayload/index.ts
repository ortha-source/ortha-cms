import type { ViewPayload } from '../types/savedView';

/**
 * The live list state a view is captured from and compared against — the same
 * fields the records page already keeps in the URL, plus the column selection
 * it keeps in component state.
 */
export type ListState = {
    /** The `?filter=` JSON string, or empty for no filter. */
    filter: string;
    /** The `?sort=` spec, or empty for unsorted. */
    sort: string;
    /** Rows per page. */
    pageSize: number;
    /** Visible column ids, in display order. */
    columns: string[];
    /** Slot-owned list params (`?locale=`, …), absent keys omitted. */
    extra: Record<string, string | undefined>;
};

/**
 * Captures the current list state as a storable payload.
 *
 * Normalizing here — not at the comparison — is what keeps `isDirty` honest:
 * an empty filter and an absent one mean the same thing to the list, so they
 * have to serialize the same way, or a view would read as modified the moment
 * you cleared the filter it was saved without.
 */
export function captureViewPayload(state: ListState): ViewPayload {
    const payload: ViewPayload = { pageSize: state.pageSize };
    if (state.filter) payload.filter = state.filter;
    if (state.sort) payload.sort = state.sort;
    if (state.columns.length > 0) payload.columns = [...state.columns];
    const extra = compactExtra(state.extra);
    if (Object.keys(extra).length > 0) payload.extra = extra;
    return payload;
}

/**
 * Whether the live state has drifted from a saved payload.
 *
 * Compares the **normalized** forms, so key order in the stored JSON, an empty
 * string where the payload has nothing, and a `pageSize` the server defaulted
 * all compare equal. Anything looser and the "Modified" badge burns permanently,
 * which is the same as not having one.
 *
 * The comparison is against the payload **as it was applied**, which is why
 * `available` is required. A view that pins a column the type has since lost is
 * applied without it — comparing against the raw payload would then report the
 * view as modified forever, blaming the reader for a schema change they did not
 * make. Where the view pins nothing usable at all, columns drop out of the
 * comparison entirely: the selection on screen is the type's defaults, which
 * the view never claimed to control.
 */
export function isViewDirty(
    saved: ViewPayload,
    state: ListState,
    available: readonly string[]
): boolean {
    const applied = reconcileColumns(saved, available);
    const live = captureViewPayload(state);
    if (!applied) delete live.columns;
    return (
        serializePayload(live) !==
        serializePayload({ ...saved, columns: applied ?? undefined })
    );
}

/**
 * A stable string for a payload: keys in a fixed order, empty values dropped,
 * `extra` keys sorted. Column **order** is preserved — reordering columns is a
 * real change to the view — while `extra` is a set of independent params whose
 * key order carries nothing.
 */
export function serializePayload(payload: ViewPayload): string {
    const extra = compactExtra(payload.extra ?? {});
    const sortedExtra = Object.keys(extra)
        .sort()
        .map((key) => [key, extra[key]] as const);
    return JSON.stringify([
        payload.filter || '',
        payload.sort || '',
        payload.pageSize ?? null,
        payload.columns ?? [],
        sortedExtra
    ]);
}

/**
 * The URL params that replay a payload, as `updateParams` takes them —
 * `undefined` clears a param, which is how switching from a filtered view to an
 * unfiltered one actually drops the filter instead of leaving the old one on.
 *
 * `page` is always cleared: a view describes a slice, not a position in it, so
 * applying one lands on the first page.
 */
export function viewPayloadToParams(
    payload: ViewPayload,
    slotParamKeys: readonly string[]
): Record<string, string | undefined> {
    const params: Record<string, string | undefined> = {
        filter: payload.filter || undefined,
        sort: payload.sort || undefined,
        pageSize: payload.pageSize ? String(payload.pageSize) : undefined,
        page: undefined
    };
    // Only the keys the page actually owns this render: a payload saved when
    // another plugin was installed must not resurrect that plugin's param.
    for (const key of slotParamKeys) {
        params[key] = payload.extra?.[key] || undefined;
    }
    return params;
}

/**
 * The payload's columns narrowed to the ids the type still has, in the payload's
 * order.
 *
 * A view outlives the field it was saved over — the server stores the payload
 * opaquely on purpose — so applying one **drops** what no longer exists instead
 * of failing. Returns `null` when the payload pins no columns (leave the current
 * selection alone) or when nothing survived (a payload whose every column is
 * gone is not a usable selection, so fall back to the defaults).
 */
export function reconcileColumns(
    payload: ViewPayload,
    available: readonly string[]
): string[] | null {
    if (!payload.columns || payload.columns.length === 0) return null;
    const allowed = new Set(available);
    const kept = payload.columns.filter((id) => allowed.has(id));
    return kept.length > 0 ? kept : null;
}

/** How many of a payload's columns the current type no longer has. */
export function droppedColumnCount(
    payload: ViewPayload,
    available: readonly string[]
): number {
    if (!payload.columns) return 0;
    const allowed = new Set(available);
    return payload.columns.filter((id) => !allowed.has(id)).length;
}

/** Drops `undefined` and empty values from a slot-param bag. */
function compactExtra(
    extra: Record<string, string | undefined>
): Record<string, string> {
    const compact: Record<string, string> = {};
    for (const [key, value] of Object.entries(extra)) {
        if (value) compact[key] = value;
    }
    return compact;
}
