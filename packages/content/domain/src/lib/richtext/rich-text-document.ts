/**
 * The readings the rest of the kernel takes off a rich-text value: its text,
 * whether it is empty, and the document tree to check it against.
 *
 * The tree's own vocabulary, types and guards live next door in
 * `rich-text-node.ts`; this is the layer above them — the two are split so the
 * legacy-HTML parser can build a tree without importing the module that reads
 * one.
 */

import {
    RICH_TEXT_NODE,
    isRichTextDocument,
    walkRichText
} from './rich-text-node';
import type { RichTextDocument, RichTextNode } from './rich-text-node';
import { htmlToPlainText, htmlToRichTextDocument } from './html-to-document';

/** Node types that hold prose but end the line the text before them was on. */
const BLOCK_NODES: ReadonlySet<string> = new Set([
    RICH_TEXT_NODE.Paragraph,
    RICH_TEXT_NODE.Heading,
    RICH_TEXT_NODE.ListItem,
    RICH_TEXT_NODE.Blockquote,
    RICH_TEXT_NODE.CodeBlock,
    RICH_TEXT_NODE.TableRow,
    RICH_TEXT_NODE.TableHeader,
    RICH_TEXT_NODE.TableCell,
    RICH_TEXT_NODE.TableCaption
]);

/**
 * The readable text of a document — what a `minLength`/`maxLength` rule is
 * actually about, and what a `pattern` is matched against.
 *
 * Block boundaries become a newline so "…end." and "Next…" don't read as one
 * word, and a `hardBreak` does the same. Markup contributes **nothing**: that
 * is the whole point — an author who bolds a word no longer spends characters
 * on `<strong></strong>`.
 */
export function richTextDocumentText(node: RichTextNode): string {
    let out = '';
    const visit = (current: RichTextNode): void => {
        if (current.type === RICH_TEXT_NODE.Text) {
            out += current.text ?? '';
            return;
        }
        if (current.type === RICH_TEXT_NODE.HardBreak) {
            out += '\n';
            return;
        }
        const block = BLOCK_NODES.has(current.type);
        if (block && out !== '' && !out.endsWith('\n')) out += '\n';
        for (const child of current.content ?? []) visit(child);
        if (block && out !== '' && !out.endsWith('\n')) out += '\n';
    };
    visit(node);
    return out.replace(/\n+$/, '');
}

/**
 * The readable text of any rich-text **value** — a document, or a legacy HTML
 * string (tag-stripped; see {@link htmlToPlainText}). `''` for anything else,
 * so a caller can treat "nothing to read" uniformly.
 */
export function richTextPlainText(value: unknown): string {
    if (isRichTextDocument(value)) return richTextDocumentText(value);
    if (typeof value === 'string') return htmlToPlainText(value);
    return '';
}

/**
 * Node types that carry no meaning on their own — a document made only of
 * these is empty however many of them there are.
 *
 * Defined as what empty *is*, rather than as a list of nodes that count as
 * content. The inverse rule has to name every node that can carry meaning
 * without carrying words, and it will always be one short: a table, a divider,
 * an image, a callout, or a column layout an author has just inserted but not
 * yet typed into is content, and throwing it away on save is a lost edit.
 */
const EMPTY_NODES: ReadonlySet<string> = new Set([
    RICH_TEXT_NODE.Doc,
    RICH_TEXT_NODE.Paragraph,
    RICH_TEXT_NODE.HardBreak,
    RICH_TEXT_NODE.Text,
    RICH_TEXT_NODE.Container
]);

/**
 * Whether a document holds nothing a reader would see: no words, and no node
 * that means something without them.
 */
export function isEmptyRichTextDocument(doc: RichTextNode): boolean {
    for (const node of walkRichText(doc)) {
        if (!EMPTY_NODES.has(node.type)) return false;
        if (
            node.type === RICH_TEXT_NODE.Text &&
            (node.text ?? '').trim() !== ''
        )
            return false;
    }
    return true;
}

/**
 * The exact markup an emptied editor leaves behind in a **legacy** string
 * value: paragraph wrappers, line breaks, and whitespace, and nothing else.
 */
const EMPTY_HTML_RE = /^(?:\s|&nbsp;|<p(?:\s[^>]*)?>|<\/p>|<br\s*\/?>)*$/i;

/**
 * Whether a rich-text **value** holds nothing a reader would see — the test
 * `required`, the publish gate and the admin's empty state all share.
 *
 * The case that matters is the emptied editor: a `required` body whose content
 * was cleared must fail validation, and it only does if `<p></p>` (or the
 * document that serializes to it) counts as empty rather than as a value.
 */
export function isEmptyRichText(value: unknown): boolean {
    if (value === null || value === undefined) return true;
    if (typeof value === 'string') return EMPTY_HTML_RE.test(value);
    if (isRichTextDocument(value)) return isEmptyRichTextDocument(value);
    return false;
}

/**
 * Any rich-text value read as a document — parsing a legacy HTML string with
 * {@link htmlToRichTextDocument} — so a rule can be written once, against the
 * tree, and still apply to content written before it existed.
 *
 * **Analysis only.** The HTML parse is lossy by design (it keeps structure and
 * text, not every attribute an editor extension might have written), so the
 * result is something to *check*, never something to store. Storage keeps the
 * value it was given.
 */
export function asRichTextDocument(value: unknown): RichTextDocument {
    if (isRichTextDocument(value)) return value;
    if (typeof value === 'string') return htmlToRichTextDocument(value);
    return { type: RICH_TEXT_NODE.Doc, content: [] };
}
