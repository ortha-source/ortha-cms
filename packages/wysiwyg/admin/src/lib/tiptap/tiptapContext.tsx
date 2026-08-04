import { createContext, useContext, type ReactNode } from 'react';
import type { Editor } from '@tiptap/react';
import type { WysiwygMediaPort } from '../media/wysiwygMedia';

/** What every control inside the editor needs to reach. */
export interface TiptapContextValue {
    /** The live editor. `null` only before the first render settles. */
    editor: Editor | null;
    /** Rendering without any editing affordances. */
    readOnly: boolean;
    /** The host's media library, when it offered one. */
    media: WysiwygMediaPort | null;
}

const TiptapContext = createContext<TiptapContextValue | null>(null);

/**
 * The editor, shared down the tree.
 *
 * Deliberately thin — three fields, no command set. The old editor needed a
 * hand-built `BlockCommands` bag because the behaviour lived in it; here the
 * behaviour lives in the schema, and a control reaches for
 * `editor.chain().focus()…` directly. There is nothing left to keep in sync.
 */
export function TiptapProvider({
    value,
    children
}: {
    value: TiptapContextValue;
    children: ReactNode;
}) {
    return (
        <TiptapContext.Provider value={value}>
            {children}
        </TiptapContext.Provider>
    );
}

/** The editor context. Throws outside the editor, which is always a bug. */
export function useWysiwyg(): TiptapContextValue {
    const value = useContext(TiptapContext);
    if (!value) {
        throw new Error('useWysiwyg must be used inside the editor');
    }
    return value;
}
