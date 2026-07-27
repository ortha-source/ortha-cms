/**
 * HTML text/attribute escaping — the last thing every serialized string passes
 * through, so a value that came from a user can never open a tag.
 */

/** A well-formed entity reference **at the start** of the remaining text. */
const ENTITY_AT_START = /^&(#\d+|#x[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]{1,31});/;

/**
 * Escapes a text run for HTML output. A `&` that already starts a valid entity
 * is left alone — parsing and re-serializing a document must not turn `&amp;`
 * into `&amp;amp;` on every round trip — while a lone `&` is escaped so the
 * output stays well-formed.
 */
export function escapeHtmlText(text: string): string {
    let out = '';
    for (let index = 0; index < text.length; index += 1) {
        const char = text[index];
        if (char === '<') {
            out += '&lt;';
        } else if (char === '>') {
            out += '&gt;';
        } else if (char === '&') {
            out += ENTITY_AT_START.test(text.slice(index)) ? '&' : '&amp;';
        } else {
            out += char;
        }
    }
    return out;
}

/** Escapes a value for a double-quoted attribute. */
export function escapeHtmlAttribute(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/**
 * Decodes the handful of entities that matter for plain-text extraction
 * (search excerpts, length validation). Deliberately not a full entity table —
 * this feeds counting and previews, never markup.
 */
export function decodeBasicEntities(text: string): string {
    return text
        .replace(/&nbsp;/g, ' ')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#0?39;|&apos;/g, "'")
        .replace(/&#x?([0-9a-fA-F]+);/g, (whole, code: string) =>
            whole.includes('x')
                ? String.fromCodePoint(parseInt(code, 16))
                : String.fromCodePoint(Number(code))
        )
        .replace(/&amp;/g, '&');
}
