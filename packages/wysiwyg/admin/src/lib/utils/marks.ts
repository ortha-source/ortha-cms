/**
 * Inline marks — bold, italic, underline, strikethrough, code, link.
 *
 * These go through `document.execCommand`. It is deprecated, and that is a real
 * trade-off taken on purpose: it is also the only API every browser implements
 * for "toggle this mark across whatever the user selected", including the parts
 * nobody wants to reimplement (a selection spanning three existing marks, a
 * partially-bold range, splitting and re-joining the surrounding elements). The
 * alternative is several hundred lines of range surgery with worse edge-case
 * behavior. The blast radius is contained: every mark passes through this file,
 * so replacing the mechanism later is a change here and nowhere else.
 *
 * The output is normalized anyway — a block's HTML is sanitized on the way into
 * the stored value, so whatever tags a browser chooses to emit end up as the
 * same allow-listed set.
 */

/** The marks the toolbar and the keyboard shortcuts can toggle. */
export const MARK = {
    Bold: 'bold',
    Italic: 'italic',
    Underline: 'underline',
    Strike: 'strikeThrough'
} as const;

/** A toggleable inline mark. */
export type Mark = (typeof MARK)[keyof typeof MARK];

/** Whether the mark is active at the caret — drives the toolbar's pressed state. */
export function isMarkActive(mark: Mark): boolean {
    try {
        return document.queryCommandState(mark);
    } catch {
        // Firefox throws for an unsupported command rather than returning false.
        return false;
    }
}

/**
 * Toggles `mark` over the selection. `styleWithCSS(false)` is set first so a
 * browser emits `<b>`/`<i>` rather than a `<span style="…">` — the sanitizer
 * drops `style`, and without this the mark would visibly disappear on save.
 */
export function toggleMark(mark: Mark): void {
    document.execCommand('styleWithCSS', false, 'false');
    document.execCommand(mark);
}

/** Wraps the selection in `<code>`, or unwraps it when already code. */
export function toggleCodeMark(): void {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const existing = closestTag(selection.anchorNode, 'code');
    if (existing) {
        unwrap(existing);
        return;
    }
    if (selection.isCollapsed) return;
    const range = selection.getRangeAt(0);
    const code = document.createElement('code');
    try {
        range.surroundContents(code);
    } catch {
        // `surroundContents` refuses a range that partially selects a node
        // (half a bold run). Falling back to extract-and-wrap always works,
        // at the cost of re-inserting the content.
        code.appendChild(range.extractContents());
        range.insertNode(code);
    }
    selection.removeAllRanges();
    const after = document.createRange();
    after.selectNodeContents(code);
    selection.addRange(after);
}

/** Applies a link to the selection, replacing one already under the caret. */
export function applyLink(href: string): void {
    const existing = closestTag(window.getSelection()?.anchorNode, 'a');
    if (existing) {
        existing.setAttribute('href', href);
        return;
    }
    document.execCommand('createLink', false, href);
}

/** Removes the link under the caret, keeping its text. */
export function removeLink(): void {
    const existing = closestTag(window.getSelection()?.anchorNode, 'a');
    if (existing) unwrap(existing);
    else document.execCommand('unlink');
}

/** The `href` of the link under the caret, or `null`. */
export function linkAtCaret(): string | null {
    return (
        closestTag(window.getSelection()?.anchorNode, 'a')?.getAttribute(
            'href'
        ) ?? null
    );
}

/** Whether the caret sits inside an inline `<code>` run. */
export function isCodeMarkActive(): boolean {
    return closestTag(window.getSelection()?.anchorNode, 'code') !== null;
}

/** The nearest ancestor element with `tag`, starting from `node`. */
function closestTag(
    node: Node | null | undefined,
    tag: string
): HTMLElement | null {
    const element =
        node?.nodeType === Node.ELEMENT_NODE
            ? (node as HTMLElement)
            : (node?.parentElement ?? null);
    return element?.closest(tag) ?? null;
}

/** Replaces an element with its children, keeping the text in place. */
function unwrap(element: HTMLElement): void {
    const parent = element.parentNode;
    if (!parent) return;
    while (element.firstChild) parent.insertBefore(element.firstChild, element);
    parent.removeChild(element);
}

/**
 * Inserts sanitized HTML at the caret. Used by paste and by the link editor —
 * again `execCommand`, for the same reason: it keeps the browser's undo stack
 * and the caret consistent with a typed insertion.
 */
export function insertInlineHtml(html: string): void {
    document.execCommand('insertHTML', false, html);
}

/**
 * Inserts a soft line break at the caret — Shift+Enter, and Enter inside a
 * table cell.
 *
 * `insertLineBreak` rather than `insertHTML('<br>')`, which looks equivalent
 * and isn't: at the **end** of a block a browser needs a second, trailing
 * `<br>` for the new line to have any height, and inserting one by hand leaves
 * the caret *before* the break — so the next thing typed lands on the line the
 * author just left. `insertLineBreak` is the command that knows that dance.
 */
export function insertSoftBreak(): void {
    if (document.execCommand('insertLineBreak')) return;
    // Older Safari has no `insertLineBreak`. The trailing break is what makes
    // the new line visible; the caret sits between the two.
    document.execCommand('insertHTML', false, '<br><br>');
}

/** Which marks are active at the caret, plus the link under it. */
export interface MarkState {
    readonly bold: boolean;
    readonly italic: boolean;
    readonly underline: boolean;
    readonly strike: boolean;
    readonly code: boolean;
    /** The `href` under the caret, or `null`. */
    readonly link: string | null;
}

/**
 * Reads every mark at the caret in one pass. The single definition, because
 * **two** toolbars ask the same question — the floating one over a selection
 * and the persistent one at the top of the expanded editor — and two of them
 * disagreeing about whether the selection is bold would be worse than either
 * being wrong.
 */
export function readMarkState(): MarkState {
    return {
        bold: isMarkActive(MARK.Bold),
        italic: isMarkActive(MARK.Italic),
        underline: isMarkActive(MARK.Underline),
        strike: isMarkActive(MARK.Strike),
        code: isCodeMarkActive(),
        link: linkAtCaret()
    };
}
