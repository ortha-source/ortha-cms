import { useCallback } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { BubbleMenu } from '@tiptap/react/menus';
import { useEditorState } from '@tiptap/react';
import type { Editor } from '@tiptap/react';
import { Bold, Code, Italic, Strikethrough, Underline } from 'lucide-react';
import { Separator } from '@ortha-cms/design-system';
import { ToolbarButton } from '../../menus/ToolbarButton';
import { useWysiwyg } from '../tiptapContext';
import { TiptapInlineControls } from '../TiptapInlineControls';

const messages = defineMessages({
    label: {
        id: 'wysiwyg.inlineToolbar.label',
        defaultMessage: 'Text formatting'
    },
    bold: { id: 'wysiwyg.mark.bold', defaultMessage: 'Bold' },
    italic: { id: 'wysiwyg.mark.italic', defaultMessage: 'Italic' },
    underline: { id: 'wysiwyg.mark.underline', defaultMessage: 'Underline' },
    strike: { id: 'wysiwyg.mark.strike', defaultMessage: 'Strikethrough' },
    code: { id: 'wysiwyg.mark.code', defaultMessage: 'Inline code' }
});

/**
 * The toolbar that appears over a selection.
 *
 * It is the whole formatting UI for the field rendered **inline** in a form,
 * where there is no room for a persistent bar; in the expanded editor it is the
 * fast path for someone who already knows the editor, and the top bar is how
 * they found out it could do any of this. The duplication between the two is
 * the feature — but only of the *controls*. Both read `useEditorState` against
 * the same editor, so they cannot disagree about whether the selection is bold,
 * which used to be a rule two DOM readers were asked to keep rather than a fact.
 */
export function TiptapSelectionToolbar() {
    const intl = useIntl();
    const { editor, readOnly } = useWysiwyg();

    const state = useEditorState({
        editor,
        selector: ({ editor: instance }) =>
            instance
                ? {
                      bold: instance.isActive('bold'),
                      italic: instance.isActive('italic'),
                      underline: instance.isActive('underline'),
                      strike: instance.isActive('strike'),
                      code: instance.isActive('code')
                  }
                : null
    });

    /**
     * Stable, and not merely for tidiness: `BubbleMenu` dispatches a
     * transaction when this identity changes, so an inline arrow would dispatch
     * one on every render — and every transaction renders.
     */
    const shouldShow = useCallback(
        ({ editor: instance, from, to }: { editor: Editor; from: number; to: number }) =>
            instance.isEditable &&
            from !== to &&
            // A code block is plain text by definition; offering to make some
            // of it bold is offering markup the block cannot hold.
            !instance.isActive('codeBlock'),
        []
    );

    if (!editor || readOnly || !state) return null;
    const run = () => editor.chain().focus();

    return (
        <BubbleMenu
            editor={editor}
            shouldShow={shouldShow}
            role="toolbar"
            aria-label={intl.formatMessage(messages.label)}
            aria-orientation="horizontal"
            className="bg-popover text-popover-foreground z-50 flex items-center gap-0.5 rounded-md border p-1 shadow-md"
        >
            <ToolbarButton
                label={intl.formatMessage(messages.bold)}
                shortcut="⌘B"
                active={state.bold}
                onClick={() => run().toggleBold().run()}
            >
                <Bold aria-hidden className="size-4" />
            </ToolbarButton>
            <ToolbarButton
                label={intl.formatMessage(messages.italic)}
                shortcut="⌘I"
                active={state.italic}
                onClick={() => run().toggleItalic().run()}
            >
                <Italic aria-hidden className="size-4" />
            </ToolbarButton>
            <ToolbarButton
                label={intl.formatMessage(messages.underline)}
                shortcut="⌘U"
                active={state.underline}
                onClick={() => run().toggleUnderline().run()}
            >
                <Underline aria-hidden className="size-4" />
            </ToolbarButton>
            <ToolbarButton
                label={intl.formatMessage(messages.strike)}
                shortcut="⌘D"
                active={state.strike}
                onClick={() => run().toggleStrike().run()}
            >
                <Strikethrough aria-hidden className="size-4" />
            </ToolbarButton>
            <ToolbarButton
                label={intl.formatMessage(messages.code)}
                shortcut="⌘E"
                active={state.code}
                onClick={() => run().toggleCode().run()}
            >
                <Code aria-hidden className="size-4" />
            </ToolbarButton>

            <Separator orientation="vertical" className="mx-1 h-5" />
            <TiptapInlineControls />
        </BubbleMenu>
    );
}
