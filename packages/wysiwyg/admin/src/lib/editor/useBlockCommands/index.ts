import { useMemo } from 'react';
import {
    BLOCK_ALIGN,
    BLOCK_TYPE,
    PARAGRAPH_TYPE,
    toggleBlockMark,
    type InlineMarkTag,
    blockAt,
    createBlock,
    createTable,
    createTableCell,
    createTableRow,
    isHeaderRow,
    escapeHtmlText,
    htmlToPlainText,
    insertAt,
    isEmptyHtml,
    moveBlock,
    nextPath,
    parentPath,
    pathAfter,
    previousPath,
    removeAt,
    replaceAt,
    serializeBlocks,
    updateAt,
    type BlockAlign,
    type BlockAttrs,
    type BlockPath,
    type BlockSchema,
    type WysiwygBlock
} from '@ortha-cms/wysiwyg-core';
import {
    getBlockClipboard,
    setBlockClipboard
} from '../../blocks/blockClipboard';
import {
    CARET,
    INSERT_POSITION,
    type InsertPosition
} from '../../utils/constants';
import { HISTORY, type EditorDocument } from '../useEditorDocument';

/**
 * Every structural edit the editor can make, expressed over **paths** rather
 * than the DOM.
 *
 * This is where the editor's behavior actually lives — what Enter does at the
 * end of a list item, what Backspace does at the start of a heading, what Tab
 * does to a bullet. Keeping it here (pure functions over the block tree, with
 * the focus request as the only side effect) is what lets the block renderers
 * stay presentational and the whole set be reasoned about without a browser.
 *
 * **One command per user action.** Each command is built from the block list
 * this hook closed over, so calling two in the same event handler would compute
 * the second from a tree the first has already replaced — the second silently
 * wins and the first edit disappears. Anything that looks like two steps
 * (convert *and* keep the leftover text) is therefore one command here.
 */
export interface BlockCommands {
    /** Replaces a block's inline HTML. Coalesced in history — this is typing. */
    setHtml(path: BlockPath, html: string): void;
    /**
     * Replaces a block's inline HTML as a **discrete** edit, not as typing.
     *
     * The counterpart to {@link setHtml}: that one coalesces into the last
     * keystroke, which is right for keystrokes and wrong for a formatting
     * command — applying a colour and then undoing should take back the colour,
     * not the sentence it was applied to.
     */
    replaceHtml(path: BlockPath, html: string): void;
    /** Merges `attrs` into a block (a heading level, a callout tone). */
    setAttrs(path: BlockPath, attrs: BlockAttrs): void;
    /** Converts a block to another type, applying that type's defaults. */
    setType(path: BlockPath, type: string, attrs?: BlockAttrs): void;
    /**
     * Applies a block type chosen from the slash menu or matched by a markdown
     * input rule, given the HTML **left in the block** once the trigger text was
     * removed. Converts the block in place when nothing else is in it, and
     * inserts a new block below when there is.
     */
    applyBlockType(
        path: BlockPath,
        type: string,
        attrs: BlockAttrs | undefined,
        remainingHtml: string
    ): void;
    /** Splits a block at the caret — the Enter key. */
    split(path: BlockPath, before: string, after: string): void;
    /** Backspace at the start of a block. */
    mergeBackward(path: BlockPath): void;
    /** Delete at the end of a block. */
    mergeForward(path: BlockPath): void;
    /** Inserts blocks directly after `path` and focuses the first. */
    insertAfter(path: BlockPath, blocks: readonly WysiwygBlock[]): void;
    /** Inserts blocks directly before `path` and focuses the first. */
    insertBefore(path: BlockPath, blocks: readonly WysiwygBlock[]): void;
    /** Creates a new block of `type` above or below `path`. */
    insertTypeAt(
        path: BlockPath,
        type: string,
        attrs: BlockAttrs | undefined,
        position: InsertPosition
    ): void;
    /** Puts a block on the block clipboard (and its HTML on the system one). */
    copyBlock(path: BlockPath): void;
    /** Copies a block, then removes it. */
    cutBlock(path: BlockPath): void;
    /** Inserts the clipboard's blocks above or below `path`. */
    pasteBlocks(path: BlockPath, position: InsertPosition): void;
    /** Removes a block (and its subtree). */
    remove(path: BlockPath): void;
    /** Inserts a copy of a block directly below it. */
    duplicate(path: BlockPath): void;
    /** Moves a block to a slot — the drag-and-drop drop. */
    move(from: BlockPath, to: BlockPath): void;
    /** Moves a block one place up (-1) or down (+1) among its siblings. */
    moveBy(path: BlockPath, delta: -1 | 1): void;
    /** Nests a block under the sibling above it — Tab. */
    indent(path: BlockPath): void;
    /** Lifts a block out of its parent — Shift+Tab. */
    outdent(path: BlockPath): void;
    /** Flips a to-do block's checked state. */
    toggleChecked(path: BlockPath): void;
    /** Whether `path` can currently be indented (drives the Tab key). */
    canIndent(path: BlockPath): boolean;
    /** Moves the caret to the nearest editable block above (-1) or below (+1). */
    focusNeighbour(path: BlockPath, direction: -1 | 1): void;

    // ── Whole-block selections ───────────────────────────────────────────
    // Each takes every selected path and commits **once**. Looping a
    // single-block command over a selection would compute every step after the
    // first from a tree that no longer exists (see the note above), and paths
    // shift as soon as one block is removed — so these delete bottom-up and
    // build their result in one pass.

    /** Removes every block in the selection. */
    removeMany(paths: readonly BlockPath[]): void;
    /** Copies the selection to the block clipboard (and its HTML to the system one). */
    copyMany(paths: readonly BlockPath[]): void;
    /** Copies the selection, then removes it. */
    cutMany(paths: readonly BlockPath[]): void;
    /** Inserts a copy of the selection after it. */
    duplicateMany(paths: readonly BlockPath[]): void;
    /** Converts every block in the selection to `type`. */
    setTypeMany(
        paths: readonly BlockPath[],
        type: string,
        attrs?: BlockAttrs
    ): void;
    /** Toggles an inline mark across every block in the selection. */
    toggleMarkMany(paths: readonly BlockPath[], tag: InlineMarkTag): void;

    // ── Alignment ────────────────────────────────────────────────────────

    /**
     * Aligns a block. `left` clears the alignment rather than storing one, so a
     * centred-then-uncentred paragraph serializes identically to one that was
     * never touched.
     */
    setAlign(path: BlockPath, align: BlockAlign): void;
    /** Aligns every block in the selection, in one commit. */
    setAlignMany(paths: readonly BlockPath[], align: BlockAlign): void;

    // ── Tables ───────────────────────────────────────────────────────────
    // A table is rows of cells, and every one of these has to keep it a
    // **rectangle** — a column insert touches every row at once, which is one
    // commit, not one per row (see the note above).

    /** Inserts an empty row into a table at `index` (0 … row count). */
    insertTableRow(tablePath: BlockPath, index: number): void;
    /** Removes a table's row. The last remaining row is kept. */
    removeTableRow(tablePath: BlockPath, index: number): void;
    /** Inserts an empty column into a table at `index` (0 … column count). */
    insertTableColumn(tablePath: BlockPath, index: number): void;
    /** Removes a table's column. The last remaining column is kept. */
    removeTableColumn(tablePath: BlockPath, index: number): void;
    /** Turns the table's first row into a header row, or back into a body one. */
    toggleTableHeaderRow(tablePath: BlockPath): void;
    /**
     * Sets attributes on every cell of one **column** — its alignment, its
     * vertical alignment, its width.
     *
     * A column is not a block, so there is nothing to hang the attribute on but
     * the cells; writing it on all of them is also what makes it survive a row
     * being deleted, since no single row owns it. `null` clears an attribute,
     * which is what makes "reset width" the same command as "set width".
     */
    setTableColumnAttrs(
        tablePath: BlockPath,
        index: number,
        attrs: BlockAttrs
    ): void;
    /** The same, for every cell of one **row**. */
    setTableRowAttrs(
        tablePath: BlockPath,
        index: number,
        attrs: BlockAttrs
    ): void;
    /** Sets attributes on every cell of the whole table. */
    setTableCellAttrs(tablePath: BlockPath, attrs: BlockAttrs): void;
    /**
     * Moves the caret one cell along the table — the Tab key. Tabbing off the
     * last cell adds a row, which is how every editor with tables behaves and
     * the only way to type one in without reaching for the mouse.
     */
    focusTableCell(cellPath: BlockPath, delta: -1 | 1): void;
}

/** Builds the command set for a document. */
export function useBlockCommands(
    document: EditorDocument,
    schema: BlockSchema
): BlockCommands {
    const { blocks, commit, requestFocus } = document;

    return useMemo<BlockCommands>(() => {
        /** A new block of `type`, with the children that type can't exist without. */
        const blockOfType = (type: string, attrs?: BlockAttrs): WysiwygBlock =>
            createBlock(type, {
                attrs: {
                    ...(schema.get(type)?.defaultAttrs ?? {}),
                    ...(attrs ?? {})
                },
                children: seedChildren(type)
            });

        const setHtml: BlockCommands['setHtml'] = (path, html) => {
            commit(
                updateAt(blocks, path, (block) => ({ ...block, html })),
                HISTORY.Coalesce
            );
        };

        const replaceHtml: BlockCommands['replaceHtml'] = (path, html) => {
            commit(updateAt(blocks, path, (block) => ({ ...block, html })));
        };

        /** The `align` attribute value to store — `null` clears it. */
        const alignValue = (align: BlockAlign) =>
            align === BLOCK_ALIGN.Left ? null : align;

        const setAlign: BlockCommands['setAlign'] = (path, align) => {
            commit(
                updateAt(blocks, path, (block) => ({
                    ...block,
                    attrs: { ...block.attrs, align: alignValue(align) }
                }))
            );
        };

        const setAlignMany: BlockCommands['setAlignMany'] = (paths, align) => {
            if (paths.length === 0) return;
            let next = blocks;
            for (const path of paths) {
                next = updateAt(next, path, (block) => ({
                    ...block,
                    attrs: { ...block.attrs, align: alignValue(align) }
                }));
            }
            commit(next);
        };

        const setAttrs: BlockCommands['setAttrs'] = (path, attrs) => {
            commit(
                updateAt(blocks, path, (block) => ({
                    ...block,
                    attrs: { ...block.attrs, ...attrs }
                }))
            );
        };

        /** The block `path` becomes when converted to `type`. */
        const converted = (
            block: WysiwygBlock,
            type: string,
            attrs?: BlockAttrs,
            html = block.html
        ): WysiwygBlock => {
            const definition = schema.get(type);
            return {
                ...block,
                type,
                // The old attrs belonged to the old type; carrying them over
                // would leave a heading's `level` on a code block.
                attrs: {
                    ...(definition?.defaultAttrs ?? {}),
                    ...(attrs ?? {})
                },
                html:
                    definition?.content === 'void'
                        ? ''
                        : contentFor(type, html),
                children:
                    block.children.length > 0
                        ? block.children
                        : seedChildren(type)
            };
        };

        const setType: BlockCommands['setType'] = (path, type, attrs) => {
            commit(
                updateAt(blocks, path, (block) => converted(block, type, attrs))
            );
            requestFocus(path, CARET.End);
        };

        const applyBlockType: BlockCommands['applyBlockType'] = (
            path,
            type,
            attrs,
            remainingHtml
        ) => {
            const block = blockAt(blocks, path);
            if (!block) return;
            const definition = schema.get(type);
            const isVoid = definition?.content === 'void';
            const isContainer = definition?.content === 'container';
            const blank = isEmptyHtml(remainingHtml);

            // Nothing else in the block: the block *becomes* the chosen type.
            if (blank && !isVoid) {
                commit(
                    updateAt(blocks, path, (current) =>
                        converted(current, type, attrs, '')
                    )
                );
                requestFocus(isContainer ? [...path, 0, 0] : path, CARET.End);
                return;
            }

            // A void block has nowhere to put a caret, so it always comes with
            // a paragraph after it — otherwise choosing "Divider" as the last
            // block of a document ends the document.
            const created = blockOfType(type, attrs);
            const trailing = createBlock(PARAGRAPH_TYPE);
            if (blank) {
                commit(replaceAt(blocks, path, [created, trailing]));
                requestFocus(pathAfter(path), CARET.Start);
                return;
            }
            commit(
                replaceAt(blocks, path, [
                    { ...block, html: remainingHtml },
                    created,
                    ...(isVoid ? [trailing] : [])
                ])
            );
            const target = pathAfter(path);
            requestFocus(
                isVoid
                    ? pathAfter(target)
                    : isContainer
                      ? [...target, 0, 0]
                      : target,
                CARET.Start
            );
        };

        const outdent: BlockCommands['outdent'] = (path) => {
            const parent = parentPath(path);
            if (!parent) return;
            const block = blockAt(blocks, path);
            if (!block) return;
            const target = pathAfter(parent);
            commit(insertAt(removeAt(blocks, path), target, [block]));
            requestFocus(target, CARET.End);
        };

        const split: BlockCommands['split'] = (path, before, after) => {
            const block = blockAt(blocks, path);
            if (!block) return;
            const definition = schema.get(block.type);

            // Enter on an empty continuing block (an empty bullet) leaves the
            // list rather than adding another empty one — the universal way
            // out. A **nested** one lifts a level at a time first, exactly as
            // Backspace does: converting it in place would leave the author's
            // next paragraph parked inside the bullet they were escaping.
            if (
                definition?.continueOnEnter &&
                before === '' &&
                after === '' &&
                block.children.length === 0
            ) {
                if (path.length > 1) outdent(path);
                else setType(path, PARAGRAPH_TYPE);
                return;
            }

            // A toggle's Enter belongs *inside* it: the summary is one line, and
            // the body is what the author is about to write.
            if (block.type === BLOCK_TYPE.Toggle) {
                commit(
                    updateAt(blocks, path, (current) => ({
                        ...current,
                        html: before,
                        attrs: { ...current.attrs, open: true },
                        children: [
                            createBlock(PARAGRAPH_TYPE, { html: after }),
                            ...current.children
                        ]
                    }))
                );
                requestFocus([...path, 0], CARET.Start);
                return;
            }

            const continues = definition?.continueOnEnter ?? false;
            const tail = createBlock(continues ? block.type : PARAGRAPH_TYPE, {
                html: after,
                // A new to-do starts unchecked however the one above it sits.
                attrs: continues
                    ? {
                          ...block.attrs,
                          ...(block.type === BLOCK_TYPE.Todo
                              ? { checked: false }
                              : {})
                      }
                    : {}
            });
            commit(replaceAt(blocks, path, [{ ...block, html: before }, tail]));
            requestFocus(pathAfter(path), CARET.Start);
        };

        const mergeBackward: BlockCommands['mergeBackward'] = (path) => {
            const block = blockAt(blocks, path);
            if (!block) return;

            // First Backspace strips the block's *type* — a heading becomes a
            // paragraph before it starts eating the block above it. The caret
            // stays at the **start**, so pressing Backspace again merges;
            // `setType` is not reused here because it lands the caret at the
            // end, where a second Backspace would delete a character instead.
            if (block.type !== PARAGRAPH_TYPE) {
                commit(
                    updateAt(blocks, path, (current) =>
                        converted(current, PARAGRAPH_TYPE)
                    )
                );
                requestFocus(path, CARET.Start);
                return;
            }
            // A nested block lifts out before it merges.
            if (path.length > 1) {
                outdent(path);
                return;
            }

            const target = previousPath(blocks, path);
            const previous = target && blockAt(blocks, target);
            if (!target || !previous) return;
            if (schema.get(previous.type)?.content !== 'inline') {
                // Backspacing into a divider (or a layout) deletes it rather
                // than merging text into something that can't hold any.
                commit(removeAt(blocks, target));
                return;
            }
            const seam = htmlToPlainText(previous.html).length;
            const merged = updateAt(blocks, target, (current) => ({
                ...current,
                html: current.html + block.html,
                children: [...current.children, ...block.children]
            }));
            commit(removeAt(merged, path));
            requestFocus(target, seam);
        };

        const mergeForward: BlockCommands['mergeForward'] = (path) => {
            const block = blockAt(blocks, path);
            const targetPath = pathAfter(path);
            const next = blockAt(blocks, targetPath);
            if (!block || !next) return;
            if (schema.get(next.type)?.content !== 'inline') {
                commit(removeAt(blocks, targetPath));
                return;
            }
            const seam = htmlToPlainText(block.html).length;
            const merged = updateAt(blocks, path, (current) => ({
                ...current,
                html: current.html + next.html,
                children: [...current.children, ...next.children]
            }));
            commit(removeAt(merged, targetPath));
            requestFocus(path, seam);
        };

        const insertAfter: BlockCommands['insertAfter'] = (path, inserted) => {
            if (inserted.length === 0) return;
            const target = pathAfter(path);
            commit(insertAt(blocks, target, inserted));
            requestFocus(target, CARET.End);
        };

        const insertBefore: BlockCommands['insertBefore'] = (
            path,
            inserted
        ) => {
            if (inserted.length === 0) return;
            commit(insertAt(blocks, path, inserted));
            requestFocus(path, CARET.End);
        };

        const insertTypeAt: BlockCommands['insertTypeAt'] = (
            path,
            type,
            attrs,
            position
        ) => {
            const created = blockOfType(type, attrs);
            if (position === INSERT_POSITION.Before) {
                insertBefore(path, [created]);
                return;
            }
            insertAfter(path, [created]);
        };

        const copyBlock: BlockCommands['copyBlock'] = (path) => {
            const block = blockAt(blocks, path);
            if (!block) return;
            setBlockClipboard([block]);
            // Also put the HTML on the system clipboard so the block can leave
            // the app. Writing needs no permission; failing is not an error
            // worth surfacing — the in-app paste still works.
            void navigator.clipboard
                ?.writeText(serializeBlocks([block], { schema }))
                .catch(() => undefined);
        };

        const cutBlock: BlockCommands['cutBlock'] = (path) => {
            copyBlock(path);
            remove(path);
        };

        const pasteBlocks: BlockCommands['pasteBlocks'] = (path, position) => {
            const copied = getBlockClipboard();
            if (!copied || copied.length === 0) return;
            // Fresh ids: the same block pasted twice must be two blocks, not
            // one block rendered in two places.
            const fresh = copied.map(cloneBlock);
            if (position === INSERT_POSITION.Before) insertBefore(path, fresh);
            else insertAfter(path, fresh);
        };

        const remove: BlockCommands['remove'] = (path) => {
            const target = previousPath(blocks, path);
            const next = removeAt(blocks, path);
            // An editor with no blocks has nowhere to put the caret.
            commit(next.length === 0 ? [createBlock(PARAGRAPH_TYPE)] : next);
            requestFocus(target ?? [0], CARET.End);
        };

        const duplicate: BlockCommands['duplicate'] = (path) => {
            const block = blockAt(blocks, path);
            if (!block) return;
            commit(insertAt(blocks, pathAfter(path), [cloneBlock(block)]));
        };

        const move: BlockCommands['move'] = (from, to) => {
            commit(moveBlock(blocks, from, to));
        };

        const moveBy: BlockCommands['moveBy'] = (path, delta) => {
            const index = path[path.length - 1];
            const target = [...path.slice(0, -1), index + delta];
            if (index + delta < 0 || !blockAt(blocks, target)) return;
            // A downward move names the slot *after* the sibling it swaps with,
            // because slots are counted before this block is lifted out.
            commit(
                moveBlock(
                    blocks,
                    path,
                    delta === 1 ? [...path.slice(0, -1), index + 2] : target
                )
            );
        };

        const canIndent: BlockCommands['canIndent'] = (path) => {
            const index = path[path.length - 1];
            if (index === 0) return false;
            const sibling = blockAt(blocks, [...path.slice(0, -1), index - 1]);
            return !!sibling && schema.get(sibling.type)?.content !== 'void';
        };

        const indent: BlockCommands['indent'] = (path) => {
            if (!canIndent(path)) return;
            const block = blockAt(blocks, path);
            const index = path[path.length - 1];
            const siblingPath = [...path.slice(0, -1), index - 1];
            const sibling = blockAt(blocks, siblingPath);
            if (!block || !sibling) return;

            const removed = removeAt(blocks, path);
            commit(
                updateAt(removed, siblingPath, (current) => ({
                    ...current,
                    children: [...current.children, block]
                }))
            );
            requestFocus([...siblingPath, sibling.children.length], CARET.End);
        };

        const toggleChecked: BlockCommands['toggleChecked'] = (path) => {
            const block = blockAt(blocks, path);
            if (!block) return;
            setAttrs(path, { checked: block.attrs['checked'] !== true });
        };

        const focusNeighbour: BlockCommands['focusNeighbour'] = (
            path,
            direction
        ) => {
            let candidate =
                direction === -1
                    ? previousPath(blocks, path)
                    : nextPath(blocks, path);
            // Step over anything with no caret to offer (a divider, a layout
            // wrapper) so an arrow key never appears to do nothing.
            while (candidate) {
                const block = blockAt(blocks, candidate);
                if (block && schema.get(block.type)?.content === 'inline') {
                    requestFocus(
                        candidate,
                        direction === -1 ? CARET.End : CARET.Start
                    );
                    return;
                }
                candidate =
                    direction === -1
                        ? previousPath(blocks, candidate)
                        : nextPath(blocks, candidate);
            }
        };

        /** Paths deepest/last first, so removing one can't shift the next. */
        const bottomUp = (paths: readonly BlockPath[]): BlockPath[] =>
            [...paths].sort((a, b) => {
                const depth = Math.max(a.length, b.length);
                for (let index = 0; index < depth; index += 1) {
                    const left = a[index] ?? -1;
                    const right = b[index] ?? -1;
                    if (left !== right) return right - left;
                }
                return 0;
            });

        const removeMany: BlockCommands['removeMany'] = (paths) => {
            if (paths.length === 0) return;
            let next = blocks;
            for (const path of bottomUp(paths)) next = removeAt(next, path);
            commit(next.length === 0 ? [createBlock(PARAGRAPH_TYPE)] : next);
        };

        const copyMany: BlockCommands['copyMany'] = (paths) => {
            const copied = paths
                .map((path) => blockAt(blocks, path))
                .filter((block): block is WysiwygBlock => !!block);
            if (copied.length === 0) return;
            setBlockClipboard(copied);
            void navigator.clipboard
                ?.writeText(serializeBlocks(copied, { schema }))
                .catch(() => undefined);
        };

        const cutMany: BlockCommands['cutMany'] = (paths) => {
            copyMany(paths);
            removeMany(paths);
        };

        const duplicateMany: BlockCommands['duplicateMany'] = (paths) => {
            const copied = paths
                .map((path) => blockAt(blocks, path))
                .filter((block): block is WysiwygBlock => !!block)
                .map(cloneBlock);
            const last = paths[paths.length - 1];
            if (copied.length === 0 || !last) return;
            commit(insertAt(blocks, pathAfter(last), copied));
        };

        const setTypeMany: BlockCommands['setTypeMany'] = (
            paths,
            type,
            attrs
        ) => {
            let next = blocks;
            for (const path of paths) {
                next = updateAt(next, path, (block) =>
                    converted(block, type, attrs)
                );
            }
            commit(next);
        };

        const toggleMarkMany: BlockCommands['toggleMarkMany'] = (
            paths,
            tag
        ) => {
            let next = blocks;
            for (const path of paths) {
                next = updateAt(next, path, (block) => ({
                    ...block,
                    html: toggleBlockMark(block.html, tag)
                }));
            }
            commit(next);
        };

        /** The table at `path`, when there is one. */
        const tableAt = (path: BlockPath): WysiwygBlock | null => {
            const table = blockAt(blocks, path);
            return table?.type === BLOCK_TYPE.Table ? table : null;
        };

        /** A table's column count — every row is the same width by construction. */
        const widthOf = (table: WysiwygBlock): number =>
            table.children[0]?.children.length ?? 0;

        const insertTableRow: BlockCommands['insertTableRow'] = (
            tablePath,
            index
        ) => {
            const table = tableAt(tablePath);
            if (!table) return;
            // Never above the header row: a header that isn't first stops being
            // a `<thead>` on the way out, which is a silent loss of meaning.
            const floor = isHeaderRow(table.children[0]) ? 1 : 0;
            const at = clamp(index, floor, table.children.length);
            const row = createTableRow(widthOf(table));
            commit(
                updateAt(blocks, tablePath, (block) => ({
                    ...block,
                    children: [
                        ...block.children.slice(0, at),
                        row,
                        ...block.children.slice(at)
                    ]
                }))
            );
            requestFocus([...tablePath, at, 0], CARET.End);
        };

        const removeTableRow: BlockCommands['removeTableRow'] = (
            tablePath,
            index
        ) => {
            const table = tableAt(tablePath);
            // A table with no rows has nothing to type in and serializes to
            // nothing — deleting the last row is deleting the table, and that
            // is the block menu's job, not this button's.
            if (!table || table.children.length <= 1) return;
            commit(
                updateAt(blocks, tablePath, (block) => ({
                    ...block,
                    children: block.children.filter((_, at) => at !== index)
                }))
            );
        };

        const insertTableColumn: BlockCommands['insertTableColumn'] = (
            tablePath,
            index
        ) => {
            const table = tableAt(tablePath);
            if (!table) return;
            const at = clamp(index, 0, widthOf(table));
            commit(
                updateAt(blocks, tablePath, (block) => ({
                    ...block,
                    children: block.children.map((row) => ({
                        ...row,
                        children: [
                            ...row.children.slice(0, at),
                            createTableCell(isHeaderRow(row)),
                            ...row.children.slice(at)
                        ]
                    }))
                }))
            );
            requestFocus([...tablePath, 0, at], CARET.End);
        };

        const removeTableColumn: BlockCommands['removeTableColumn'] = (
            tablePath,
            index
        ) => {
            const table = tableAt(tablePath);
            if (!table || widthOf(table) <= 1) return;
            commit(
                updateAt(blocks, tablePath, (block) => ({
                    ...block,
                    children: block.children.map((row) => ({
                        ...row,
                        children: row.children.filter((_, at) => at !== index)
                    }))
                }))
            );
        };

        const toggleTableHeaderRow: BlockCommands['toggleTableHeaderRow'] = (
            tablePath
        ) => {
            const table = tableAt(tablePath);
            if (!table || table.children.length === 0) return;
            const header = !isHeaderRow(table.children[0]);
            commit(
                updateAt(blocks, tablePath, (block) => ({
                    ...block,
                    children: block.children.map((row, at) =>
                        at === 0
                            ? {
                                  ...row,
                                  children: row.children.map((cell) => ({
                                      ...cell,
                                      attrs: { ...cell.attrs, header }
                                  }))
                              }
                            : row
                    )
                }))
            );
        };

        /**
         * Rewrites every cell of a table that `pick` accepts. The one shape all
         * three cell-attribute commands are — they differ only in which cells
         * they answer yes for.
         */
        const mapCells = (
            tablePath: BlockPath,
            attrs: BlockAttrs,
            pick: (row: number, column: number) => boolean
        ) => {
            if (!tableAt(tablePath)) return;
            commit(
                updateAt(blocks, tablePath, (table) => ({
                    ...table,
                    children: table.children.map((row, rowIndex) => ({
                        ...row,
                        children: row.children.map((cell, columnIndex) =>
                            pick(rowIndex, columnIndex)
                                ? {
                                      ...cell,
                                      attrs: { ...cell.attrs, ...attrs }
                                  }
                                : cell
                        )
                    }))
                }))
            );
        };

        const setTableColumnAttrs: BlockCommands['setTableColumnAttrs'] = (
            tablePath,
            index,
            attrs
        ) => mapCells(tablePath, attrs, (_, column) => column === index);

        const setTableRowAttrs: BlockCommands['setTableRowAttrs'] = (
            tablePath,
            index,
            attrs
        ) => mapCells(tablePath, attrs, (row) => row === index);

        const setTableCellAttrs: BlockCommands['setTableCellAttrs'] = (
            tablePath,
            attrs
        ) => mapCells(tablePath, attrs, () => true);

        const focusTableCell: BlockCommands['focusTableCell'] = (
            cellPath,
            delta
        ) => {
            const tablePath = cellPath.slice(0, -2);
            const table = tableAt(tablePath);
            if (!table) return;
            const width = widthOf(table);
            if (width === 0) return;

            let row = cellPath[cellPath.length - 2];
            let column = cellPath[cellPath.length - 1] + delta;
            if (column >= width) {
                row += 1;
                column = 0;
            } else if (column < 0) {
                row -= 1;
                column = width - 1;
            }
            // Shift+Tab out of the first cell has nowhere to go; leaving the
            // caret put beats sending it somewhere the author didn't ask for.
            if (row < 0) return;

            if (row >= table.children.length) {
                commit(
                    updateAt(blocks, tablePath, (block) => ({
                        ...block,
                        children: [...block.children, createTableRow(width)]
                    }))
                );
            }
            requestFocus([...tablePath, row, column], CARET.End);
        };

        return {
            setHtml,
            replaceHtml,
            setAttrs,
            setAlign,
            setAlignMany,
            insertTableRow,
            removeTableRow,
            insertTableColumn,
            removeTableColumn,
            toggleTableHeaderRow,
            setTableColumnAttrs,
            setTableRowAttrs,
            setTableCellAttrs,
            focusTableCell,
            removeMany,
            copyMany,
            cutMany,
            duplicateMany,
            setTypeMany,
            toggleMarkMany,
            setType,
            applyBlockType,
            split,
            mergeBackward,
            mergeForward,
            insertAfter,
            insertBefore,
            insertTypeAt,
            copyBlock,
            cutBlock,
            pasteBlocks,
            remove,
            duplicate,
            move,
            moveBy,
            indent,
            outdent,
            toggleChecked,
            canIndent,
            focusNeighbour
        };
    }, [blocks, commit, requestFocus, schema]);
}

/** A copy of a block and its subtree, with fresh ids. */
function cloneBlock(block: WysiwygBlock): WysiwygBlock {
    return createBlock(block.type, {
        html: block.html,
        attrs: block.attrs,
        children: block.children.map(cloneBlock)
    });
}

/**
 * The children a newly-created block of `type` needs to be usable. A layout
 * with no columns, or a toggle with no body, has nothing to put a caret in.
 */
function seedChildren(type: string): WysiwygBlock[] {
    if (type === BLOCK_TYPE.Columns) return [seedColumn(), seedColumn()];
    if (type === BLOCK_TYPE.Column || type === BLOCK_TYPE.Toggle) {
        return [createBlock(PARAGRAPH_TYPE)];
    }
    // A table starts as a header row and two body rows — small enough to be a
    // starting point and large enough to be recognizably a table.
    if (type === BLOCK_TYPE.Table) return [...createTable().children];
    if (type === BLOCK_TYPE.TableRow) return [createTableCell()];
    return [];
}

/** `value`, held between `min` and `max`. */
function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

/** One seeded column, holding an empty paragraph to type into. */
function seedColumn(): WysiwygBlock {
    return createBlock(BLOCK_TYPE.Column, {
        children: [createBlock(PARAGRAPH_TYPE)]
    });
}

/**
 * The content to carry into a converted block. Everything keeps its formatting
 * except code, whose content is escaped plain text — moving `<strong>` markup
 * into a code block would show the tags as if the author had typed them.
 */
function contentFor(type: string, html: string): string {
    if (type !== BLOCK_TYPE.Code) return html;
    return escapeHtmlText(htmlToPlainText(html));
}
