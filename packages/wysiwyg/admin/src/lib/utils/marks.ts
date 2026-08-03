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

import {
    COLOR_MARK,
    COLOR_MARK_TAG,
    isColorSet,
    isHexColor,
    type ColorMark
} from '@ortha-cms/wysiwyg-core';

/** The CSS property each colour mark sets when the colour is a custom hex. */
const COLOR_STYLE_PROPERTY: Readonly<Record<ColorMark, string>> = {
    [COLOR_MARK.Text]: 'color',
    [COLOR_MARK.Highlight]: 'backgroundColor'
};

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
    surroundSelection('code');
}

/**
 * Wraps the current selection in a fresh `tag` carrying `attributes`, and
 * leaves the selection over it.
 *
 * `execCommand` has no equivalent — `foreColor`/`hiliteColor` emit a `style`
 * attribute the sanitizer drops on the way out, so the colour would vanish on
 * save. This is the range surgery that file's header warns about, kept to the
 * one shape that needs it.
 */
function surroundSelection(
    tag: string,
    attributes: Readonly<Record<string, string>> = {}
): HTMLElement | null {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
        return null;
    }
    const range = selection.getRangeAt(0);
    const wrapper = document.createElement(tag);
    for (const [name, value] of Object.entries(attributes)) {
        wrapper.setAttribute(name, value);
    }
    try {
        range.surroundContents(wrapper);
    } catch {
        // `surroundContents` refuses a range that partially selects a node
        // (half a bold run). Falling back to extract-and-wrap always works,
        // at the cost of re-inserting the content.
        wrapper.appendChild(range.extractContents());
        range.insertNode(wrapper);
    }
    selection.removeAllRanges();
    const after = document.createRange();
    after.selectNodeContents(wrapper);
    selection.addRange(after);
    return wrapper;
}

/**
 * Applies a palette colour to the selection, or removes the colour when
 * `color` is `null`.
 *
 * Removal unwraps the run the caret is in rather than wrapping it in a
 * "default" — a document should carry no colour markup at all where the author
 * chose no colour, so that un-colouring is a true undo of colouring.
 */
export function applyColorMark(mark: ColorMark, color: string | null): void {
    const { tag } = COLOR_MARK_TAG[mark];
    const existing = closestColorMark(mark);

    if (!isColorSet(color)) {
        if (existing) unwrap(existing);
        return;
    }
    // Re-colouring an already-coloured run is an edit to that run, not another
    // wrapper — otherwise five changes of mind leave five nested spans.
    const target =
        existing && selectionFills(existing)
            ? existing
            : surroundSelection(tag);
    if (target) paintColor(target, mark, color as string);
}

/**
 * Writes a colour onto an element as whichever of the two forms it is.
 *
 * A **palette name** goes on the data attribute, where a stylesheet resolves it
 * against the surface it is rendered on — the same document then reads
 * correctly on a light site and a dark one. A **custom hex** has no such
 * stylesheet to meet, so it goes inline, which is the one place the sanitizer
 * lets a colour through. Setting either clears the other, so an element never
 * carries two answers.
 */
function paintColor(element: HTMLElement, mark: ColorMark, color: string): void {
    const { attribute } = COLOR_MARK_TAG[mark];
    const property = COLOR_STYLE_PROPERTY[mark];
    if (isHexColor(color)) {
        element.removeAttribute(attribute);
        element.style.setProperty(
            property === 'color' ? 'color' : 'background-color',
            color
        );
        return;
    }
    element.style.removeProperty(
        property === 'color' ? 'color' : 'background-color'
    );
    element.setAttribute(attribute, color);
}

/** The colour mark under the caret, if the caret is inside one. */
function closestColorMark(mark: ColorMark): HTMLElement | null {
    const { tag, attribute } = COLOR_MARK_TAG[mark];
    const property = mark === COLOR_MARK.Text ? 'color' : 'background-color';
    const element = closestTag(window.getSelection()?.anchorNode, tag);
    if (!element) return null;
    // Either form counts — a palette name on the attribute, or a custom hex
    // inline. Both are "this run is coloured".
    return element.hasAttribute(attribute) ||
        element.style.getPropertyValue(property) !== ''
        ? element
        : null;
}

/** Whether the selection covers all of `element` (so recolouring it is safe). */
function selectionFills(element: HTMLElement): boolean {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return false;
    const range = selection.getRangeAt(0);
    const whole = document.createRange();
    whole.selectNodeContents(element);
    return (
        range.compareBoundaryPoints(Range.START_TO_START, whole) <= 0 &&
        range.compareBoundaryPoints(Range.END_TO_END, whole) >= 0
    );
}

/**
 * The colour at the caret for each mark — a palette name, a `#hex`, or `null`.
 * The two forms are reported the same way, so the picker shows the right thing
 * ticked whichever way the author set it.
 */
export function readColorMarks(): Record<ColorMark, string | null> {
    const read = (mark: ColorMark) => {
        const element = closestColorMark(mark);
        if (!element) return null;
        const name = element.getAttribute(COLOR_MARK_TAG[mark].attribute);
        if (name) return name;
        const property =
            mark === COLOR_MARK.Text ? 'color' : 'background-color';
        return normalizeHex(element.style.getPropertyValue(property));
    };
    return {
        [COLOR_MARK.Text]: read(COLOR_MARK.Text),
        [COLOR_MARK.Highlight]: read(COLOR_MARK.Highlight)
    };
}

/**
 * A style value back as the `#rrggbb` the picker speaks. A browser hands back
 * whatever form it stored — Chromium normalizes to `rgb(255, 0, 85)` — so the
 * round trip through the DOM has to be undone before comparing.
 */
function normalizeHex(value: string): string | null {
    const trimmed = value.trim();
    if (trimmed === '') return null;
    if (isHexColor(trimmed)) return trimmed.toLowerCase();
    const rgb = /^rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)/.exec(trimmed);
    if (!rgb) return null;
    const hex = (part: string) =>
        Number(part).toString(16).padStart(2, '0');
    return `#${hex(rgb[1])}${hex(rgb[2])}${hex(rgb[3])}`;
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
    /** The palette colour of the glyphs under the caret, or `null`. */
    readonly color: string | null;
    /** The palette colour behind them, or `null`. */
    readonly highlight: string | null;
}

/**
 * Reads every mark at the caret in one pass. The single definition, because
 * **two** toolbars ask the same question — the floating one over a selection
 * and the persistent one at the top of the expanded editor — and two of them
 * disagreeing about whether the selection is bold would be worse than either
 * being wrong.
 */
export function readMarkState(): MarkState {
    const colors = readColorMarks();
    return {
        bold: isMarkActive(MARK.Bold),
        italic: isMarkActive(MARK.Italic),
        underline: isMarkActive(MARK.Underline),
        strike: isMarkActive(MARK.Strike),
        code: isCodeMarkActive(),
        link: linkAtCaret(),
        color: colors[COLOR_MARK.Text],
        highlight: colors[COLOR_MARK.Highlight]
    };
}
