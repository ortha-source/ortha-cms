import { Extension } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';

/**
 * Bounds what `Tab` does at the end of a table.
 *
 * `@tiptap/extension-table`'s own binding never returns `false` in a table the
 * author can edit:
 *
 * ```js
 * Tab: () => {
 *   if (this.editor.commands.goToNextCell()) return true;
 *   if (!this.editor.can().addRowAfter()) return false;
 *   return this.editor.chain().addRowAfter().goToNextCell().run();
 * }
 * ```
 *
 * At the last cell it appends a row and moves into it — Word's and Google Docs'
 * behaviour, and genuinely wanted by an author who is building a table. But it
 * means an author who is merely trying to **leave** grows the table one row per
 * press, with no undo prompt and no visible cause: measured at 3 rows to 9 over
 * 27 presses, with focus never escaping (`ORT-165`).
 *
 * The convention is kept and the runaway is not. Tab still appends a row at the
 * last cell — *once*. A second Tab through the row it just made, while that row
 * is still empty, falls through instead, so the editor's ordinary Tab handling
 * takes over and focus leaves the document. One press adds a row; the next
 * press leaves. Nothing an author does on purpose is taken away, because an
 * author who wanted the row is typing in it, which makes it non-empty and arms
 * the append again.
 *
 * Registered at a higher priority than `TableKit` so this binding is offered the
 * keystroke first; returning `false` hands it back to the extensions below,
 * including the table's own.
 */
export const TableTab = Extension.create({
    name: 'orthaTableTab',

    // Above TableKit's default (100), so this is asked first.
    priority: 200,

    addKeyboardShortcuts() {
        return {
            Tab: () => {
                const { editor } = this;

                // Not in a table: nothing to bound. `false` lets the list
                // extensions and the editor's own handling have it.
                if (!editor.isActive('table')) return false;

                // Still cells to walk to — the ordinary case, and the one that
                // must stay fast.
                if (editor.commands.goToNextCell()) return true;

                // Last cell. Only append when the row the caret is in has been
                // written in; an empty trailing row is the one this handler
                // just made, and appending another would be the runaway.
                if (!lastRowHasContent(editor.state.selection.$anchor)) {
                    return false;
                }
                if (!editor.can().addRowAfter()) return false;
                return editor.chain().addRowAfter().goToNextCell().run();
            }
        };
    }
});

/**
 * Whether the last row of the table containing `$pos` has any text in it.
 *
 * Walks up to the enclosing `table` node rather than taking one from the
 * document, because tables nest (a table inside a column block) and the one
 * that matters is the one the caret is in. A table with no rows at all cannot
 * be produced by the insert command, but is treated as "no content" rather than
 * throwing.
 */
function lastRowHasContent($pos: {
    depth: number;
    node: (depth: number) => ProseMirrorNode;
}): boolean {
    for (let depth = $pos.depth; depth > 0; depth -= 1) {
        const node = $pos.node(depth);
        if (node.type.name !== 'table') continue;
        if (node.childCount === 0) return false;
        const lastRow = node.child(node.childCount - 1);
        return lastRow.textContent.trim().length > 0;
    }
    return false;
}
