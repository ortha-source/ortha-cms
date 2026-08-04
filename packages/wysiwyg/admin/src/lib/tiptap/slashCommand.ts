import { Extension, type Editor } from '@tiptap/core';
import { Plugin, PluginKey, type EditorState } from '@tiptap/pm/state';
import type { BlockTypeItem } from './blockTypes';

/** Where the `/` is on screen, in viewport coordinates. */
export interface SlashRect {
    readonly left: number;
    readonly top: number;
    readonly bottom: number;
}

/** What the slash palette needs to draw itself. */
export interface SlashMenuState {
    /** The catalogue, narrowed to the query. */
    readonly items: readonly BlockTypeItem[];
    /** Which row is highlighted — moved by the arrows, not by the pointer. */
    readonly index: number;
    /** The query typed after the `/`, for the empty state. */
    readonly query: string;
    /** Where the `/` is on screen, in viewport coordinates. */
    readonly rect: SlashRect;
    /** Applies an item and removes the `/query` that summoned it. */
    choose(item: BlockTypeItem): void;
}

export interface SlashCommandOptions {
    /** Narrows the catalogue to a query. */
    items(query: string): BlockTypeItem[];
    /** Publishes the palette's state, or `null` when it closes. */
    onStateChange(state: SlashMenuState | null): void;
}

/** What the extension remembers between keystrokes. */
export interface SlashCommandStorage {
    /** Position of the `/` that opened the palette, or `-1` when it is shut. */
    from: number;
    /** The catalogue as last narrowed. */
    items: BlockTypeItem[];
    /** The highlighted row. */
    index: number;
    /** The query as last read, for the empty state. */
    query: string;
}

/**
 * The trigger: a `/` at a word boundary, and whatever has been typed after it.
 *
 * Anchored to the end of the text before the caret, so it tracks the query as
 * it is typed and backspaced over without any state of its own. The boundary is
 * what keeps a path out of it — `docs/blocks` is not a command. Spaces are
 * allowed inside the query because block names have them ("to-do list"), and
 * the length cap is what stops a whole abandoned sentence from being treated as
 * one very long query.
 */
const SLASH = /(?:^|[\s ])\/([\p{L}\p{N} ]{0,24})$/u;

const slashKey = new PluginKey('wysiwygSlash');

/** The `/query` under the caret, if there is one. */
function matchAt(state: EditorState): { query: string; from: number } | null {
    const { $from, empty } = state.selection;
    if (!empty) return null;
    // Not in a code block, where `/` is a character like any other.
    if ($from.parent.type.spec.code) return null;

    // One placeholder character per inline leaf, so an offset into this string
    // is an offset into the block.
    const before = $from.parent.textBetween(
        0,
        $from.parentOffset,
        undefined,
        '￼'
    );
    const match = SLASH.exec(before);
    if (!match) return null;
    const query = match[1] ?? '';
    return { query, from: $from.pos - query.length - 1 };
}

/**
 * The `/` command palette.
 *
 * Hand-rolled rather than built on `@tiptap/suggestion`, which is the obvious
 * thing to reach for and did not survive contact: its render lifecycle
 * publishes props whose `items` are resolved *after* the fact, and then exits
 * while the author is still typing — the palette opened onto an empty list and
 * closed again on the next keystroke.
 *
 * What is left is smaller than the plugin was: notice the trigger, track the
 * query as it narrows, know where the `/` is on screen, and — the part worth
 * being careful about — **remove the `/query` before the block type is
 * applied**, against the live selection, so the type command lands on a
 * document that no longer contains the trigger text.
 *
 * Two placements are deliberate.
 *
 * **The state is published from `onTransaction`, not from a ProseMirror plugin
 * view.** Plugin views are destroyed and rebuilt whenever *anything*
 * reconfigures the plugin set, and the drag handle re-registers its own plugin
 * on every React render — so a view that closed the palette in `destroy` closed
 * it on every keystroke, one render after opening it. The extension hook has no
 * such lifecycle, and it runs after the view has updated, which `coordsAtPos`
 * needs. Only the key handling stays in a plugin, where the plugin *object* is
 * stable even when its view is not.
 *
 * **The highlighted index lives in the extension's storage**, not in React
 * state, because the arrow keys have to move it *before* the next keystroke is
 * handled — a render behind is a palette that inserts the row above the one the
 * author was looking at.
 */
export const SlashCommand = Extension.create<
    SlashCommandOptions,
    SlashCommandStorage
>({
    name: 'slashCommand',

    addOptions() {
        return {
            items: () => [],
            onStateChange: () => undefined
        };
    },

    addStorage() {
        return { from: -1, items: [], index: 0, query: '' };
    },

    onTransaction() {
        publish(this.editor, this.storage, this.options);
    },

    onDestroy() {
        close(this.storage, this.options);
    },

    addProseMirrorPlugins() {
        // The three are stable for the life of the extension — `storage` is one
        // object that is mutated, never replaced — so the handler below reads
        // live state without holding on to the extension itself.
        const { editor, storage, options } = this;

        return [
            new Plugin({
                key: slashKey,
                props: {
                    handleKeyDown: (_view, event) => {
                        if (storage.from < 0) return false;
                        const { items, index } = storage;
                        switch (event.key) {
                            case 'ArrowDown':
                                event.preventDefault();
                                move(editor, storage, options, 1);
                                return true;
                            case 'ArrowUp':
                                event.preventDefault();
                                move(editor, storage, options, -1);
                                return true;
                            case 'Enter':
                                // A *shifted* Enter is a soft break, not a
                                // choice, and has to reach the block. The old
                                // palette claimed it without looking, so a line
                                // break inserted whatever happened to be
                                // highlighted.
                                if (event.shiftKey) {
                                    close(storage, options);
                                    return false;
                                }
                                if (items.length === 0) return false;
                                event.preventDefault();
                                apply(editor, storage, options, items[index]);
                                return true;
                            case 'Tab':
                                if (items.length === 0) return false;
                                event.preventDefault();
                                apply(editor, storage, options, items[index]);
                                return true;
                            case 'Escape':
                                close(storage, options);
                                return true;
                            default:
                                return false;
                        }
                    }
                }
            })
        ];
    }
});

/** Shuts the palette, if it is open. */
function close(storage: SlashCommandStorage, options: SlashCommandOptions) {
    if (storage.from < 0) return;
    storage.from = -1;
    storage.items = [];
    storage.index = 0;
    storage.query = '';
    options.onStateChange(null);
}

/** Reads the document and publishes what the palette should show. */
function publish(
    editor: Editor,
    storage: SlashCommandStorage,
    options: SlashCommandOptions
) {
    if (editor.isDestroyed) return;
    const match = matchAt(editor.state);
    if (!match) {
        close(storage, options);
        return;
    }
    const items = options.items(match.query);
    // Clamped rather than kept, and only while the same `/` is in play: an
    // index into a list that just got shorter is nothing.
    storage.index =
        match.from === storage.from
            ? Math.min(storage.index, Math.max(items.length - 1, 0))
            : 0;
    storage.from = match.from;
    storage.items = items;
    storage.query = match.query;
    emit(editor, storage, options);
}

/** Moves the highlight, without re-reading the query. */
function move(
    editor: Editor,
    storage: SlashCommandStorage,
    options: SlashCommandOptions,
    by: number
) {
    const count = storage.items.length;
    if (count === 0) return;
    storage.index = (storage.index + by + count) % count;
    emit(editor, storage, options);
}

/** Applies an item, taking the `/query` that summoned it with it. */
function apply(
    editor: Editor,
    storage: SlashCommandStorage,
    options: SlashCommandOptions,
    item: BlockTypeItem | undefined
) {
    const from = storage.from;
    if (!item || from < 0) return;
    close(storage, options);
    editor
        .chain()
        .focus()
        .deleteRange({ from, to: editor.state.selection.from })
        .run();
    item.apply(editor);
}

/** Publishes the current storage, against the trigger's screen position. */
function emit(
    editor: Editor,
    storage: SlashCommandStorage,
    options: SlashCommandOptions
) {
    const coords = editor.view.coordsAtPos(storage.from);
    options.onStateChange({
        items: storage.items,
        index: storage.index,
        query: storage.query,
        rect: { left: coords.left, top: coords.top, bottom: coords.bottom },
        choose: (item) => apply(editor, storage, options, item)
    });
}
