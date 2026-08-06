/**
 * A `richtext` value's plain-text summary. Rich text is stored as **HTML**
 * (the storage layer already calls it "potentially huge HTML"), so the raw
 * value is useless anywhere a single line of text is what fits — a table cell,
 * a revision diff row, a search result. `String(value)` there renders the
 * markup itself (`<p>Hello <strong>world</strong></p>`), which is what the
 * reader sees instead of their sentence.
 *
 * Pure, DOM-free, and deliberately not a parser: the result is only ever
 * rendered as **text**, never as HTML, so tag-stripping by regex carries no
 * injection risk — a leftover `<` is displayed, not executed.
 */

/** Elements whose content is markup/metadata, not prose — dropped wholesale. */
const NON_PROSE_RE = /<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi;

/** Tags that end a line of prose, so the text either side doesn't run together. */
const BLOCK_BOUNDARY_RE =
    /<\/?(p|div|br|li|ul|ol|h[1-6]|blockquote|pre|tr|td|th|table|thead|tbody|section|article|aside|figure|figcaption|hr)\b[^>]*>/gi;

/** Any remaining tag — inline marks (`<strong>`, `<em>`, `<a>`) carry no break. */
const TAG_RE = /<[^>]*>/g;

/** The named/numeric entities a rich-text body realistically contains. */
const ENTITIES: Record<string, string> = {
    '&nbsp;': ' ',
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&mdash;': '—',
    '&ndash;': '–',
    '&hellip;': '…'
};

const ENTITY_RE = /&(?:nbsp|amp|lt|gt|quot|apos|mdash|ndash|hellip|#39);/g;

/**
 * The readable text inside a rich-text (HTML) value, collapsed to a single
 * line. Block-level tags become a space so "…end.</p><p>Next…" doesn't read as
 * "end.Next"; inline marks vanish without one. Returns `''` for a non-string or
 * a body with no text (e.g. an empty `<p></p>`), which is what lets a caller
 * treat "markup but no words" as empty rather than printing blank markup.
 */
export function richTextExcerpt(value: unknown): string {
    if (typeof value !== 'string') return '';
    return value
        .replace(NON_PROSE_RE, ' ')
        .replace(BLOCK_BOUNDARY_RE, ' ')
        .replace(TAG_RE, '')
        .replace(ENTITY_RE, (entity) => ENTITIES[entity] ?? entity)
        .replace(/\s+/g, ' ')
        .trim();
}
