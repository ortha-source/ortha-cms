/**
 * Pure tree operations over a block list — every structural edit the editor
 * performs (insert, replace, remove, move, indent) is one of these.
 *
 * All of them are **immutable**: they return a new array and share every
 * untouched subtree, so React re-renders only the branch that actually changed
 * and the undo history can keep snapshots without copying the document.
 *
 * A block is addressed by a {@link BlockPath} — the index at each depth. Ids are
 * for lookup (`pathOfBlock`); paths are for editing, because an insert has to
 * name a slot that has no block in it yet.
 */

import type { BlockPath, WysiwygBlock } from './types';

/** A block paired with where it sits — what `flattenBlocks` yields. */
export interface BlockEntry {
    readonly block: WysiwygBlock;
    readonly path: BlockPath;
}

/** The block at `path`, or `null` when the path doesn't resolve. */
export function blockAt(
    blocks: readonly WysiwygBlock[],
    path: BlockPath
): WysiwygBlock | null {
    if (path.length === 0) return null;
    const [index, ...rest] = path;
    const block = blocks[index];
    if (!block) return null;
    return rest.length === 0 ? block : blockAt(block.children, rest);
}

/**
 * Replaces the block at `path` with whatever `updater` returns. Returning
 * `null` removes it — the one primitive both "edit a block" and "delete a
 * block" are expressed with, so the recursion lives in one place.
 */
export function updateAt(
    blocks: readonly WysiwygBlock[],
    path: BlockPath,
    updater: (block: WysiwygBlock) => WysiwygBlock | null
): readonly WysiwygBlock[] {
    if (path.length === 0) return blocks;
    const [index, ...rest] = path;
    const current = blocks[index];
    if (!current) return blocks;

    const next =
        rest.length === 0
            ? updater(current)
            : {
                  ...current,
                  children: updateAt(current.children, rest, updater)
              };

    const copy = blocks.slice();
    if (next === null) copy.splice(index, 1);
    else copy[index] = next;
    return copy;
}

/** Removes the block at `path`. */
export function removeAt(
    blocks: readonly WysiwygBlock[],
    path: BlockPath
): readonly WysiwygBlock[] {
    return updateAt(blocks, path, () => null);
}

/**
 * Inserts `inserted` at `path` — the path names the **slot**, so `[1]` puts
 * them before the block currently at index 1, and an index past the end
 * appends.
 */
export function insertAt(
    blocks: readonly WysiwygBlock[],
    path: BlockPath,
    inserted: readonly WysiwygBlock[]
): readonly WysiwygBlock[] {
    if (path.length === 0 || inserted.length === 0) return blocks;
    const [index, ...rest] = path;

    if (rest.length === 0) {
        const copy = blocks.slice();
        copy.splice(
            Math.max(0, Math.min(index, blocks.length)),
            0,
            ...inserted
        );
        return copy;
    }

    const parent = blocks[index];
    if (!parent) return blocks;
    const copy = blocks.slice();
    copy[index] = {
        ...parent,
        children: insertAt(parent.children, rest, inserted)
    };
    return copy;
}

/** Replaces the block at `path` with one or more blocks (an Enter split). */
export function replaceAt(
    blocks: readonly WysiwygBlock[],
    path: BlockPath,
    replacement: readonly WysiwygBlock[]
): readonly WysiwygBlock[] {
    const removed = removeAt(blocks, path);
    return insertAt(removed, path, replacement);
}

/**
 * Moves the block at `from` into the slot `to` **as computed before the
 * removal** — the caller describes the drop the way the user sees it, and the
 * index shift that a same-parent downward move causes is corrected here rather
 * than at every drag/keyboard call site.
 *
 * Moving a block into its own subtree is refused (it would detach the tree),
 * which is exactly the drag a drop indicator inside the dragged block would
 * otherwise allow.
 */
export function moveBlock(
    blocks: readonly WysiwygBlock[],
    from: BlockPath,
    to: BlockPath
): readonly WysiwygBlock[] {
    const moved = blockAt(blocks, from);
    if (!moved || to.length === 0) return blocks;
    if (isSamePath(from, to) || isDescendantPath(to, from)) return blocks;

    const target = shiftAfterRemoval(from, to);
    return insertAt(removeAt(blocks, from), target, [moved]);
}

/** Whether two paths address the same block. */
export function isSamePath(a: BlockPath, b: BlockPath): boolean {
    return a.length === b.length && a.every((index, i) => index === b[i]);
}

/** Whether `path` sits inside the subtree rooted at `ancestor`. */
export function isDescendantPath(
    path: BlockPath,
    ancestor: BlockPath
): boolean {
    if (path.length <= ancestor.length) return false;
    return ancestor.every((index, i) => index === path[i]);
}

/**
 * The insertion slot `to` becomes once the block at `from` has been removed.
 * Only a slot **after** `from` under the same parent shifts, and only by one.
 */
function shiftAfterRemoval(from: BlockPath, to: BlockPath): BlockPath {
    const depth = from.length - 1;
    const sameParent =
        to.length === from.length &&
        from.slice(0, depth).every((index, i) => index === to[i]);
    if (!sameParent) return to;
    const target = to.slice();
    if (target[depth] > from[depth]) target[depth] -= 1;
    return target;
}

/** Every block in document (depth-first, pre-order) order, with its path. */
export function flattenBlocks(
    blocks: readonly WysiwygBlock[],
    prefix: BlockPath = []
): BlockEntry[] {
    const entries: BlockEntry[] = [];
    blocks.forEach((block, index) => {
        const path = [...prefix, index];
        entries.push({ block, path });
        if (block.children.length > 0) {
            entries.push(...flattenBlocks(block.children, path));
        }
    });
    return entries;
}

/** The path of the block with `id`, or `null` when it isn't in the tree. */
export function pathOfBlock(
    blocks: readonly WysiwygBlock[],
    id: string
): BlockPath | null {
    return (
        flattenBlocks(blocks).find((entry) => entry.block.id === id)?.path ??
        null
    );
}

/** The path of the block sitting after `path` in document order. */
export function nextPath(
    blocks: readonly WysiwygBlock[],
    path: BlockPath
): BlockPath | null {
    return neighbourPath(blocks, path, 1);
}

/** The path of the block sitting before `path` in document order. */
export function previousPath(
    blocks: readonly WysiwygBlock[],
    path: BlockPath
): BlockPath | null {
    return neighbourPath(blocks, path, -1);
}

/** Shared walk for {@link nextPath}/{@link previousPath}. */
function neighbourPath(
    blocks: readonly WysiwygBlock[],
    path: BlockPath,
    step: 1 | -1
): BlockPath | null {
    const entries = flattenBlocks(blocks);
    const index = entries.findIndex((entry) => isSamePath(entry.path, path));
    if (index === -1) return null;
    return entries[index + step]?.path ?? null;
}

/** The path of the block's parent, or `null` for a top-level block. */
export function parentPath(path: BlockPath): BlockPath | null {
    return path.length > 1 ? path.slice(0, -1) : null;
}

/** The path immediately after `path` under the same parent (an insert slot). */
export function pathAfter(path: BlockPath): BlockPath {
    const next = path.slice();
    next[next.length - 1] += 1;
    return next;
}

/**
 * The contiguous run of blocks a **selection** between two paths covers.
 *
 * Selections are expressed as whole siblings under one parent. Two paths at
 * different depths (a top-level paragraph and a list item nested three levels
 * down) resolve at their **common ancestor**, so the selection covers whole
 * subtrees rather than a ragged edge cutting across nesting — there is no
 * sensible "half a list" to delete or duplicate. A path that is an ancestor of
 * the other already contains it, so the range is just that one block.
 */
export function blockRangeBetween(a: BlockPath, b: BlockPath): BlockPath[] {
    let depth = 0;
    while (depth < a.length && depth < b.length && a[depth] === b[depth]) {
        depth += 1;
    }
    // One path contains the other: selecting the ancestor selects the lot.
    if (depth === a.length) return [[...a]];
    if (depth === b.length) return [[...b]];

    const prefix = a.slice(0, depth);
    const from = Math.min(a[depth], b[depth]);
    const to = Math.max(a[depth], b[depth]);
    const range: BlockPath[] = [];
    for (let index = from; index <= to; index += 1) {
        range.push([...prefix, index]);
    }
    return range;
}
