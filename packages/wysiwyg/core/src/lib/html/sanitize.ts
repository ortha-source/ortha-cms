/**
 * The sanitizer — an **allow-list** over the parsed node tree.
 *
 * Two rules make this trustworthy rather than a best-effort filter:
 *
 * 1. **Nothing is allowed unless it is named.** Unknown tags are unwrapped
 *    (their text survives, the tag doesn't) and unknown attributes are dropped,
 *    so a new HTML feature can't slip through by not having been thought of.
 * 2. **It runs on the server too.** The stored field value is sanitized on
 *    write, not only in the browser, because the admin is a client and a client
 *    can be bypassed. That is the whole reason this package is runtime-agnostic.
 *
 * `style` and every `on*` handler are dropped unconditionally, `javascript:` /
 * `data:` URLs are dropped, and `<iframe>` is **not** in the allow-list even for
 * embeds — an embed block stores its provider URL in a `data-` attribute and
 * lets the delivery layer decide whether to frame it.
 */

import { escapeHtmlAttribute, escapeHtmlText } from './escape';
import { VOID_TAGS, isElement, type HtmlNode } from './node';
import { parseHtmlNodes } from './parse-nodes';

/** What a sanitize pass permits. */
export interface SanitizePolicy {
    /** Tags kept as elements. Anything else is unwrapped or dropped. */
    readonly allowedTags: ReadonlySet<string>;
    /** Attributes kept, per tag. `'*'` applies to every allowed tag. */
    readonly allowedAttributes: Readonly<Record<string, readonly string[]>>;
    /** Attributes holding a URL — checked against {@link allowedSchemes}. */
    readonly urlAttributes: ReadonlySet<string>;
    /** URL schemes a URL attribute may use (a relative URL is always fine). */
    readonly allowedSchemes: ReadonlySet<string>;
    /** Tags dropped **with their content** (never merely unwrapped). */
    readonly strippedTags: ReadonlySet<string>;
}

/** Attributes allowed on every element regardless of tag. */
const GLOBAL_ATTRIBUTES = ['class', 'id', 'dir', 'lang', 'title'];

/**
 * The document policy — the tag vocabulary the built-in blocks serialize to,
 * plus the inline marks. Extending the block schema with a type that emits a
 * tag outside this set means extending the policy too; that is deliberate, so
 * "a new block type" can never silently widen what HTML is storable.
 */
export const DOCUMENT_SANITIZE_POLICY: SanitizePolicy = {
    allowedTags: new Set([
        // Block structure
        'p',
        'h1',
        'h2',
        'h3',
        'h4',
        // h5/h6 are storable but never *emitted*: an import carrying one keeps
        // its heading meaning (the parser clamps it to h4) instead of being
        // unwrapped into a bare paragraph on the way in.
        'h5',
        'h6',
        'ul',
        'ol',
        'li',
        'blockquote',
        'pre',
        'hr',
        'figure',
        'figcaption',
        'img',
        'aside',
        'details',
        'summary',
        'div',
        'section',
        'table',
        'thead',
        'tbody',
        'tr',
        'th',
        'td',
        // Inline marks
        'strong',
        'b',
        'em',
        'i',
        'u',
        's',
        'del',
        'mark',
        'code',
        'sub',
        'sup',
        'a',
        'br',
        'span'
    ]),
    allowedAttributes: {
        '*': GLOBAL_ATTRIBUTES,
        a: ['href', 'target', 'rel'],
        img: ['src', 'alt', 'width', 'height', 'loading'],
        ol: ['start', 'type'],
        td: ['colspan', 'rowspan'],
        th: ['colspan', 'rowspan', 'scope'],
        details: ['open'],
        code: ['class']
    },
    urlAttributes: new Set(['href', 'src']),
    allowedSchemes: new Set(['http', 'https', 'mailto', 'tel']),
    strippedTags: new Set(['script', 'style', 'iframe', 'object', 'embed', 'form'])
};

/**
 * The **inline** policy — what a block's own editable text may contain. It is
 * the document policy minus every structural tag, and it is what the editor
 * runs over `contenteditable` output: a paste that drops a whole `<table>` into
 * a paragraph is flattened to its text instead of corrupting the block model.
 */
export const INLINE_SANITIZE_POLICY: SanitizePolicy = {
    ...DOCUMENT_SANITIZE_POLICY,
    allowedTags: new Set([
        'strong',
        'b',
        'em',
        'i',
        'u',
        's',
        'del',
        'mark',
        'code',
        'sub',
        'sup',
        'a',
        'br',
        'span'
    ])
};

/**
 * Sanitizes an HTML string against `policy` and returns HTML. Parses, filters,
 * and re-serializes — so the output is not just filtered but **normalized**:
 * well-formed, quoted, and closed, whatever the input looked like.
 */
export function sanitizeHtml(
    html: string,
    policy: SanitizePolicy = DOCUMENT_SANITIZE_POLICY
): string {
    return serializeNodes(sanitizeNodes(parseHtmlNodes(html), policy));
}

/** Sanitizes a block's inline content — {@link INLINE_SANITIZE_POLICY}. */
export function sanitizeInlineHtml(html: string): string {
    return sanitizeHtml(html, INLINE_SANITIZE_POLICY);
}

/** Filters a parsed tree against `policy`, unwrapping what it can't keep. */
export function sanitizeNodes(
    nodes: readonly HtmlNode[],
    policy: SanitizePolicy = DOCUMENT_SANITIZE_POLICY
): HtmlNode[] {
    const out: HtmlNode[] = [];
    for (const node of nodes) {
        if (!isElement(node)) {
            out.push(node);
            continue;
        }
        if (policy.strippedTags.has(node.tag)) continue;

        const children = sanitizeNodes(node.children, policy);
        if (!policy.allowedTags.has(node.tag)) {
            // Unwrap: the tag goes, the content stays. Losing a `<font>` should
            // never lose the sentence inside it.
            out.push(...children);
            continue;
        }
        out.push({
            kind: 'element',
            tag: node.tag,
            attrs: sanitizeAttributes(node.tag, node.attrs, policy),
            children
        });
    }
    return out;
}

/** Keeps only the attributes `policy` names for `tag`, with safe URLs. */
function sanitizeAttributes(
    tag: string,
    attrs: Readonly<Record<string, string>>,
    policy: SanitizePolicy
): Record<string, string> {
    const allowed = new Set([
        ...(policy.allowedAttributes['*'] ?? []),
        ...(policy.allowedAttributes[tag] ?? [])
    ]);
    const out: Record<string, string> = {};

    for (const [name, value] of Object.entries(attrs)) {
        // `data-*` rides through by design: block types round-trip their attrs
        // through it, and a data attribute is inert — it can't execute, and it
        // can't restyle the page the way a surviving `style` could.
        const isData = name.startsWith('data-');
        if (!isData && !allowed.has(name)) continue;
        if (name.startsWith('on')) continue;
        if (name === 'style') continue;

        if (policy.urlAttributes.has(name)) {
            const url = safeUrl(value, policy);
            if (url === null) continue;
            out[name] = url;
            continue;
        }
        out[name] = value;
    }

    // A link that opens a new tab without `noopener` hands the opener window to
    // the target page, so the pairing is enforced here rather than trusted.
    if (tag === 'a' && out['target'] === '_blank') {
        out['rel'] = 'noopener noreferrer';
    }
    return out;
}

/**
 * The URL if its scheme is allowed, else `null`. Leading control characters and
 * whitespace are stripped first — `java\nscript:alert(1)` is a real bypass, and
 * a browser reads it as a scheme even though a naive `startsWith` doesn't.
 */
function safeUrl(value: string, policy: SanitizePolicy): string | null {
    // eslint-disable-next-line no-control-regex
    const cleaned = value.replace(/[\u0000-\u0020]/g, '');
    if (cleaned === '') return null;

    const scheme = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(cleaned);
    if (!scheme) return value.trim(); // relative, fragment, or protocol-less
    return policy.allowedSchemes.has(scheme[1].toLowerCase())
        ? value.trim()
        : null;
}

/** Serializes a sanitized node tree back to HTML. */
export function serializeNodes(nodes: readonly HtmlNode[]): string {
    return nodes
        .map((node) => {
            if (!isElement(node)) return escapeHtmlText(node.text);
            const attrs = Object.entries(node.attrs)
                .map(([name, value]) =>
                    value === ''
                        ? ` ${name}`
                        : ` ${name}="${escapeHtmlAttribute(value)}"`
                )
                .join('');
            if (VOID_TAGS.has(node.tag)) return `<${node.tag}${attrs}>`;
            return `<${node.tag}${attrs}>${serializeNodes(node.children)}</${node.tag}>`;
        })
        .join('');
}
