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

import {
    BLOCK_ALIGNS,
    FONT_FAMILIES,
    INLINE_COLORS,
    MEDIA_SIZES,
    TEXT_SIZES
} from '../schema/block-types';
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
    /**
     * `data-*` attributes whose value is an enumeration, and the values it may
     * take. An attribute named here is dropped when its value isn't one of
     * them; one not named here rides through as any other data attribute does.
     */
    readonly enumeratedAttributes?: Readonly<
        Record<string, ReadonlySet<string>>
    >;
    /**
     * CSS properties a `style` attribute may keep, per tag. **Everything else
     * in `style` is dropped, and a tag not named here keeps no `style` at
     * all** — the attribute is opened by the property, never wholesale.
     */
    readonly allowedStyles?: Readonly<Record<string, readonly string[]>>;
}

/** Attributes allowed on every element regardless of tag. */
const GLOBAL_ATTRIBUTES = ['class', 'id', 'dir', 'lang', 'title'];

/**
 * A CSS colour this sanitizer will store: **hex only**.
 *
 * Deliberately narrower than CSS. `rgb()`, `hsl()` and named colours are all
 * harmless in themselves, but every additional form is another thing to get
 * right, and none of them lets an author express something hex can't. What this
 * pattern is really keeping out is the rest of CSS value syntax — `url(...)`,
 * custom properties, anything that can reference a resource or escape the
 * declaration it is in.
 */
const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/**
 * The other form the same colour arrives in. Not an author's choice — a browser
 * rewrites `style="color: #ff0055"` into `rgb(255, 0, 85)` the moment it parses
 * it, so refusing this shape would mean refusing every colour the editor set.
 * It is accepted and immediately {@link toHexColor}'d, so what gets **stored**
 * is still only ever hex.
 */
const RGB_COLOR =
    /^rgba?\(\s*(\d{1,3})\s*[,\s]\s*(\d{1,3})\s*[,\s]\s*(\d{1,3})\s*(?:[,/]\s*[\d.]+%?\s*)?\)$/i;

/** Whether a value is a colour this sanitizer will store. */
export function isHexColor(value: string): boolean {
    return HEX_COLOR.test(value.trim());
}

/**
 * A colour as the `#rrggbb` that gets stored, or `null` when it is not one.
 *
 * Canonicalizing here rather than accepting both forms is what keeps the stored
 * value stable: the same colour, set the same way, serializes identically
 * whichever browser wrote it — so a revision diff shows edits and not the
 * difference between two spellings of red.
 */
export function toHexColor(value: string): string | null {
    const trimmed = value.trim();
    if (HEX_COLOR.test(trimmed)) return trimmed.toLowerCase();

    const rgb = RGB_COLOR.exec(trimmed);
    if (!rgb) return null;
    const channels = [rgb[1], rgb[2], rgb[3]].map(Number);
    if (channels.some((channel) => channel > 255)) return null;
    return `#${channels
        .map((channel) => channel.toString(16).padStart(2, '0'))
        .join('')}`;
}

/**
 * The only inline styling that survives: a colour on the two inline marks that
 * carry one.
 *
 * This is a real widening of the security boundary and it is kept as small as a
 * widening can be — two properties, two tags, one value pattern. The reason it
 * exists at all: a *named* palette entry adapts to the surface it renders on
 * and is the better default, but an author who needs their brand's exact colour
 * has nowhere to put it, and `data-color="#f43f5e"` is a value no stylesheet
 * can turn into a colour. Everything else about `style` — on these tags and on
 * every other — is still dropped unconditionally.
 */
const COLOR_STYLE_PROPERTIES = ['color', 'background-color'];

/**
 * The presentational `data-*` attributes, pinned to their vocabularies.
 *
 * These are the one place a *styling* choice reaches the stored HTML, so unlike
 * the block types' own round-tripping attributes they are constrained here
 * rather than trusted. Two reasons it belongs in the sanitizer and not in a
 * renderer: it is the pass both runtimes share, so a value that survives it is
 * one every consumer can rely on; and an unconstrained `data-color` invites
 * exactly the open-ended styling this format exists to avoid — the delivery
 * surface has to be able to map a small, known set onto its own palette.
 */
const ENUMERATED_DATA_ATTRIBUTES: Readonly<
    Record<string, ReadonlySet<string>>
> = {
    'data-align': new Set(BLOCK_ALIGNS),
    'data-size': new Set(MEDIA_SIZES),
    'data-color': new Set(INLINE_COLORS),
    'data-highlight': new Set(INLINE_COLORS),
    'data-font': new Set(FONT_FAMILIES),
    'data-text-size': new Set(TEXT_SIZES)
};

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
        // Playable media. Not a script vector — no `srcdoc`, no same-origin
        // document — and both `src` attributes go through the same URL check
        // every other one does. `<iframe>` is still refused (see the header):
        // framing a third party's *document* is a different decision from
        // playing a file.
        'video',
        'audio',
        'source',
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
        a: ['href', 'target', 'rel', 'download'],
        img: ['src', 'alt', 'width', 'height', 'loading'],
        video: ['src', 'controls', 'poster', 'preload', 'width', 'height'],
        audio: ['src', 'controls', 'preload'],
        source: ['src', 'type'],
        ol: ['start', 'type'],
        td: ['colspan', 'rowspan'],
        th: ['colspan', 'rowspan', 'scope'],
        details: ['open'],
        code: ['class']
    },
    urlAttributes: new Set(['href', 'src']),
    allowedSchemes: new Set(['http', 'https', 'mailto', 'tel']),
    strippedTags: new Set([
        'script',
        'style',
        'iframe',
        'object',
        // The *element* — the media block's own type is `embed`, which
        // serializes to a `<figure>`, so nothing here collides with it.
        'embed',
        'form'
    ]),
    enumeratedAttributes: ENUMERATED_DATA_ATTRIBUTES,
    allowedStyles: {
        span: COLOR_STYLE_PROPERTIES,
        mark: COLOR_STYLE_PROPERTIES
    }
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
        if (name.startsWith('on')) continue;
        // Checked **before** the allow-list, which `style` is deliberately not
        // in: the attribute is opened up per property, per tag, and only ever
        // to a value `safeStyle` could parse.
        if (name === 'style') {
            const style = safeStyle(tag, value, policy);
            if (style) out[name] = style;
            continue;
        }
        // `data-*` rides through by design: block types round-trip their attrs
        // through it, and a data attribute is inert — it can't execute, and it
        // can't restyle the page the way an unfiltered `style` could.
        const isData = name.startsWith('data-');
        if (!isData && !allowed.has(name)) continue;

        // A presentational data attribute is an enumeration, not free text.
        const vocabulary = policy.enumeratedAttributes?.[name];
        if (vocabulary && !vocabulary.has(value)) continue;

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
 * The declarations of a `style` attribute that this policy keeps for `tag`, or
 * `null` when none survive. Each is matched against the property list **and**
 * the colour pattern — a permitted property with an unparseable value is
 * dropped like any other, so nothing reaches the output unvalidated.
 */
function safeStyle(
    tag: string,
    value: string,
    policy: SanitizePolicy
): string | null {
    const allowed = policy.allowedStyles?.[tag];
    if (!allowed) return null;

    const kept: string[] = [];
    for (const declaration of value.split(';')) {
        const separator = declaration.indexOf(':');
        if (separator === -1) continue;
        const property = declaration.slice(0, separator).trim().toLowerCase();
        const declared = declaration.slice(separator + 1).trim();
        if (!allowed.includes(property)) continue;
        const color = toHexColor(declared);
        if (!color) continue;
        kept.push(`${property}: ${color}`);
    }
    return kept.length > 0 ? kept.join('; ') : null;
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
