import { useEffect, useRef } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import { Button } from '@ortha-cms/design-system';
import { WYSIWYG_PROSE_CLASS } from '../../../../domain/constants';
import { normalizeRichText } from '../../../../domain/richTextValue';
import { editorExtensions } from '../../../../infrastructure/editorExtensions';
import { WysiwygToolbar } from '../../WysiwygToolbar';

const messages = defineMessages({
    editorLabel: {
        id: 'wysiwyg.editor.label',
        defaultMessage: '{field} content'
    },
    count: {
        id: 'wysiwyg.editor.count',
        defaultMessage:
            '{words, plural, one {# word} other {# words}} · {characters, plural, one {# character} other {# characters}}'
    },
    done: { id: 'wysiwyg.editor.done', defaultMessage: 'Done' }
});

/**
 * The editing surface itself: toolbar, document, footer.
 *
 * Mounted **only while the dialog is open** (Radix unmounts its portal when
 * closed), which is what lets the editor be seeded from `initialHtml` once at
 * mount and own its own state from then on — no controlled-content sync, and
 * therefore none of the caret-jumping that comes with it.
 *
 * Edits are written straight back to the entry form as they're made, exactly
 * like typing in any other field. That is what makes every way out of this
 * dialog safe: Done, the ✕, Escape, and a click outside all leave the work in
 * the form, where the record's own Save (and the unsaved-changes guard) is the
 * real commit boundary.
 */
export function WysiwygEditorPanel({
    fieldLabel,
    initialHtml,
    placeholder,
    onChange,
    onDone
}: {
    /** The field's display label, used to name the editing region. */
    fieldLabel: string;
    /** The value at open time. Read once — this is not a controlled prop. */
    initialHtml: string;
    /** The field's `admin.placeholder`, shown in an empty document. */
    placeholder: string;
    /** Write an edit back to the entry form. */
    onChange: (value: string) => void;
    /** Close the dialog. */
    onDone: () => void;
}) {
    const intl = useIntl();

    // The form hands down a fresh `onChange` on every render. TipTap captures
    // its options when the editor is created, so calling the prop directly
    // would pin the editor to the first closure it ever saw; the ref keeps the
    // write pointed at the current one.
    const onChangeRef = useRef(onChange);
    useEffect(() => {
        onChangeRef.current = onChange;
    });

    const editor = useEditor({
        extensions: editorExtensions(placeholder),
        content: initialHtml,
        // The author pressed "edit" to keep writing, so start where the text
        // ends. This is also what puts focus inside the dialog, since the
        // dialog suppresses Radix's own auto-focus.
        autofocus: 'end',
        editorProps: {
            attributes: {
                class: `${WYSIWYG_PROSE_CLASS} outline-none`,
                // A bare `contenteditable` div has no role, so assistive tech
                // is left to guess it's editable at all. `textbox` +
                // `aria-multiline` is the mapping ProseMirror doesn't apply for
                // us, and the label keeps it distinct from the entry form's own
                // inputs (there can be several rich-text fields on one record).
                role: 'textbox',
                'aria-multiline': 'true',
                'aria-label': intl.formatMessage(messages.editorLabel, {
                    field: fieldLabel
                })
            }
        },
        onUpdate: ({ editor: instance }) => {
            onChangeRef.current(normalizeRichText(instance.getHTML()));
        }
    });

    const counts = useEditorState({
        editor,
        selector: ({ editor: instance }) => ({
            words: instance.storage['characterCount'].words() as number,
            characters: instance.storage[
                'characterCount'
            ].characters() as number
        })
    });

    return (
        <>
            <WysiwygToolbar editor={editor} />
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                <EditorContent editor={editor} />
            </div>
            <div className="flex items-center justify-between gap-4 border-t border-border px-6 py-3">
                <p
                    className="text-xs text-muted-foreground"
                    // The count changes on every keystroke; announcing each one
                    // would talk over the author as they write.
                    aria-live="off"
                >
                    {intl.formatMessage(messages.count, counts)}
                </p>
                <Button type="button" onClick={onDone}>
                    {intl.formatMessage(messages.done)}
                </Button>
            </div>
        </>
    );
}
