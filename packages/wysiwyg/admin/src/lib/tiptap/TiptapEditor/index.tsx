import { useMemo } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { cn } from '@ortha-cms/design-system';
import type { WysiwygMediaPort } from '../../media/wysiwygMedia';
import { TiptapProvider } from '../tiptapContext';
import { TiptapToolbar } from '../TiptapToolbar';
import { WysiwygProseSurface } from '../WysiwygProseSurface';
import { useWysiwygEditor } from '../useWysiwygEditor';

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
    const editor = useWysiwygEditor({
        value,
        onChange,
        onBlur,
        readOnly,
        placeholder: intl.formatMessage(messages.placeholder)
    });

    const context = useMemo(
        () => ({ editor, readOnly, media }),
        [editor, readOnly, media]
    );

    return (
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
            </div>
        </TiptapProvider>
    );
}
