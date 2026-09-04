import type { Editor } from '@tiptap/react';
import { vi } from 'vitest';
import { useLiveEditorState } from '.';

/**
 * `useEditorState`, reduced to the one thing this wrapper is about: it hands a
 * selector an editor instance and returns whatever comes back. The real hook
 * subscribes and memoizes; neither is what the guard here is for, and driving a
 * subscription through a fake editor would test the mock.
 */
vi.mock('@tiptap/react', () => ({
    useEditorState: <T>({
        editor,
        selector
    }: {
        editor: unknown;
        selector: (props: { editor: unknown }) => T;
    }) => selector({ editor })
}));

/**
 * The StrictMode hazard, made cheap to assert.
 *
 * Under `StrictMode` every `useEditor` mounts, tears down and remounts, and the
 * first instance's subscription fires one last selector run **after**
 * `destroy()`. A destroyed editor has no view and no extension storage, so the
 * ordinary reads a toolbar does — `can().undo()`,
 * `storage.characterCount.words()` — throw *during render*, React unwinds the
 * editor subtree, and the toolbar simply disappears. A browser test sees a
 * missing toolbar; only this sees why.
 */
describe('useLiveEditorState', () => {
    it('never touches a destroyed editor [wysiwyg:I-30]', () => {
        const read = vi.fn(() => 'read the dead editor');
        const destroyed = { isDestroyed: true } as unknown as Editor;

        expect(useLiveEditorState(destroyed, read, 'nothing is possible')).toBe(
            'nothing is possible'
        );
        // The value alone would not settle it: a `read` that happened to
        // survive one frame would return the same string on a later refactor.
        // What must hold is that the selector does not run at all.
        expect(read).not.toHaveBeenCalled();
    });

    it('reads the live editor when there is one', () => {
        const live = {
            isDestroyed: false,
            words: 12
        } as unknown as Editor & { words: number };

        expect(
            useLiveEditorState(
                live,
                (editor) => (editor as typeof live).words,
                0
            )
        ).toBe(12);
    });

    it('reports whatever the caller says a gone editor looks like', () => {
        // `whenGone` is per control — "not active" for a toggle, `false` for a
        // `can()`, `0` for a count — so it is passed through rather than being
        // one shared falsy value.
        const destroyed = { isDestroyed: true } as unknown as Editor;
        const gone = { bold: false, canUndo: false };

        expect(useLiveEditorState(destroyed, () => ({ ...gone }), gone)).toBe(
            gone
        );
    });
});
