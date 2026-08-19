/**
 * The **structured rich-text document** — the shape a `richtext` value takes.
 *
 * A rich-text body used to be an opaque HTML string, which meant the kernel
 * could say nothing about it beyond "it is a string of length N". Heading
 * order, table headers, link text and the language of a quoted passage were
 * unmodelled and therefore uncheckable (WCAG 1.3.1 / 2.4.6 / 3.1.2), and a
 * `maxLength` spent the author's budget on `<strong>` tags.
 *
 * So a value is a **node tree** — the ProseMirror/TipTap JSON the admin editor
 * already produces — and this module is the tree itself: its vocabulary, its
 * types, its guards and its walk.
 *
 * ### Deliberately open vocabulary
 *
 * {@link RICH_TEXT_NODE} names the nodes the kernel *reasons about*, not the
 * nodes a document may contain. An editor plugin is free to add a callout, a
 * column layout, an embed — those ride through untouched. Closing the
 * vocabulary would make the kernel the gatekeeper of every editor extension,
 * which is precisely the coupling ADR-0003 keeps out of here.
 *
 * ### Legacy HTML strings
 *
 * A string is still a valid `richtext` value: bodies written before this
 * change are stored as HTML and stay that way until the record is next saved
 * through the editor, which rewrites them as a document. The readings that
 * have to accept both shapes — `richTextPlainText`, `isEmptyRichText`,
 * `asRichTextDocument` — live in `rich-text-document.ts`.
 */

/**
 * Node types the kernel understands. Anything else in a document is carried
 * through untouched (see the note above) — this is the reasoning vocabulary,
 * not an allowlist.
 */
export const RICH_TEXT_NODE = {
    /** The document root. */
    Doc: 'doc',
    /** A leaf holding the actual characters, in {@link RichTextNode.text}. */
    Text: 'text',
    Paragraph: 'paragraph',
    /** `attrs.level` is 1-6. */
    Heading: 'heading',
    BulletList: 'bulletList',
    OrderedList: 'orderedList',
    ListItem: 'listItem',
    Blockquote: 'blockquote',
    CodeBlock: 'codeBlock',
    HorizontalRule: 'horizontalRule',
    /** A line break inside a block — carries no text of its own. */
    HardBreak: 'hardBreak',
    Image: 'image',
    Table: 'table',
    TableRow: 'tableRow',
    /** A `<th>` — what makes a table's cells associable (WCAG 1.3.1). */
    TableHeader: 'tableHeader',
    TableCell: 'tableCell',
    /** A `<caption>` — names the table for a reader who cannot see it. */
    TableCaption: 'tableCaption',
    /**
     * A block element with no meaning of its own (a `<div>`, a `<section>`).
     * Only {@link htmlToRichTextDocument} produces these, for a legacy HTML
     * value whose wrapper carried a `lang` worth keeping.
     */
    Container: 'container'
} as const;

/** Mark types the kernel understands. Same open-vocabulary rule as the nodes. */
export const RICH_TEXT_MARK = {
    /** `attrs.href` — the mark whose text has to say where it goes (2.4.4). */
    Link: 'link',
    Bold: 'bold',
    Italic: 'italic',
    Underline: 'underline',
    Strike: 'strike',
    Code: 'code',
    Highlight: 'highlight',
    TextStyle: 'textStyle',
    /**
     * A run of text in another language — `attrs.lang` is a BCP-47 tag. The
     * inline half of language-of-parts (3.1.2); the block half is a `lang`
     * attribute on the node itself.
     */
    Language: 'language'
} as const;

/** One mark on a text run. */
export interface RichTextMark {
    /** Mark type — a {@link RICH_TEXT_MARK} value, or an editor's own. */
    type: string;
    /** Mark attributes (`href` on a link, `lang` on a language run). */
    attrs?: Record<string, unknown>;
}

/**
 * One node of the tree. A `text` node carries {@link text} and no
 * {@link content}; every other node carries {@link content} and no text.
 */
export interface RichTextNode {
    /** Node type — a {@link RICH_TEXT_NODE} value, or an editor's own. */
    type: string;
    /**
     * Node attributes. `level` on a heading, `src`/`alt` on an image, and —
     * on any node — `lang`, the BCP-47 tag naming the language of everything
     * inside it.
     */
    attrs?: Record<string, unknown>;
    /** Child nodes, for a non-text node. */
    content?: RichTextNode[];
    /** Marks on a text run. */
    marks?: RichTextMark[];
    /** The characters, for a `text` node. */
    text?: string;
}

/** A whole rich-text body: the `doc` root and its blocks. */
export interface RichTextDocument extends RichTextNode {
    type: typeof RICH_TEXT_NODE.Doc;
}

/** Whether `value` is shaped like a node (a `type` string, at minimum). */
export function isRichTextNode(value: unknown): value is RichTextNode {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return false;
    }
    const node = value as Record<string, unknown>;
    if (typeof node['type'] !== 'string' || node['type'] === '') return false;
    if (node['text'] !== undefined && typeof node['text'] !== 'string')
        return false;
    if (node['content'] !== undefined) {
        if (!Array.isArray(node['content'])) return false;
        if (!node['content'].every(isRichTextNode)) return false;
    }
    if (node['marks'] !== undefined) {
        if (!Array.isArray(node['marks'])) return false;
        if (
            !node['marks'].every(
                (mark) =>
                    typeof mark === 'object' &&
                    mark !== null &&
                    typeof (mark as Record<string, unknown>)['type'] ===
                        'string'
            )
        )
            return false;
    }
    return true;
}

/**
 * Whether `value` is a rich-text **document** — a well-formed node tree rooted
 * at `doc`. This is the shape check the validator turns into
 * `must be a rich-text document`, so it is deliberately structural and total:
 * a tree that passes here can be walked without a single further guard.
 */
export function isRichTextDocument(value: unknown): value is RichTextDocument {
    return (
        isRichTextNode(value) &&
        value.type === RICH_TEXT_NODE.Doc &&
        value.text === undefined
    );
}

/**
 * Every node in the tree, in document order, root first. A generator so a
 * caller that only wants the first match (or the headings) pays for nothing
 * else.
 */
export function* walkRichText(node: RichTextNode): Generator<RichTextNode> {
    yield node;
    for (const child of node.content ?? []) {
        yield* walkRichText(child);
    }
}

/** The `lang` attribute on a node or mark, when it carries a non-blank one. */
export function langOf(node: {
    attrs?: Record<string, unknown>;
}): string | undefined {
    const lang = node.attrs?.['lang'];
    return typeof lang === 'string' && lang.trim() !== ''
        ? lang.trim()
        : undefined;
}
