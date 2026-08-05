import { defineMessages, useIntl } from 'react-intl';
import type { Editor } from '@tiptap/react';
import {
    Code,
    Ellipsis,
    Quote,
    RemoveFormatting,
    Strikethrough,
    Underline
} from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from '@ortha-cms/design-system';
import { useLiveEditorState } from '../../../hooks/useLiveEditorState';
import { ToolbarMenuTrigger } from '../ToolbarMenuTrigger';

const messages = defineMessages({
    label: { id: 'wysiwyg.more.label', defaultMessage: 'More formatting' },
    underline: {
        id: 'wysiwyg.toolbar.underline',
        defaultMessage: 'Underline'
    },
    strike: {
        id: 'wysiwyg.toolbar.strike',
        defaultMessage: 'Strikethrough'
    },
    code: { id: 'wysiwyg.toolbar.code', defaultMessage: 'Inline code' },
    blockquote: { id: 'wysiwyg.toolbar.blockquote', defaultMessage: 'Quote' },
    clearFormat: {
        id: 'wysiwyg.toolbar.clearFormat',
        defaultMessage: 'Clear formatting'
    }
});

/**
 * The formatting the bar doesn't have room to keep out front: underline,
 * strikethrough, inline code, quote, and clear-formatting.
 *
 * The toggles are **checkbox items**, not plain ones, because they *are* states
 * — a menu that gave no sign the caret is already inside a quote would be worse
 * than the buttons it replaced, not merely smaller.
 *
 * Bold and italic stay out on the bar; underline is here because the bar was
 * ~40px over its one-row budget and underline is the least-reached of the trio.
 * If the bar ever gains room, this is the first item to promote back.
 */
export function MoreMarksMenu({ editor }: { editor: Editor }) {
    const intl = useIntl();
    const state = useLiveEditorState(
        editor,
        (instance) => ({
            underline: instance.isActive('underline'),
            strike: instance.isActive('strike'),
            code: instance.isActive('code'),
            blockquote: instance.isActive('blockquote')
        }),
        { underline: false, strike: false, code: false, blockquote: false }
    );

    const anyActive =
        state.underline || state.strike || state.code || state.blockquote;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <ToolbarMenuTrigger
                    label={intl.formatMessage(messages.label)}
                    icon={Ellipsis}
                    active={anyActive}
                />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuCheckboxItem
                    checked={state.underline}
                    onCheckedChange={() =>
                        editor.chain().focus().toggleUnderline().run()
                    }
                >
                    <Underline className="size-4" />
                    {intl.formatMessage(messages.underline)}
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                    checked={state.strike}
                    onCheckedChange={() =>
                        editor.chain().focus().toggleStrike().run()
                    }
                >
                    <Strikethrough className="size-4" />
                    {intl.formatMessage(messages.strike)}
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                    checked={state.code}
                    onCheckedChange={() =>
                        editor.chain().focus().toggleCode().run()
                    }
                >
                    <Code className="size-4" />
                    {intl.formatMessage(messages.code)}
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                    checked={state.blockquote}
                    onCheckedChange={() =>
                        editor.chain().focus().toggleBlockquote().run()
                    }
                >
                    <Quote className="size-4" />
                    {intl.formatMessage(messages.blockquote)}
                </DropdownMenuCheckboxItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                    onSelect={() =>
                        editor
                            .chain()
                            .focus()
                            .unsetAllMarks()
                            .clearNodes()
                            .run()
                    }
                >
                    <RemoveFormatting className="size-4" />
                    {intl.formatMessage(messages.clearFormat)}
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
