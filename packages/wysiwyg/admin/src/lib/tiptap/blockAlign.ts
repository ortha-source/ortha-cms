import { Extension } from '@tiptap/core';
import { BLOCK_ALIGN, type BlockAlign } from '@ortha-cms/wysiwyg-core';

/** The node types an alignment may be set on — the ones core round-trips it for. */
export const ALIGNABLE_TYPES = [
    'paragraph',
    'heading',
    'listItem',
    'taskItem',
    'blockquote',
    'callout',
    'image',
    'table',
    'tableCell',
    'tableHeader'
] as const;

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        blockAlign: {
            /** Aligns every alignable node in the selection. */
            setBlockAlign: (align: BlockAlign) => ReturnType;
        };
    }
}

/**
 * Alignment as a **global attribute**, stored on `data-align`.
 *
 * Not TipTap's own `TextAlign`, which writes `style="text-align: …"`. The
 * stored value is HTML a delivery surface styles for itself, so the choice has
 * to survive as a *name* it can map — `data-align="center"`, pinned to a
 * vocabulary by the sanitizer both runtimes share. An inline `text-align` would
 * be dropped by that pass, so the alignment would simply not survive a save.
 *
 * `left` is the absence of an alignment and is never written, which is what
 * keeps a centred-then-uncentred paragraph byte-identical to one nobody
 * touched.
 */
export const BlockAlignment = Extension.create({
    name: 'blockAlign',

    addGlobalAttributes() {
        return [
            {
                types: [...ALIGNABLE_TYPES],
                attributes: {
                    align: {
                        default: null,
                        parseHTML: (element) =>
                            element.getAttribute('data-align'),
                        renderHTML: (attributes) =>
                            attributes['align']
                                ? { 'data-align': attributes['align'] }
                                : {}
                    }
                }
            }
        ];
    },

    addCommands() {
        return {
            setBlockAlign:
                (align) =>
                ({ state, tr, dispatch }) => {
                    const value = align === BLOCK_ALIGN.Left ? null : align;
                    const { from, to } = state.selection;
                    let touched = false;
                    state.doc.nodesBetween(from, to, (node, pos) => {
                        if (
                            !(ALIGNABLE_TYPES as readonly string[]).includes(
                                node.type.name
                            )
                        ) {
                            return;
                        }
                        tr.setNodeAttribute(pos, 'align', value);
                        touched = true;
                    });
                    if (touched && dispatch) dispatch(tr);
                    return touched;
                }
        };
    }
});
