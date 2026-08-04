import { useCallback, useMemo, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { EditorContext } from '@tiptap/react';
import { cn } from '@ortha-cms/design-system';
import type { WysiwygMediaPort } from '../../media/wysiwygMedia';
import { TiptapProvider } from '../tiptapContext';
import { TiptapToolbar } from '../TiptapToolbar';
import { WysiwygProseSurface } from '../WysiwygProseSurface';
import { useWysiwygEditor } from '../useWysiwygEditor';
import { TiptapBlockHandle } from '../TiptapBlockHandle';
import { TiptapSelectionToolbar } from '../TiptapSelectionToolbar';
import { TiptapTableToolbar } from '../TiptapTableToolbar';
import { TiptapSlashMenu } from '../TiptapSlashMenu';
import type { SlashMenuState } from '../slashCommand';

// The Simple Editor template's tokens, and the block styles its node CSS owns.
// Imported here rather than in each renderer because there is one writing
// surface and these are the rules it is drawn with.
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
        defaultMessage: 'Write something, or press / for blocks'
    }
});

/** Props of the block editor. */
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
     * Show the persistent toolbar and fill the parent's height, scrolling the
     * writing surface under it. For a surface with room for one — the expanded
     * field. Inline in a form, the floating selection toolbar is the whole
     * formatting UI.
     */
    toolbar?: boolean;
    /**
     * The host's media library. Given one, the image block offers "choose from
     * library" alongside pasting a URL.
     */
    media?: WysiwygMediaPort | null;
    id?: string;
    className?: string;
    'aria-describedby'?: string;
}

/**
 * The Ortha block editor — a Notion-shaped writing surface whose value is plain
 * **HTML**, in and out.
 *
 * The document, the commands, undo, selection and every contenteditable edge
 * case belong to TipTap. What is left here is the wiring TipTap has no opinion
 * about: the form-control contract (see `useWysiwygEditor`), the chrome, and
 * the focus boundary of the editor as a field.
 *
 * That division is the whole reason for the rewrite. The behaviour this file
 * used to own — what Enter does at the end of a list item, what Backspace does
 * at the start of a heading, how a mark survives a selection spanning three
 * others — is not product design, it is contenteditable, and every hour spent
 * on it was an hour not spent on the editor itself.
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
    const [slash, setSlash] = useState<SlashMenuState | null>(null);
    /**
     * The editor root, as state, because the overlays portal **into it**
     * rather than into `document.body`. It sets no `transform`, so their
     * viewport coordinates still resolve against the viewport, and living
     * inside the editor keeps them in whatever tree it is mounted in —
     * including one that has been made inert around it.
     */
    const [root, setRoot] = useState<HTMLDivElement | null>(null);

    const editor = useWysiwygEditor({
        value,
        onChange,
        onBlur,
        readOnly,
        placeholder: intl.formatMessage(messages.placeholder),
        formatLabel: useCallback(
            (label: Parameters<typeof intl.formatMessage>[0]) =>
                intl.formatMessage(label),
            [intl]
        ),
        onSlashChange: setSlash
    });

    const context = useMemo(
        () => ({ editor, readOnly, media }),
        [editor, readOnly, media]
    );
    const editorContext = useMemo(() => ({ editor }), [editor]);

    return (
        // Two providers, on purpose. Ours carries the read-only flag and the
        // media port; the template's components look the editor up in TipTap's
        // own `EditorContext` (`useTiptapEditor`), and giving them anything
        // else would mean editing every copied file.
        <EditorContext.Provider value={editorContext}>
            <TiptapProvider value={context}>
                <div
                    ref={setRoot}
                    id={id}
                    role="group"
                    aria-label={intl.formatMessage(messages.label)}
                    aria-describedby={describedBy}
                    aria-invalid={invalid || undefined}
                    aria-readonly={readOnly || undefined}
                    className={cn(
                        'bg-background',
                        // With a toolbar the editor is the whole surface: it fills
                        // its parent and scrolls under the bar, so the bar stays.
                        toolbar
                            ? 'flex h-full min-h-0 flex-col'
                            : 'rounded-md border',
                        invalid && !toolbar && 'border-destructive',
                        readOnly && 'bg-muted/30',
                        'focus:outline-none',
                        className
                    )}
                >
                    {toolbar && !readOnly && <TiptapToolbar />}
                    <WysiwygProseSurface
                        editor={editor}
                        toolbar={toolbar}
                        readOnly={readOnly}
                    />
                    <TiptapBlockHandle />
                    <TiptapSelectionToolbar />
                    <TiptapTableToolbar />
                </div>
                {slash && !readOnly && (
                    <TiptapSlashMenu state={slash} container={root} />
                )}
            </TiptapProvider>
        </EditorContext.Provider>
    );
}
