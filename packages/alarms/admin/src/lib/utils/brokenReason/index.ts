/**
 * Which field a broken alarm's stored reason names, if it names one.
 *
 * The server stores the filter engine's own message when a rule stops parsing
 * (`unknown field "category"`, `unknown relation "author" in "author.status"`).
 * That is the whole answer for a developer and nothing an editor can act on,
 * so the alarm card turns the common case — a field that was removed from the
 * type — into "“Category” no longer exists on Plans — fix the condition", and
 * falls back to the raw reason for anything it does not recognise rather than
 * guessing.
 */
export function brokenFieldOf(reason: string | null): string | null {
    if (!reason) return null;
    const field = /unknown field "([^"]+)"/.exec(reason);
    if (field) return field[1];
    const relation = /unknown relation "([^"]+)"/.exec(reason);
    if (relation) return relation[1];
    return null;
}
