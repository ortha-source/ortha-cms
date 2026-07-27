/**
 * Named constants for the editor's keys, drag payload and DOM hooks. Every
 * comparison in the package reads one of these rather than a bare string, so a
 * typo is a compile error instead of a shortcut that silently stops working.
 */

/** Keys the editor handles. */
export const KEY = {
    Enter: 'Enter',
    Backspace: 'Backspace',
    Delete: 'Delete',
    Tab: 'Tab',
    Escape: 'Escape',
    ArrowUp: 'ArrowUp',
    ArrowDown: 'ArrowDown',
    ArrowLeft: 'ArrowLeft',
    ArrowRight: 'ArrowRight',
    Slash: '/',
    Space: ' '
} as const;

/** Single-letter shortcuts, taken with the platform's modifier key. */
export const SHORTCUT_KEY = {
    Bold: 'b',
    Italic: 'i',
    Underline: 'u',
    Strike: 'd',
    Code: 'e',
    Link: 'k',
    Undo: 'z'
} as const;

/** The drag payload type — narrow enough that a foreign drop is ignored. */
export const BLOCK_DRAG_TYPE = 'application/x-ortha-block';

/** Where a drop lands relative to the block under the pointer. */
export const DROP_EDGE = { Before: 'before', After: 'after' } as const;

/** Where a drop lands relative to the block under the pointer. */
export type DropEdge = (typeof DROP_EDGE)[keyof typeof DROP_EDGE];

/** Where the caret should land when a block takes focus. */
export const CARET = { Start: 'start', End: 'end' } as const;

/**
 * Where the caret should land when a block takes focus — either end of the
 * block, or a **character offset** into it. The offset form exists for the
 * merge: joining two blocks has to leave the caret exactly where the seam is,
 * which is neither end of the resulting text.
 */
export type CaretPosition =
    | (typeof CARET)[keyof typeof CARET]
    | number;

/** A path rendered as a stable string — React keys and equality checks. */
export function pathKey(path: readonly number[]): string {
    return path.join('.');
}
