/**
 * Named constants for the editor's keys. Every comparison in the package reads
 * one of these rather than a bare string, so a typo is a compile error instead
 * of a shortcut that silently stops working.
 *
 * Most of what used to live here — the drag payload, the drop edges, the caret
 * positions, the path key — belonged to the block model the editor kept in
 * React state. TipTap holds the document now, and none of those ideas has a
 * counterpart: a position in a ProseMirror document is an integer.
 */

/** Keys handled outside TipTap's own bindings. */
export const KEY = {
    Enter: 'Enter',
    Escape: 'Escape'
} as const;
