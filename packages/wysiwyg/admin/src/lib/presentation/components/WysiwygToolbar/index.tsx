import { defineMessages, useIntl } from 'react-intl';
import type { Editor } from '@tiptap/react';
import {
    AlignCenter,
    AlignJustify,
    AlignLeft,
    AlignRight,
    Bold,
    Code,
    Italic,
    List,
    ListOrdered,
    Minus,
    Quote,
    Redo2,
    RemoveFormatting,
    Strikethrough,
    Underline,
    Undo2
} from 'lucide-react';
import { useLiveEditorState } from '../../hooks/useLiveEditorState';
import { BlockTypeMenu } from './BlockTypeMenu';
import { CalloutMenu } from './CalloutMenu';
import { COLOR_KIND, ColorMenu } from './ColorMenu';
import { ColumnsMenu } from './ColumnsMenu';
import { FontSizeMenu } from './FontSizeMenu';
import { LinkPopover } from './LinkPopover';
import { TableMenu } from './TableMenu';
import { ToolbarButton } from './ToolbarButton';

const messages = defineMessages({
    toolbar: {
        id: 'wysiwyg.toolbar.label',
        defaultMessage: 'Formatting'
    },
    undo: { id: 'wysiwyg.toolbar.undo', defaultMessage: 'Undo' },
    redo: { id: 'wysiwyg.toolbar.redo', defaultMessage: 'Redo' },
    bold: { id: 'wysiwyg.toolbar.bold', defaultMessage: 'Bold' },
    italic: { id: 'wysiwyg.toolbar.italic', defaultMessage: 'Italic' },
    underline: {
        id: 'wysiwyg.toolbar.underline',
        defaultMessage: 'Underline'
    },
    strike: {
        id: 'wysiwyg.toolbar.strike',
        defaultMessage: 'Strikethrough'
    },
    code: { id: 'wysiwyg.toolbar.code', defaultMessage: 'Inline code' },
    bulletList: {
        id: 'wysiwyg.toolbar.bulletList',
        defaultMessage: 'Bulleted list'
    },
    orderedList: {
        id: 'wysiwyg.toolbar.orderedList',
        defaultMessage: 'Numbered list'
    },
    blockquote: {
        id: 'wysiwyg.toolbar.blockquote',
        defaultMessage: 'Quote'
    },
    alignLeft: {
        id: 'wysiwyg.toolbar.alignLeft',
        defaultMessage: 'Align left'
    },
    alignCenter: {
        id: 'wysiwyg.toolbar.alignCenter',
        defaultMessage: 'Align center'
    },
    alignRight: {
        id: 'wysiwyg.toolbar.alignRight',
        defaultMessage: 'Align right'
    },
    alignJustify: {
        id: 'wysiwyg.toolbar.alignJustify',
        defaultMessage: 'Justify'
    },
    horizontalRule: {
        id: 'wysiwyg.toolbar.horizontalRule',
        defaultMessage: 'Divider'
    },
    clearFormat: {
        id: 'wysiwyg.toolbar.clearFormat',
        defaultMessage: 'Clear formatting'
    }
});

/** Every toggle off, neither history direction available — what a toolbar
 *  reports for the frame in which its editor no longer exists. */
const TOOLBAR_INERT = {
    bold: false,
    italic: false,
    underline: false,
    strike: false,
    code: false,
    bulletList: false,
    orderedList: false,
    blockquote: false,
    alignLeft: false,
    alignCenter: false,
    alignRight: false,
    alignJustify: false,
    canUndo: false,
    canRedo: false
};

/** A hairline between two runs of controls. Decorative — never announced. */
function ToolbarSeparator() {
    return <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-border" />;
}

/**
 * The editor's control bar.
 *
 * Deliberately a `role="group"`, not `role="toolbar"`: the ARIA toolbar pattern
 * promises arrow-key navigation with a single tab stop, and promising it
 * without implementing it strands screen-reader users who then arrow into
 * nothing. As a group every control is an ordinary tab stop, which is honest
 * and works today.
 *
 * The bar subscribes to the editor once, here, for the plain toggles; each
 * dropdown owns the slice of state it needs. That keeps this file from becoming
 * a single selector that every menu re-renders through.
 */
export function WysiwygToolbar({ editor }: { editor: Editor }) {
    const intl = useIntl();
    const state = useLiveEditorState(
        editor,
        (instance) => ({
            bold: instance.isActive('bold'),
            italic: instance.isActive('italic'),
            underline: instance.isActive('underline'),
            strike: instance.isActive('strike'),
            code: instance.isActive('code'),
            bulletList: instance.isActive('bulletList'),
            orderedList: instance.isActive('orderedList'),
            blockquote: instance.isActive('blockquote'),
            alignLeft: instance.isActive({ textAlign: 'left' }),
            alignCenter: instance.isActive({ textAlign: 'center' }),
            alignRight: instance.isActive({ textAlign: 'right' }),
            alignJustify: instance.isActive({ textAlign: 'justify' }),
            canUndo: instance.can().undo(),
            canRedo: instance.can().redo()
        }),
        TOOLBAR_INERT
    );

    return (
        <div
            role="group"
            aria-label={intl.formatMessage(messages.toolbar)}
            className="flex flex-wrap items-center gap-0.5 border-b border-border bg-muted/40 px-2 py-1.5"
        >
            <ToolbarButton
                label={intl.formatMessage(messages.undo)}
                icon={Undo2}
                disabled={!state.canUndo}
                onClick={() => editor.chain().focus().undo().run()}
            />
            <ToolbarButton
                label={intl.formatMessage(messages.redo)}
                icon={Redo2}
                disabled={!state.canRedo}
                onClick={() => editor.chain().focus().redo().run()}
            />

            <ToolbarSeparator />

            <BlockTypeMenu editor={editor} />
            <FontSizeMenu editor={editor} />

            <ToolbarSeparator />

            <ToolbarButton
                label={intl.formatMessage(messages.bold)}
                icon={Bold}
                active={state.bold}
                onClick={() => editor.chain().focus().toggleBold().run()}
            />
            <ToolbarButton
                label={intl.formatMessage(messages.italic)}
                icon={Italic}
                active={state.italic}
                onClick={() => editor.chain().focus().toggleItalic().run()}
            />
            <ToolbarButton
                label={intl.formatMessage(messages.underline)}
                icon={Underline}
                active={state.underline}
                onClick={() => editor.chain().focus().toggleUnderline().run()}
            />
            <ToolbarButton
                label={intl.formatMessage(messages.strike)}
                icon={Strikethrough}
                active={state.strike}
                onClick={() => editor.chain().focus().toggleStrike().run()}
            />
            <ToolbarButton
                label={intl.formatMessage(messages.code)}
                icon={Code}
                active={state.code}
                onClick={() => editor.chain().focus().toggleCode().run()}
            />

            <ToolbarSeparator />

            <ColorMenu editor={editor} kind={COLOR_KIND.Text} />
            <ColorMenu editor={editor} kind={COLOR_KIND.Highlight} />

            <ToolbarSeparator />

            <ToolbarButton
                label={intl.formatMessage(messages.bulletList)}
                icon={List}
                active={state.bulletList}
                onClick={() => editor.chain().focus().toggleBulletList().run()}
            />
            <ToolbarButton
                label={intl.formatMessage(messages.orderedList)}
                icon={ListOrdered}
                active={state.orderedList}
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
            />
            <ToolbarButton
                label={intl.formatMessage(messages.blockquote)}
                icon={Quote}
                active={state.blockquote}
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
            />

            <ToolbarSeparator />

            <ToolbarButton
                label={intl.formatMessage(messages.alignLeft)}
                icon={AlignLeft}
                active={state.alignLeft}
                onClick={() =>
                    editor.chain().focus().setTextAlign('left').run()
                }
            />
            <ToolbarButton
                label={intl.formatMessage(messages.alignCenter)}
                icon={AlignCenter}
                active={state.alignCenter}
                onClick={() =>
                    editor.chain().focus().setTextAlign('center').run()
                }
            />
            <ToolbarButton
                label={intl.formatMessage(messages.alignRight)}
                icon={AlignRight}
                active={state.alignRight}
                onClick={() =>
                    editor.chain().focus().setTextAlign('right').run()
                }
            />
            <ToolbarButton
                label={intl.formatMessage(messages.alignJustify)}
                icon={AlignJustify}
                active={state.alignJustify}
                onClick={() =>
                    editor.chain().focus().setTextAlign('justify').run()
                }
            />

            <ToolbarSeparator />

            <LinkPopover editor={editor} />
            <CalloutMenu editor={editor} />
            <TableMenu editor={editor} />
            <ColumnsMenu editor={editor} />
            <ToolbarButton
                label={intl.formatMessage(messages.horizontalRule)}
                icon={Minus}
                onClick={() => editor.chain().focus().setHorizontalRule().run()}
            />

            <ToolbarSeparator />

            <ToolbarButton
                label={intl.formatMessage(messages.clearFormat)}
                icon={RemoveFormatting}
                onClick={() =>
                    editor.chain().focus().unsetAllMarks().clearNodes().run()
                }
            />
        </div>
    );
}
