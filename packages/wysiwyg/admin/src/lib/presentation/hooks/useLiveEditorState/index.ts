import type { Editor } from '@tiptap/react';
import { useEditorState } from '@tiptap/react';

/**
 * `useEditorState`, but safe against a **destroyed** editor.
 *
 * The admin renders under React `StrictMode`, so every `useEditor` mounts,
 * tears down, and remounts. The first instance's subscription still fires one
 * last time after `destroy()` — and a destroyed editor has no view and no
 * extension storage, so the ordinary reads a toolbar does (`can().undo()`,
 * `storage.characterCount.words()`) throw `Cannot read properties of null`
 * *during render*. React then unwinds the whole editor subtree, and the toolbar
 * the author was reaching for is simply gone.
 *
 * Every selector in this package goes through here, so the hazard is handled in
 * one place rather than remembered in nine. `whenGone` is what the control shows
 * for that one dead frame — always "nothing is active, nothing is possible",
 * which is the truth about an editor that no longer exists.
 */
export function useLiveEditorState<T>(
    editor: Editor,
    /** Read the slice this control needs from a live editor. */
    read: (editor: Editor) => T,
    /** What to report while the editor is gone. */
    whenGone: T
): T {
    return useEditorState({
        editor,
        selector: ({ editor: instance }) =>
            instance.isDestroyed ? whenGone : read(instance)
    });
}
