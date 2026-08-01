/**
 * A small, forgiving HTML → {@link HtmlNode} tree parser.
 *
 * Forgiving is the requirement, not a shortcut: the input is whatever is already
 * stored in the field (possibly written by an earlier editor, an import script,
 * or pasted out of Word), so unclosed tags, stray `</div>`s and unquoted
 * attributes must all produce *something* rather than throw. Anything it can't
 * make sense of degrades to text, and the sanitizer then decides what survives.
 */

import {
    CLOSES_PARAGRAPH,
    RAW_TEXT_TAGS,
    VOID_TAGS,
    type HtmlNode
} from './node';

/** A node still being built — children are appended as the parser walks. */
interface OpenElement {
    tag: string;
    attrs: Record<string, string>;
    children: HtmlNode[];
}

/** Matches a tag name at the current position. */
const TAG_NAME = /^[a-zA-Z][a-zA-Z0-9:-]*/;

/**
 * Parses `html` into a node tree. Never throws: malformed markup is recovered
 * from, and unrecognized `<` runs are emitted as text.
 */
export function parseHtmlNodes(html: string): HtmlNode[] {
    const root: OpenElement = { tag: '#root', attrs: {}, children: [] };
    const stack: OpenElement[] = [root];
    const top = () => stack[stack.length - 1];

    let index = 0;
    while (index < html.length) {
        const lt = html.indexOf('<', index);
        if (lt === -1) {
            pushText(top(), html.slice(index));
            break;
        }
        if (lt > index) pushText(top(), html.slice(index, lt));

        // Comment / doctype / CDATA — dropped entirely.
        if (html.startsWith('<!--', lt)) {
            const end = html.indexOf('-->', lt + 4);
            index = end === -1 ? html.length : end + 3;
            continue;
        }
        if (html.startsWith('<!', lt) || html.startsWith('<?', lt)) {
            const end = html.indexOf('>', lt);
            index = end === -1 ? html.length : end + 1;
            continue;
        }

        // Closing tag.
        if (html.startsWith('</', lt)) {
            const match = TAG_NAME.exec(html.slice(lt + 2));
            const end = html.indexOf('>', lt);
            if (!match) {
                pushText(top(), '<');
                index = lt + 1;
                continue;
            }
            closeTag(stack, match[0].toLowerCase());
            index = end === -1 ? html.length : end + 1;
            continue;
        }

        // Opening tag.
        const match = TAG_NAME.exec(html.slice(lt + 1));
        if (!match) {
            // A bare `<` in prose ("a < b") — keep it as text, escaped, so a
            // round-trip through the serializer stays valid.
            pushText(top(), '&lt;');
            index = lt + 1;
            continue;
        }
        const tag = match[0].toLowerCase();
        const parsed = readAttributes(html, lt + 1 + match[0].length);
        index = parsed.next;

        if (RAW_TEXT_TAGS.has(tag)) {
            // Consume the raw body so its content can never look like markup.
            const close = html.toLowerCase().indexOf(`</${tag}`, index);
            const body = html.slice(index, close === -1 ? html.length : close);
            const element: OpenElement = {
                tag,
                attrs: parsed.attrs,
                children: []
            };
            if (body) element.children.push({ kind: 'text', text: body });
            top().children.push(finalize(element));
            if (close === -1) {
                index = html.length;
            } else {
                const gt = html.indexOf('>', close);
                index = gt === -1 ? html.length : gt + 1;
            }
            continue;
        }

        applyImpliedClose(stack, tag);

        if (VOID_TAGS.has(tag) || parsed.selfClosing) {
            top().children.push(
                finalize({ tag, attrs: parsed.attrs, children: [] })
            );
            continue;
        }
        stack.push({ tag, attrs: parsed.attrs, children: [] });
    }

    // Anything still open at the end is closed implicitly.
    while (stack.length > 1) closeTop(stack);
    return root.children;
}

/** Appends text, merging with a preceding text node so runs stay whole. */
function pushText(parent: OpenElement, text: string): void {
    if (text === '') return;
    const last = parent.children[parent.children.length - 1];
    if (last && last.kind === 'text') {
        parent.children[parent.children.length - 1] = {
            kind: 'text',
            text: last.text + text
        };
        return;
    }
    parent.children.push({ kind: 'text', text });
}

/** Freezes an open element into an immutable node. */
function finalize(element: OpenElement): HtmlNode {
    return {
        kind: 'element',
        tag: element.tag,
        attrs: element.attrs,
        children: element.children
    };
}

/** Pops the top of the stack into its parent's children. */
function closeTop(stack: OpenElement[]): void {
    const element = stack.pop();
    if (!element) return;
    stack[stack.length - 1].children.push(finalize(element));
}

/**
 * Closes up to and including the nearest matching open `tag`. A closing tag
 * with no match at all (`</div>` in a fragment that never opened one) is
 * ignored rather than unwinding the whole stack.
 */
function closeTag(stack: OpenElement[], tag: string): void {
    const at = stack.map((element) => element.tag).lastIndexOf(tag);
    if (at <= 0) return;
    while (stack.length > at) closeTop(stack);
}

/**
 * Applies the implied-end-tag rules a browser would: a block-level start tag
 * ends an open `<p>`, a `<li>` ends the previous `<li>`, and a table cell/row
 * ends its sibling. Without these, list items nest into each other and a
 * document of unclosed paragraphs collapses into one block.
 */
function applyImpliedClose(stack: OpenElement[], tag: string): void {
    const top = () => stack[stack.length - 1].tag;
    if (CLOSES_PARAGRAPH.has(tag)) {
        while (stack.length > 1 && top() === 'p') closeTop(stack);
    }
    if (tag === 'li') {
        while (stack.length > 1 && top() === 'li') closeTop(stack);
    }
    if (tag === 'td' || tag === 'th') {
        while (stack.length > 1 && (top() === 'td' || top() === 'th')) {
            closeTop(stack);
        }
    }
    if (tag === 'tr') {
        while (
            stack.length > 1 &&
            (top() === 'td' || top() === 'th' || top() === 'tr')
        ) {
            closeTop(stack);
        }
    }
}

/** The attributes of a start tag, plus where the tag ends. */
interface ParsedAttributes {
    attrs: Record<string, string>;
    selfClosing: boolean;
    next: number;
}

/** Reads `name="value"` pairs until the tag's `>`. */
function readAttributes(html: string, start: number): ParsedAttributes {
    const attrs: Record<string, string> = {};
    let index = start;
    let selfClosing = false;

    while (index < html.length) {
        while (index < html.length && /\s/.test(html[index])) index += 1;
        if (index >= html.length) break;

        if (html[index] === '>') {
            index += 1;
            break;
        }
        if (html.startsWith('/>', index)) {
            selfClosing = true;
            index += 2;
            break;
        }
        if (html[index] === '/') {
            index += 1;
            continue;
        }

        const nameMatch = /^[^\s=/>]+/.exec(html.slice(index));
        if (!nameMatch) {
            index += 1;
            continue;
        }
        const name = nameMatch[0].toLowerCase();
        index += nameMatch[0].length;

        while (index < html.length && /\s/.test(html[index])) index += 1;
        if (html[index] !== '=') {
            // A valueless attribute (`disabled`, `checked`) — HTML treats it as
            // the empty string, and so do we.
            attrs[name] = '';
            continue;
        }
        index += 1;
        while (index < html.length && /\s/.test(html[index])) index += 1;

        const quote = html[index];
        if (quote === '"' || quote === "'") {
            const end = html.indexOf(quote, index + 1);
            attrs[name] = html.slice(index + 1, end === -1 ? undefined : end);
            index = end === -1 ? html.length : end + 1;
            continue;
        }
        const valueMatch = /^[^\s>]*/.exec(html.slice(index));
        attrs[name] = valueMatch ? valueMatch[0] : '';
        index += valueMatch ? valueMatch[0].length : 0;
    }

    return { attrs, selfClosing, next: index };
}
