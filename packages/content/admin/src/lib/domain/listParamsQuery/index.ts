/**
 * Serialize slot-owned list params (e.g. the i18n plugin's `?locale=`) to a URL
 * query suffix — `"?locale=de"`, or `""` when nothing is set.
 *
 * These params are the **context the records table was showing**, and they have
 * to ride along on every link that leaves it: the create route, each row's
 * editor link, and the editor's "Back to records" link. Drop one and the user is
 * silently returned to a different context than they left — opening a German row
 * and going back landed on the English list.
 *
 * A param the slot leaves unset is omitted rather than serialized as empty, which
 * is what keeps the default locale on a clean URL (the server scopes to the
 * default when `?locale=` is absent, so the two spellings can't drift).
 */
export function listParamsQuery(
    params: Record<string, string | undefined>
): string {
    const carried = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) carried.set(key, value);
    }
    const query = carried.toString();
    return query ? `?${query}` : '';
}
