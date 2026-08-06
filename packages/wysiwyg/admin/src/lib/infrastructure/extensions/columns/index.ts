/**
 * The **columns** nodes — a side-by-side layout block. A `columnBlock` holds
 * two to four `column`s, each of which holds ordinary blocks.
 *
 * Serialized as `<div data-columns="3"><div data-column>…</div>…</div>`:
 * structure in the markup, presentation (the grid) in CSS, so the stored
 * content stays portable to whatever renders it.
 */

import { Node, mergeAttributes } from '@tiptap/core';
import {
    Fragment,
    type Node as ProseMirrorNode,
    type ResolvedPos
} from '@tiptap/pm/model';
import { MAX_COLUMNS, MIN_COLUMNS } from '../../../domain/constants';

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        columns: {
            /**
             * Lay the content out in `count` columns: inserts a fresh column
             * block, or reshapes the one the selection is already inside
             * (growing appends empty columns; shrinking folds the dropped
             * columns' blocks into the last kept one, so nothing is lost).
             */
            setColumns: (count: number) => ReturnType;
            /** Unwrap the surrounding column block, keeping every block inside it. */
            unsetColumns: () => ReturnType;
        };
    }
}

/** The name of the container node, referenced by both node definitions. */
const COLUMN_BLOCK = 'columnBlock';

/** The name of one column. */
const COLUMN = 'column';

/**
 * `count`, clamped to the layouts the block actually supports. Falls back to the
 * minimum for anything unusable — `parseHTML` reads this off stored markup, and
 * a `data-columns="wide"` written by hand would otherwise clamp to `NaN` and
 * take the grid's `grid-template-columns` with it.
 */
function clampCount(count: number): number {
    if (!Number.isFinite(count)) return MIN_COLUMNS;
    return Math.min(MAX_COLUMNS, Math.max(MIN_COLUMNS, Math.round(count)));
}

/** The nearest ancestor column block of `$pos`, with its document position. */
function findColumnBlock(
    $pos: ResolvedPos
): { node: ProseMirrorNode; pos: number } | null {
    for (let depth = $pos.depth; depth > 0; depth -= 1) {
        const node = $pos.node(depth);
        if (node.type.name === COLUMN_BLOCK) {
            return { node, pos: $pos.before(depth) };
        }
    }
    return null;
}

/** Every direct child of `node`, as an array. */
function childrenOf(node: ProseMirrorNode): ProseMirrorNode[] {
    const children: ProseMirrorNode[] = [];
    node.forEach((child) => children.push(child));
    return children;
}

/**
 * One column, an ordinary block container. `isolating` so editing (and
 * backspacing) inside one column can never reach across into its neighbour —
 * without it, a Backspace at the start of a column merges it into the previous
 * column's last paragraph and the layout quietly falls apart.
 */
export const Column = Node.create({
    name: COLUMN,

    content: 'block+',

    isolating: true,

    parseHTML() {
        return [{ tag: 'div[data-column]' }];
    },

    renderHTML({ HTMLAttributes }) {
        return [
            'div',
            mergeAttributes(HTMLAttributes, { 'data-column': '' }),
            0
        ];
    }
});

/** The columns container. Only ever holds {@link Column}s. */
export const ColumnBlock = Node.create({
    name: COLUMN_BLOCK,

    group: 'block',

    content: `${COLUMN}{${MIN_COLUMNS},${MAX_COLUMNS}}`,

    // The block is a unit: a selection that spans it selects the whole layout
    // rather than clipping half of it into a copy.
    defining: true,
    isolating: true,

    addAttributes() {
        return {
            count: {
                default: MIN_COLUMNS,
                parseHTML: (element) =>
                    clampCount(Number(element.getAttribute('data-columns'))),
                renderHTML: (attributes) => ({
                    'data-columns': attributes['count']
                })
            }
        };
    },

    parseHTML() {
        return [{ tag: 'div[data-columns]' }];
    },

    renderHTML({ HTMLAttributes }) {
        return ['div', mergeAttributes(HTMLAttributes), 0];
    },

    addCommands() {
        return {
            setColumns:
                (requested) =>
                ({ state, tr, dispatch, commands }) => {
                    const count = clampCount(requested);
                    const found = findColumnBlock(state.selection.$from);

                    // Not in a layout yet — drop a fresh one in, each column
                    // seeded with an empty paragraph so there is somewhere to
                    // type. `content: 'column{2,4}'` rejects an empty block.
                    if (!found) {
                        return commands.insertContent({
                            type: COLUMN_BLOCK,
                            attrs: { count },
                            content: Array.from({ length: count }, () => ({
                                type: COLUMN,
                                content: [{ type: 'paragraph' }]
                            }))
                        });
                    }

                    const { node, pos } = found;
                    const columns = childrenOf(node);
                    if (
                        columns.length === count &&
                        node.attrs['count'] === count
                    )
                        return true;

                    const columnType = state.schema.nodes[COLUMN];
                    const paragraph = state.schema.nodes['paragraph'];
                    let next: ProseMirrorNode[];

                    if (columns.length < count) {
                        const added = Array.from(
                            { length: count - columns.length },
                            () =>
                                columnType.create(
                                    null,
                                    Fragment.from(paragraph.create())
                                )
                        );
                        next = [...columns, ...added];
                    } else {
                        // Shrinking must not delete what the author wrote: the
                        // dropped columns' blocks move into the last kept one.
                        const kept = columns.slice(0, count);
                        const folded = columns
                            .slice(count)
                            .flatMap((column) => childrenOf(column));
                        const last = kept[count - 1];
                        kept[count - 1] = last.type.create(
                            last.attrs,
                            Fragment.fromArray([...childrenOf(last), ...folded])
                        );
                        next = kept;
                    }

                    if (dispatch) {
                        tr.replaceWith(
                            pos,
                            pos + node.nodeSize,
                            node.type.create(
                                { ...node.attrs, count },
                                Fragment.fromArray(next)
                            )
                        );
                    }
                    return true;
                },

            unsetColumns:
                () =>
                ({ state, tr, dispatch }) => {
                    const found = findColumnBlock(state.selection.$from);
                    if (!found) return false;
                    const { node, pos } = found;
                    // Flatten: every column's blocks, in reading order, take
                    // the block's place. `lift` can't do this — it would have
                    // to unwrap two levels and only handles a single ancestor.
                    const blocks = childrenOf(node).flatMap((column) =>
                        childrenOf(column)
                    );
                    if (dispatch) {
                        tr.replaceWith(
                            pos,
                            pos + node.nodeSize,
                            Fragment.fromArray(blocks)
                        );
                    }
                    return true;
                }
        };
    }
});
