/**
 * The **publish set** — what the Publish Manager was opened on — and how it
 * travels in the URL.
 *
 * It is the URL, not storage, on purpose: a reload, Back/Forward and a pasted
 * link all reopen the same set, and there is no state to expire or to leak
 * between tabs. A set is one content type and up to {@link PUBLISH_SET_MAX_IDS}
 * of its entry ids — what a records selection or an editor menu hands over —
 * which keeps the URL comfortably short (100 uuids ≈ 3.7 kB).
 */

/** The URL params the page reads. */
export const PUBLISH_SET_PARAM = { Type: 'type', Ids: 'ids' } as const;

/** Most ids a set may carry — content's `BULK_MAX_IDS`. */
export const PUBLISH_SET_MAX_IDS = 100;

/** What the manager was opened on. */
export type PublishSet = {
    /** The content type the ids belong to. */
    type: string;
    /** Entry ids, in the order they were handed over, de-duplicated. */
    ids: string[];
};

/** The page's search string for a set (without the leading `?`). */
export function publishSetSearch(set: PublishSet): string {
    const params = new URLSearchParams();
    params.set(PUBLISH_SET_PARAM.Type, set.type);
    params.set(PUBLISH_SET_PARAM.Ids, set.ids.join(','));
    return params.toString();
}

/**
 * Reads a set off the page's search params, or `null` when there is none to
 * read — no type, or no ids. Blank ids are dropped and duplicates collapsed;
 * past the cap the set is cut, never refused, because a hand-edited URL should
 * degrade rather than strand the reader.
 */
export function parsePublishSet(params: URLSearchParams): PublishSet | null {
    const type = params.get(PUBLISH_SET_PARAM.Type)?.trim();
    const raw = params.get(PUBLISH_SET_PARAM.Ids) ?? '';
    const ids = [
        ...new Set(
            raw
                .split(',')
                .map((id) => id.trim())
                .filter(Boolean)
        )
    ].slice(0, PUBLISH_SET_MAX_IDS);
    if (!type || ids.length === 0) return null;
    return { type, ids };
}
