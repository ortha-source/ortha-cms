import { createContext, useContext, type ReactNode } from 'react';
import type { BlockPath, BlockSchema } from '@ortha-cms/wysiwyg-core';
import type { BlockViewRegistry } from '../../blocks/blockRegistry';
import type { BlockCommands } from '../useBlockCommands';
import type { FocusRequest } from '../useEditorDocument';

/** The slash menu's state while it is open. */
export interface SlashState {
    /** The block the `/` was typed in. */
    readonly path: BlockPath;
    /** What has been typed after the `/`. */
    readonly query: string;
    /** Viewport rect of the caret — where the menu is anchored. */
    readonly rect: DOMRect;
}

/** Everything a block renderer needs, without threading props through the tree. */
export interface EditorContextValue {
    readonly schema: BlockSchema;
    /** The renderer for each block type — the admin half of the schema. */
    readonly views: BlockViewRegistry;
    readonly commands: BlockCommands;
    /** No editing chrome, no contenteditable — the read-only rendering. */
    readonly readOnly: boolean;
    readonly focusRequest: FocusRequest | null;
    /** Opens/moves the slash menu, or closes it when `state` is `null`. */
    setSlash(state: SlashState | null): void;
    /**
     * Gives the open overlays first refusal on a key press. Returns `true` when
     * one of them consumed it — the slash menu owns ↑/↓/Enter/Escape while it
     * is open, and the editable must not also act on them.
     */
    handleOverlayKey(event: React.KeyboardEvent<HTMLElement>): boolean;
    /** Re-reads the selection so the floating toolbar can follow it. */
    refreshToolbar(): void;
    /** Opens the link editor over the current selection (⌘K). */
    openLinkEditor(): void;
    /**
     * Publishes an editable's DOM node under its path key. The slash menu needs
     * it: applying a command has to remove the `/query` the author typed and
     * commit what is left in **one** step, which means reading the live element
     * rather than the model the `/` is still sitting in.
     */
    registerEditable(key: string, element: HTMLElement | null): void;
    /** The registered editable for a path key, if it is mounted. */
    editableFor(key: string): HTMLElement | null;
    undo(): void;
    redo(): void;
}

const EditorContext = createContext<EditorContextValue | null>(null);

/**
 * The editor's context. Deliberately one context rather than a prop chain:
 * blocks nest arbitrarily (a to-do inside a column inside a toggle), so the
 * depth a renderer sits at is not known to whoever wrote it.
 */
export function EditorProvider({
    value,
    children
}: {
    value: EditorContextValue;
    children: ReactNode;
}) {
    return (
        <EditorContext.Provider value={value}>{children}</EditorContext.Provider>
    );
}

/** The editor context. Throws outside an editor — always a wiring mistake. */
export function useEditor(): EditorContextValue {
    const context = useContext(EditorContext);
    if (!context) {
        throw new Error('useEditor must be used inside a <WysiwygEditor>.');
    }
    return context;
}
