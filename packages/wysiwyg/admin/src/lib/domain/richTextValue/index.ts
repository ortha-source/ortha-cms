/**
 * Pure rules about a `richtext` field's stored value. No TipTap, no DOM — the
 * control needs these *before* an editor exists (to decide whether to show its
 * empty state) and *after* one closes (to decide what to store).
 */

/**
 * The exact markup an emptied editor leaves behind: paragraph wrappers, line
 * breaks, and whitespace, and nothing else.
 *
 * Defined as what empty *is*, rather than as a list of tags that count as
 * content. The inverse rule — "no text and no `<img>/<hr>/<table>`" — has to
 * name every element that can carry meaning without carrying words, and it will
 * always be one short: it was, and a column layout the author had just inserted
 * but not yet typed into read as empty and was thrown away on save.
 */
const EMPTY_DOCUMENT_RE = /^(?:\s|&nbsp;|<p(?:\s[^>]*)?>|<\/p>|<br\s*\/?>)*$/i;

/**
 * Whether a stored rich-text value holds nothing a reader would see. True for
 * `null`/`undefined`/`''`, and true for `<p></p>` / `<p><br></p>` — which is
 * the case that matters: a `required` field whose editor was cleared must fail
 * validation, and it only does if what we store is genuinely empty rather than
 * an empty paragraph.
 *
 * Anything else is content, words or not — a table, a divider, an image, a
 * callout, a column layout waiting to be filled in.
 */
export function isEmptyRichText(value: unknown): boolean {
    if (value === null || value === undefined) return true;
    if (typeof value !== 'string') return false;
    return EMPTY_DOCUMENT_RE.test(value);
}

/**
 * A rich-text value normalized for storage: the empty document collapses to
 * `''`, so `required`, the publish gate, and the "Changed" badge all agree with
 * what the author sees. Anything with content is stored verbatim — this never
 * rewrites real markup.
 */
export function normalizeRichText(html: string): string {
    return isEmptyRichText(html) ? '' : html;
}

/** A rich-text value coerced to the HTML string the editor loads. */
export function asRichTextHtml(value: unknown): string {
    return typeof value === 'string' ? value : '';
}
