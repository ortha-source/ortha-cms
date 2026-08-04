import { useMemo } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { EditorContent, EditorContext } from '@tiptap/react';
import { cn } from '@ortha-cms/design-system';
import type { WysiwygMediaPort } from '../../media/wysiwygMedia';
import { WYSIWYG_INLINE_PROSE } from '../../render/wysiwygProse';
import { TiptapProvider } from '../tiptapContext';
import { TiptapToolbar } from '../TiptapToolbar';
import { useWysiwygEditor } from '../useWysiwygEditor';

// The Simple Editor template's tokens and the block styles its node CSS owns —
// the same imports its own `simple-editor.tsx` makes.
import '../tiptapTheme.scss';
import '../../../tiptap-ui/components/tiptap-node/blockquote-node/blockquote-node.scss';
import '../../../tiptap-ui/components/tiptap-node/code-block-node/code-block-node.scss';
import '../../../tiptap-ui/components/tiptap-node/horizontal-rule-node/horizontal-rule-node.scss';
import '../../../tiptap-ui/components/tiptap-node/list-node/list-node.scss';
import '../../../tiptap-ui/components/tiptap-node/image-node/image-node.scss';
import '../../../tiptap-ui/components/tiptap-node/heading-node/heading-node.scss';
import '../../../tiptap-ui/components/tiptap-node/paragraph-node/paragraph-node.scss';

const messages = defineMessages({
    label: {
        id: 'wysiwyg.editor.label',
        defaultMessage: 'Rich text editor'
    },
    placeholder: {
        id: 'wysiwyg.editor.placeholder',
        defaultMessage: 'Write something…'
    }
});

/** Props of the editor. */
export interface TiptapEditorProps {
    /** The document, as HTML. The editor is fully controlled. */
    value: string;
    /** Called with the new HTML on every edit (`''` when the editor is empty). */
    onChange(html: string): void;
    /** Called when focus leaves the editor entirely — for form `touched` state. */
    onBlur?(): void;
    /** Render the document without any editing affordances. */
    readOnly?: boolean;
    /** Draw the invalid state and set `aria-invalid`. */
    invalid?: boolean;
    /**
     * Show the toolbar and fill the parent's height, scrolling the writing
     * surface under it. For a surface with room for one — the expanded field.
     */
    toolbar?: boolean;
    /**
     * The host's media library. Given one, the toolbar offers an image button
     * that opens it; without one there is nothing to open and it is not drawn.
     */
    media?: WysiwygMediaPort | null;
    id?: string;
    className?: string;
    'aria-describedby'?: string;
}

/**
 * The editor — Tiptap's **Simple Editor** template, wrapped in the form-control
 * contract this CMS needs.
 *
 * What is here is the wrapping and nothing else: the toolbar is the template's,
 * the writing surface is its `EditorContent` with its `simple-editor` class, and
 * the styles are the ones its own components import. The parts that are not the
 * template's are the parts a template cannot know about — that the value is
 * HTML a server will sanitize (`useWysiwygEditor`), and that images come from a
 * media library the host owns.
 *
 * Two providers, on purpose. `TiptapProvider` carries the read-only flag and the
 * media port; the template's components look the editor up in TipTap's own
 * `EditorContext`, and giving them anything else would mean editing every copied
 * file.
 */
export function TiptapEditor({
    value,
    onChange,
    onBlur,
    readOnly = false,
    invalid = false,
    toolbar = false,
    media = null,
    id,
    className,
    'aria-describedby': describedBy
}: TiptapEditorProps) {
    const intl = useIntl();

    const editor = useWysiwygEditor({
        value,
        onChange,
        onBlur,
        readOnly,
        placeholder: intl.formatMessage(messages.placeholder),
        label: intl.formatMessage(messages.label)
    });

    const context = useMemo(
        () => ({ editor, readOnly, media }),
        [editor, readOnly, media]
    );
    const editorContext = useMemo(() => ({ editor }), [editor]);

    return (
        <EditorContext.Provider value={editorContext}>
            <TiptapProvider value={context}>
                <div
                    id={id}
                    role="group"
                    aria-label={intl.formatMessage(messages.label)}
                    aria-describedby={describedBy}
                    aria-invalid={invalid || undefined}
                    aria-readonly={readOnly || undefined}
                    className={cn(
                        'bg-background',
                        // With a toolbar the editor is the whole surface: it
                        // fills its parent and scrolls under the bar.
                        toolbar
                            ? 'flex h-full min-h-0 flex-col'
                            : 'rounded-md border',
                        invalid && !toolbar && 'border-destructive',
                        readOnly && 'bg-muted/30',
                        className
                    )}
                >
                    {toolbar && !readOnly && <TiptapToolbar />}
                    <div
                        className={cn(
                            toolbar && 'min-h-0 flex-1 overflow-y-auto'
                        )}
                    >
                        <EditorContent
                            editor={editor}
                            role="presentation"
                            className={cn(
                                'px-4 py-3',
                                toolbar && 'mx-auto max-w-3xl px-6 py-10',
                                // The **inline** half of the shared prose
                                // rules, and only that half: the template's
                                // node stylesheets own the blocks. A colour
                                // lives in the markup itself, and without these
                                // an author picks green and watches a `<mark>`
                                // come out the browser's default yellow, while
                                // the rendered document shows it correctly.
                                ...WYSIWYG_INLINE_PROSE
                            )}
                        />
                    </div>
                </div>
            </TiptapProvider>
        </EditorContext.Provider>
    );
}
