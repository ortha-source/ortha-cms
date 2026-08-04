import { defineMessages, useIntl } from 'react-intl';
import { useEditorState } from '@tiptap/react';
import {
    AlignCenter,
    AlignJustify,
    AlignLeft,
    AlignRight,
    Bold,
    Code,
    Italic,
    Redo2,
    RemoveFormatting,
    Strikethrough,
    Underline,
    Undo2
} from 'lucide-react';
import { BLOCK_ALIGN, type BlockAlign } from '@ortha-cms/wysiwyg-core';
import { Separator } from '@ortha-cms/design-system';
import { ToolbarButton } from '../../menus/ToolbarButton';
import { useWysiwyg } from '../tiptapContext';
import { TiptapBlockTypeMenu } from '../TiptapBlockTypeMenu';
import { TiptapInsertMenu } from '../TiptapInsertMenu';

const messages = defineMessages({
    label: { id: 'wysiwyg.toolbar.label', defaultMessage: 'Editor toolbar' },
    undo: { id: 'wysiwyg.toolbar.undo', defaultMessage: 'Undo' },
    redo: { id: 'wysiwyg.toolbar.redo', defaultMessage: 'Redo' },
    bold: { id: 'wysiwyg.mark.bold', defaultMessage: 'Bold' },
    italic: { id: 'wysiwyg.mark.italic', defaultMessage: 'Italic' },
    underline: { id: 'wysiwyg.mark.underline', defaultMessage: 'Underline' },
    strike: { id: 'wysiwyg.mark.strike', defaultMessage: 'Strikethrough' },
    code: { id: 'wysiwyg.mark.code', defaultMessage: 'Inline code' },
    clear: {
        id: 'wysiwyg.mark.clear',
        defaultMessage: 'Clear formatting'
    },
    alignLeft: { id: 'wysiwyg.align.left', defaultMessage: 'Align left' },
    alignCenter: { id: 'wysiwyg.align.center', defaultMessage: 'Align centre' },
    alignRight: { id: 'wysiwyg.align.right', defaultMessage: 'Align right' },
    alignJustify: {
        id: 'wysiwyg.align.justify',
        defaultMessage: 'Justify'
    }
});

/** The alignments, in the order they read on a toolbar. */
const ALIGNMENTS: readonly {
    align: BlockAlign;
    Icon: typeof AlignLeft;
    message: 'alignLeft' | 'alignCenter' | 'alignRight' | 'alignJustify';
}[] = [
    { align: BLOCK_ALIGN.Left, Icon: AlignLeft, message: 'alignLeft' },
    { align: BLOCK_ALIGN.Center, Icon: AlignCenter, message: 'alignCenter' },
    { align: BLOCK_ALIGN.Right, Icon: AlignRight, message: 'alignRight' },
    { align: BLOCK_ALIGN.Justify, Icon: AlignJustify, message: 'alignJustify' }
];

/**
 * The persistent toolbar, shown when the editor owns the work area.
 *
 * Every control reads its state from **one** `useEditorState` selector, which
 * is the thing that could not be done before: the old toolbar and the floating
 * one each computed "is the selection bold" from the DOM, and keeping the two
 * answers identical was a rule rather than a fact. Here both subscribe to the
 * same editor and cannot disagree.
 *
 * The selector is also what keeps this cheap — it re-renders the bar only when
 * one of the values it names actually changes, not on every keystroke.
 */
export function TiptapToolbar() {
    const intl = useIntl();
    const { editor } = useWysiwyg();

    const state = useEditorState({
        editor,
        selector: ({ editor: instance }) =>
            instance
                ? {
                      bold: instance.isActive('bold'),
                      italic: instance.isActive('italic'),
                      underline: instance.isActive('underline'),
                      strike: instance.isActive('strike'),
                      code: instance.isActive('code'),
                      align:
                          instance.getAttributes('paragraph')['align'] ??
                          instance.getAttributes('heading')['align'] ??
                          null,
                      canUndo: instance.can().undo(),
                      canRedo: instance.can().redo()
                  }
                : null
    });

    if (!editor || !state) return null;
    const run = () => editor.chain().focus();

    return (
        <div
            role="toolbar"
            aria-label={intl.formatMessage(messages.label)}
            aria-orientation="horizontal"
            className="border-border bg-background/95 sticky top-0 z-20 flex flex-wrap items-center gap-0.5 border-b px-2 py-1 backdrop-blur"
        >
            <ToolbarButton
                label={intl.formatMessage(messages.undo)}
                shortcut="⌘Z"
                active={false}
                disabled={!state.canUndo}
                onClick={() => run().undo().run()}
            >
                <Undo2 aria-hidden className="size-4" />
            </ToolbarButton>
            <ToolbarButton
                label={intl.formatMessage(messages.redo)}
                shortcut="⇧⌘Z"
                active={false}
                disabled={!state.canRedo}
                onClick={() => run().redo().run()}
            >
                <Redo2 aria-hidden className="size-4" />
            </ToolbarButton>

            <Separator orientation="vertical" className="mx-1 h-5" />
            <TiptapBlockTypeMenu />

            <Separator orientation="vertical" className="mx-1 h-5" />
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
            <ToolbarButton
                label={intl.formatMessage(messages.clear)}
                active={false}
                onClick={() => run().unsetAllMarks().run()}
            >
                <RemoveFormatting aria-hidden className="size-4" />
            </ToolbarButton>

            <Separator orientation="vertical" className="mx-1 h-5" />
            {ALIGNMENTS.map(({ align, Icon, message }) => (
                <ToolbarButton
                    key={align}
                    label={intl.formatMessage(messages[message])}
                    active={(state.align ?? BLOCK_ALIGN.Left) === align}
                    onClick={() => run().setBlockAlign(align).run()}
                >
                    <Icon aria-hidden className="size-4" />
                </ToolbarButton>
            ))}

            <Separator orientation="vertical" className="mx-1 h-5" />
            <TiptapInsertMenu />
        </div>
    );
}
