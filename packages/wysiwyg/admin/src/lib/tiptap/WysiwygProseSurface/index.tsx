import { EditorContent, type Editor } from '@tiptap/react';
import { cn } from '@ortha-cms/design-system';
import { WYSIWYG_PROSE } from '../../render/wysiwygProse';

/**
 * The writing surface — one `contenteditable`, styled by the same
 * `WYSIWYG_PROSE` the rendered document uses.
 *
 * That sharing is new, and it is the point. The old editor styled each block
 * through its own React renderer and the delivered HTML through a stylesheet,
 * so the two could drift and did: a colour showed in one and not the other
 * until the inline half of the prose rules was imported into the editor by
 * hand. With one contenteditable holding the real tags, "what the author sees"
 * and "what a reader sees" are the same rules applied to the same markup.
 *
 * The editor-only affordances (the caret's block outline, the table handles,
 * the placeholder) are layered on top, keyed off attributes ProseMirror sets.
 */
export function WysiwygProseSurface({
    editor,
    toolbar,
    readOnly
}: {
    editor: Editor | null;
    /** Whether the editor owns its parent's height and scrolls under a bar. */
    toolbar: boolean;
    readOnly: boolean;
}) {
    return (
        <div className={cn(toolbar && 'min-h-0 flex-1 overflow-y-auto')}>
            {/* The left padding is the gutter's lane — the add and drag
                controls sit in it, outside the text's own column. */}
            <div
                className={cn(
                    'relative py-3 pr-4 pl-14',
                    toolbar && 'mx-auto max-w-3xl px-6 py-10 pl-16'
                )}
            >
                <EditorContent
                    editor={editor}
                    className={cn(
                        WYSIWYG_PROSE,
                        '[&_.ProseMirror]:min-h-24 [&_.ProseMirror]:outline-none',
                        // The placeholder is drawn, not stored: an empty
                        // document has no text at all, so there is nothing to
                        // strip before saving.
                        '[&_.ProseMirror_p.is-editor-empty:first-child]:before:text-muted-foreground [&_.ProseMirror_p.is-editor-empty:first-child]:before:pointer-events-none [&_.ProseMirror_p.is-editor-empty:first-child]:before:float-left [&_.ProseMirror_p.is-editor-empty:first-child]:before:h-0 [&_.ProseMirror_p.is-editor-empty:first-child]:before:content-[attr(data-placeholder)]',
                        // A selected block (an image, a divider) needs to look
                        // selected; ProseMirror marks it and nothing else does.
                        '[&_.ProseMirror-selectednode]:ring-primary/40 [&_.ProseMirror-selectednode]:rounded-sm [&_.ProseMirror-selectednode]:ring-2',
                        // Cells the author has swept across, which is a
                        // selection the browser cannot draw by itself.
                        '[&_.selectedCell]:after:bg-primary/15 [&_.selectedCell]:relative [&_.selectedCell]:after:pointer-events-none [&_.selectedCell]:after:absolute [&_.selectedCell]:after:inset-0 [&_.selectedCell]:after:content-[""]',
                        readOnly && 'cursor-default'
                    )}
                />
            </div>
        </div>
    );
}
