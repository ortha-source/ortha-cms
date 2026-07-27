/**
 * The DOM-selection primitives the editable blocks are built on: where the
 * caret is, how to put it somewhere, and how to cut a block's content in two at
 * it.
 *
 * All of it is deliberately confined to this file. Everything above it works on
 * the block model, so the parts of the editor that are hard to reason about
 * (ranges, offsets, browsers disagreeing about where a caret "is") stay in one
 * place instead of leaking into every block renderer.
 */

import { CARET, type CaretPosition } from './constants';

/** The active selection, or `null` when there is none in this document. */
export function currentSelection(): Selection | null {
    const selection = window.getSelection();
    return selection && selection.rangeCount > 0 ? selection : null;
}

/** Whether the caret sits inside `element`. */
export function selectionInside(element: HTMLElement): boolean {
    const selection = currentSelection();
    const node = selection?.anchorNode;
    return !!node && element.contains(node);
}

/**
 * Whether the caret is at the very start of `element` — the test that decides
 * whether Backspace merges this block into the previous one or just deletes a
 * character. Measured by range comparison rather than by offset, because an
 * offset of 0 inside a nested `<strong>` is *not* the start of the block.
 */
export function caretAtStart(element: HTMLElement): boolean {
    const selection = currentSelection();
    if (!selection || !selection.isCollapsed) return false;
    const probe = document.createRange();
    probe.selectNodeContents(element);
    probe.setEnd(selection.anchorNode as Node, selection.anchorOffset);
    return probe.toString().length === 0;
}

/** Whether the caret is at the very end of `element`. */
export function caretAtEnd(element: HTMLElement): boolean {
    const selection = currentSelection();
    if (!selection || !selection.isCollapsed) return false;
    const probe = document.createRange();
    probe.selectNodeContents(element);
    probe.setStart(selection.anchorNode as Node, selection.anchorOffset);
    return probe.toString().length === 0;
}

/** Puts the caret at the start or end of `element` and focuses it. */
export function placeCaret(
    element: HTMLElement,
    at: CaretPosition = CARET.End
): void {
    element.focus({ preventScroll: true });
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(at === CARET.Start);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
}

/** The HTML of a document fragment — how a split's two halves are read out. */
function fragmentHtml(fragment: DocumentFragment): string {
    const holder = document.createElement('div');
    holder.appendChild(fragment);
    return holder.innerHTML;
}

/** The two halves of a block's content, cut at the caret. */
export interface SplitContent {
    readonly before: string;
    readonly after: string;
}

/**
 * Splits `element`'s content at the caret (or across the selection, which is
 * then dropped — pressing Enter over a selection replaces it, as in every text
 * editor). Formatting is preserved on both sides because the halves are read
 * out as HTML, not as text.
 */
export function splitAtCaret(element: HTMLElement): SplitContent {
    const selection = currentSelection();
    if (!selection) return { before: element.innerHTML, after: '' };
    const range = selection.getRangeAt(0);

    const head = range.cloneRange();
    head.selectNodeContents(element);
    head.setEnd(range.startContainer, range.startOffset);

    const tail = range.cloneRange();
    tail.selectNodeContents(element);
    tail.setStart(range.endContainer, range.endOffset);

    return {
        before: fragmentHtml(head.cloneContents()),
        after: fragmentHtml(tail.cloneContents())
    };
}

/**
 * The text between the start of `element` and the caret — what the markdown
 * input rules (`# `, `- `, `> `) and the slash menu's query are read from.
 */
export function textBeforeCaret(element: HTMLElement): string {
    const selection = currentSelection();
    if (!selection) return '';
    const probe = document.createRange();
    probe.selectNodeContents(element);
    probe.setEnd(selection.anchorNode as Node, selection.anchorOffset);
    return probe.toString();
}

/**
 * Deletes `count` characters immediately before the caret — how an input rule
 * removes the `## ` it just consumed without rewriting (and re-rendering) the
 * whole block, which would cost the caret its place.
 */
export function deleteBeforeCaret(count: number): void {
    const selection = currentSelection();
    if (!selection || count <= 0) return;
    for (let index = 0; index < count; index += 1) {
        selection.modify('extend', 'backward', 'character');
    }
    selection.deleteFromDocument();
    selection.collapseToStart();
}

/** The viewport rectangle of the current selection — where a menu is anchored. */
export function selectionRect(): DOMRect | null {
    const selection = currentSelection();
    if (!selection) return null;
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    // A collapsed caret at the start of an empty line reports a zero rect in
    // some browsers; fall back to the element that holds it so a menu still
    // lands somewhere sensible instead of in the page's top-left corner.
    if (rect.width === 0 && rect.height === 0) {
        const node = range.startContainer;
        const element =
            node.nodeType === Node.ELEMENT_NODE
                ? (node as HTMLElement)
                : node.parentElement;
        return element?.getBoundingClientRect() ?? null;
    }
    return rect;
}

/** Whether the current selection spans any content (vs. a bare caret). */
export function hasTextSelection(): boolean {
    const selection = currentSelection();
    return !!selection && !selection.isCollapsed && selection.toString() !== '';
}

/**
 * Puts the caret `offset` characters into `element`, counting text only. This
 * is how a merge lands the caret on the seam between the two blocks it just
 * joined — the offset is a character count in the *previous* block's text, and
 * the markup around it is irrelevant to where the user expects to be.
 */
export function placeCaretAtOffset(element: HTMLElement, offset: number): void {
    element.focus({ preventScroll: true });
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let remaining = offset;
    let node = walker.nextNode();
    while (node) {
        const length = node.textContent?.length ?? 0;
        if (remaining <= length) break;
        remaining -= length;
        const next = walker.nextNode();
        if (!next) break;
        node = next;
    }
    const range = document.createRange();
    if (node) {
        range.setStart(node, Math.min(remaining, node.textContent?.length ?? 0));
    } else {
        range.selectNodeContents(element);
    }
    range.collapse(true);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
}
