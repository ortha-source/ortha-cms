/**
 * A rich-text **value that is still an HTML string**, read as a document.
 *
 * Bodies written before rich text became structured are stored as HTML, and
 * they stay that way until the record is next saved through the editor. Every
 * kernel rule is written against the tree, so without this they would simply
 * not apply to existing content — the finding this whole change is about would
 * remain unobservable on exactly the bodies that already exist.
 *
 * ### What this is not
 *
 * Not a browser, and not a sanitizer. It reads structure — blocks, headings,
 * lists, tables, links, language markers, text — and drops the rest. That is
 * enough to *check* a body (heading order, table headers, link text, `lang`)
 * and to *count* its text, which is all it is used for. It is never a source
 * of stored data: a legacy string is stored as the string it is, so a lossy
 * read here can't cost an author anything. Storing this output would be a
 * silent rewrite of content nobody asked to change.
 *
 * Pure string work — no DOM, so the server, the admin and a test all get the
 * same answer.
 */

import { RICH_TEXT_MARK, RICH_TEXT_NODE } from './rich-text-node';
import type {
    RichTextDocument,
    RichTextMark,
    RichTextNode
} from './rich-text-node';

/** One tag or run of text, as the scanner walks the string. */
const TOKEN_RE =
    /<!--[\s\S]*?-->|<(\/)?([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^'">])*?)(\/)?>/g;

/** One `name` or `name="value"` pair inside a tag's attribute run. */
const ATTR_RE =
    /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s"'>]+))?/g;

/** Elements with no closing tag — a stack push here would never be popped. */
const VOID_TAGS: ReadonlySet<string> = new Set([
    'area',
    'base',
    'br',
    'col',
    'embed',
    'hr',
    'img',
    'input',
    'link',
    'meta',
    'param',
    'source',
    'track',
    'wbr'
]);

/** Elements whose content is code or styling, never prose. */
const RAW_TEXT_TAGS: ReadonlySet<string> = new Set(['script', 'style']);

/** Tags that map straight onto a node type. */
const BLOCK_TAGS: Readonly<Record<string, string>> = {
    p: RICH_TEXT_NODE.Paragraph,
    ul: RICH_TEXT_NODE.BulletList,
    ol: RICH_TEXT_NODE.OrderedList,
    li: RICH_TEXT_NODE.ListItem,
    blockquote: RICH_TEXT_NODE.Blockquote,
    pre: RICH_TEXT_NODE.CodeBlock,
    table: RICH_TEXT_NODE.Table,
    tr: RICH_TEXT_NODE.TableRow,
    th: RICH_TEXT_NODE.TableHeader,
    td: RICH_TEXT_NODE.TableCell,
    caption: RICH_TEXT_NODE.TableCaption
};

/** Tags that map onto a mark on the text they wrap. */
const MARK_TAGS: Readonly<Record<string, string>> = {
    a: RICH_TEXT_MARK.Link,
    strong: RICH_TEXT_MARK.Bold,
    b: RICH_TEXT_MARK.Bold,
    em: RICH_TEXT_MARK.Italic,
    i: RICH_TEXT_MARK.Italic,
    u: RICH_TEXT_MARK.Underline,
    s: RICH_TEXT_MARK.Strike,
    del: RICH_TEXT_MARK.Strike,
    strike: RICH_TEXT_MARK.Strike,
    code: RICH_TEXT_MARK.Code,
    mark: RICH_TEXT_MARK.Highlight
};

/**
 * Grouping wrappers that carry no structure of their own. Their children are
 * hoisted into the enclosing block — except when the wrapper carries a `lang`,
 * which is a fact about the passage inside it and must survive (3.1.2).
 */
const TRANSPARENT_TAGS: ReadonlySet<string> = new Set([
    'html',
    'body',
    'thead',
    'tbody',
    'tfoot',
    'colgroup',
    'div',
    'section',
    'article',
    'aside',
    'main',
    'header',
    'footer',
    'nav',
    'figure',
    'figcaption',
    'span',
    'font',
    'small',
    'sub',
    'sup',
    'dl',
    'dt',
    'dd'
]);

/** The named entities a rich-text body realistically contains. */
const NAMED_ENTITIES: Readonly<Record<string, string>> = {
    nbsp: ' ',
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    mdash: '—',
    ndash: '–',
    hellip: '…',
    laquo: '«',
    raquo: '»',
    lsquo: '‘',
    rsquo: '’',
    ldquo: '“',
    rdquo: '”'
};

const ENTITY_RE = /&(#x[0-9a-f]+|#\d+|[a-z]+);/gi;

/** HTML text with its entities resolved to the characters they name. */
export function decodeEntities(text: string): string {
    return text.replace(ENTITY_RE, (whole, body: string) => {
        if (body.startsWith('#')) {
            const code =
                body.startsWith('#x') || body.startsWith('#X')
                    ? Number.parseInt(body.slice(2), 16)
                    : Number.parseInt(body.slice(1), 10);
            // Lone surrogates and out-of-range code points are not characters;
            // leaving the entity as written beats throwing out of a read.
            return Number.isFinite(code) &&
                code >= 0 &&
                code <= 0x10ffff &&
                !(code >= 0xd800 && code <= 0xdfff)
                ? String.fromCodePoint(code)
                : whole;
        }
        return NAMED_ENTITIES[body.toLowerCase()] ?? whole;
    });
}

/** The attributes of a tag, lower-cased keys, entity-decoded values. */
function parseAttributes(source: string): Record<string, string> {
    const attrs: Record<string, string> = {};
    ATTR_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = ATTR_RE.exec(source)) !== null) {
        const raw = match[2];
        const value =
            raw === undefined
                ? ''
                : raw.startsWith('"') || raw.startsWith("'")
                  ? raw.slice(1, -1)
                  : raw;
        attrs[match[1].toLowerCase()] = decodeEntities(value);
    }
    return attrs;
}

/** One open element on the scanner's stack. */
interface Frame {
    /** The tag that opened it, lower-cased. */
    tag: string;
    /** The node its children are appended to — absent for a mark or a hoist. */
    node?: RichTextNode;
    /** The mark its text runs carry — absent for a block. */
    mark?: RichTextMark;
    /**
     * How much had been appended to the tree when it opened, so closing it can
     * tell whether it wrapped anything. Only a link frame asks: a link that
     * wraps nothing has no accessible name, and it would otherwise vanish
     * without trace (a mark with no text is not in the tree at all).
     */
    at: number;
}

/** `lang`/`xml:lang` off a tag's attributes, whichever is present. */
function langAttr(attrs: Record<string, string>): string | undefined {
    const lang = attrs['lang'] ?? attrs['xml:lang'];
    return lang !== undefined && lang.trim() !== '' ? lang.trim() : undefined;
}

/**
 * The document a legacy HTML string describes: its blocks, headings, lists,
 * tables, images, links and language markers, with the text they contain.
 *
 * Unbalanced markup is tolerated rather than rejected — a stray `</div>` or an
 * unclosed `<p>` is what half the HTML in the world looks like, and the answer
 * to "does this body's heading order make sense" should not be an exception.
 */
export function htmlToRichTextDocument(html: string): RichTextDocument {
    const doc: RichTextDocument = { type: RICH_TEXT_NODE.Doc, content: [] };
    const stack: Frame[] = [{ tag: '', node: doc, at: 0 }];

    /** The node children are currently appended to. */
    const parent = (): RichTextNode => {
        for (let i = stack.length - 1; i >= 0; i -= 1) {
            const node = stack[i].node;
            if (node) return node;
        }
        return doc;
    };

    /** The marks a text run picks up from every open mark element. */
    const marks = (): RichTextMark[] | undefined => {
        const open = stack
            .map((frame) => frame.mark)
            .filter((mark): mark is RichTextMark => mark !== undefined);
        return open.length ? open : undefined;
    };

    /** How many nodes have been appended — see {@link Frame.at}. */
    let appended = 0;

    const appendText = (text: string): void => {
        if (text === '') return;
        const node: RichTextNode = { type: RICH_TEXT_NODE.Text, text };
        const carried = marks();
        if (carried) node.marks = carried;
        (parent().content ??= []).push(node);
        appended += 1;
    };

    /** An inline node (an image) carries the marks around it, as text does. */
    const appendNode = (node: RichTextNode, inline = false): void => {
        const carried = inline ? marks() : undefined;
        if (carried) node.marks = carried;
        (parent().content ??= []).push(node);
        appended += 1;
    };

    /** Pops back through `tag`'s frame, so an unclosed child can't strand it. */
    const closeTag = (tag: string): void => {
        for (let i = stack.length - 1; i > 0; i -= 1) {
            if (stack[i].tag !== tag) continue;
            const frame = stack[i];
            // An `<a></a>` that wrapped nothing is a link with no text — the
            // thing `inspectRichText` has to be able to see. Marks live on
            // content, so without an empty run to hang it on there would be
            // nothing left to find.
            if (
                frame.mark?.type === RICH_TEXT_MARK.Link &&
                appended === frame.at
            ) {
                appendNode({ type: RICH_TEXT_NODE.Text, text: '' }, true);
            }
            stack.length = i;
            return;
        }
    };

    let cursor = 0;
    let skipUntil: string | null = null;
    TOKEN_RE.lastIndex = 0;
    let token: RegExpExecArray | null;
    while ((token = TOKEN_RE.exec(html)) !== null) {
        const [whole, closing, rawTag, rawAttrs, selfClosing] = token;
        const text = html.slice(cursor, token.index);
        cursor = token.index + whole.length;
        if (whole.startsWith('<!--')) continue;
        const tag = rawTag.toLowerCase();

        if (skipUntil) {
            // Inside <script>/<style>: everything up to the matching close is
            // ignored, tags included.
            if (closing && tag === skipUntil) skipUntil = null;
            continue;
        }
        appendText(decodeEntities(text));

        if (closing) {
            closeTag(tag);
            continue;
        }
        if (RAW_TEXT_TAGS.has(tag)) {
            skipUntil = tag;
            continue;
        }

        const attrs = parseAttributes(rawAttrs ?? '');
        const lang = langAttr(attrs);
        const void_ = selfClosing !== undefined || VOID_TAGS.has(tag);

        if (tag === 'br') {
            appendNode({ type: RICH_TEXT_NODE.HardBreak });
            continue;
        }
        if (tag === 'hr') {
            appendNode({ type: RICH_TEXT_NODE.HorizontalRule });
            continue;
        }
        if (tag === 'img') {
            appendNode(
                {
                    type: RICH_TEXT_NODE.Image,
                    attrs: {
                        src: attrs['src'] ?? '',
                        // An absent `alt` and `alt=""` are different claims — the
                        // second says "decorative" — so the absent one stays
                        // absent rather than becoming an empty string.
                        ...(attrs['alt'] !== undefined
                            ? { alt: attrs['alt'] }
                            : {}),
                        ...(lang ? { lang } : {})
                    }
                },
                true
            );
            continue;
        }

        const heading = /^h([1-6])$/.exec(tag);
        if (heading) {
            const node: RichTextNode = {
                type: RICH_TEXT_NODE.Heading,
                attrs: { level: Number(heading[1]), ...(lang ? { lang } : {}) },
                content: []
            };
            appendNode(node);
            if (!void_) stack.push({ tag, node, at: appended });
            continue;
        }

        const blockType = BLOCK_TAGS[tag];
        if (blockType) {
            const node: RichTextNode = {
                type: blockType,
                ...(lang ? { attrs: { lang } } : {}),
                content: []
            };
            appendNode(node);
            if (!void_) stack.push({ tag, node, at: appended });
            continue;
        }

        const markType = MARK_TAGS[tag];
        if (markType) {
            const attrsOf: Record<string, unknown> = {};
            if (markType === RICH_TEXT_MARK.Link)
                attrsOf['href'] = attrs['href'] ?? '';
            if (lang) attrsOf['lang'] = lang;
            const mark: RichTextMark = {
                type: markType,
                ...(Object.keys(attrsOf).length ? { attrs: attrsOf } : {})
            };
            if (!void_) stack.push({ tag, mark, at: appended });
            continue;
        }

        if (TRANSPARENT_TAGS.has(tag)) {
            // A wrapper is worth a node only for the `lang` it carries. An
            // inline one becomes a mark so the run keeps its language without
            // the text being torn out of its paragraph.
            if (!lang) {
                if (!void_) stack.push({ tag, at: appended });
                continue;
            }
            if (
                tag === 'span' ||
                tag === 'small' ||
                tag === 'sub' ||
                tag === 'sup'
            ) {
                const mark: RichTextMark = {
                    type: RICH_TEXT_MARK.Language,
                    attrs: { lang }
                };
                if (!void_) stack.push({ tag, mark, at: appended });
                continue;
            }
            const node: RichTextNode = {
                type: RICH_TEXT_NODE.Container,
                attrs: { lang },
                content: []
            };
            appendNode(node);
            if (!void_) stack.push({ tag, node, at: appended });
            continue;
        }

        // An element the kernel has no reading for: its children still belong
        // to the enclosing block, so it is a frame and nothing else.
        if (!void_) stack.push({ tag, at: appended });
    }
    appendText(decodeEntities(html.slice(cursor)));
    return doc;
}

/**
 * The readable text inside a legacy HTML value, collapsed to single spaces —
 * what a `minLength`/`maxLength` counts and a table cell or a diff row shows.
 * Block boundaries become a space so `…end.</p><p>Next…` doesn't read as
 * `end.Next`; inline marks vanish without one.
 */
export function htmlToPlainText(html: string): string {
    let out = '';
    for (const node of flatten(htmlToRichTextDocument(html))) {
        out += node;
    }
    return out.replace(/\s+/g, ' ').trim();
}

/** Text runs of a parsed tree, with a space where a block boundary was. */
function* flatten(node: RichTextNode): Generator<string> {
    if (node.type === RICH_TEXT_NODE.Text) {
        yield node.text ?? '';
        return;
    }
    if (node.type !== RICH_TEXT_NODE.Doc) yield ' ';
    for (const child of node.content ?? []) yield* flatten(child);
    if (node.type !== RICH_TEXT_NODE.Doc) yield ' ';
}
