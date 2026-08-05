import { defineMessages, useIntl } from 'react-intl';
import type { Editor } from '@tiptap/react';
import { Columns3, Info, Minus, Plus, Table as TableIcon } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuPortal,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger
} from '@ortha-cms/design-system';
import { useLiveEditorState } from '../../../hooks/useLiveEditorState';
import { ToolbarMenuTrigger } from '../ToolbarMenuTrigger';
import { CalloutItems } from './CalloutItems';
import { ColumnItems } from './ColumnItems';
import { TableItems } from './TableItems';

const messages = defineMessages({
    label: { id: 'wysiwyg.insert.label', defaultMessage: 'Insert' },
    table: { id: 'wysiwyg.table.label', defaultMessage: 'Table' },
    callout: { id: 'wysiwyg.callout.label', defaultMessage: 'Callout' },
    columns: { id: 'wysiwyg.columns.label', defaultMessage: 'Columns' },
    divider: {
        id: 'wysiwyg.toolbar.horizontalRule',
        defaultMessage: 'Divider'
    }
});

/**
 * The block-insertion menu: tables, callouts, column layouts, dividers.
 *
 * These were four separate toolbar controls, and they were the four that pushed
 * the bar onto a second line. Collapsing them behind one trigger is not just
 * space-saving — they are the same kind of action ("put a block here"), which
 * is why they read as a set rather than as an arbitrary bundle.
 *
 * Each of the three structured ones keeps its own submenu, so their per-block
 * editing (add a row, re-tone, reshape) stays where the block itself is rather
 * than being flattened into one long list.
 */
export function InsertMenu({ editor }: { editor: Editor }) {
    const intl = useIntl();
    // The trigger lights up when the caret is inside something this menu owns,
    // so an author can see at a glance that the block editing under it applies
    // to where they are.
    const inserted = useLiveEditorState(
        editor,
        (instance) =>
            instance.isActive('table') ||
            instance.isActive('callout') ||
            instance.isActive('columnBlock'),
        false
    );

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <ToolbarMenuTrigger
                    label={intl.formatMessage(messages.label)}
                    icon={Plus}
                    active={inserted}
                />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                        <TableIcon className="size-4" />
                        {intl.formatMessage(messages.table)}
                    </DropdownMenuSubTrigger>
                    <DropdownMenuPortal>
                        <DropdownMenuSubContent className="w-52">
                            <TableItems editor={editor} />
                        </DropdownMenuSubContent>
                    </DropdownMenuPortal>
                </DropdownMenuSub>

                <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                        <Columns3 className="size-4" />
                        {intl.formatMessage(messages.columns)}
                    </DropdownMenuSubTrigger>
                    <DropdownMenuPortal>
                        <DropdownMenuSubContent className="w-56">
                            <ColumnItems editor={editor} />
                        </DropdownMenuSubContent>
                    </DropdownMenuPortal>
                </DropdownMenuSub>

                <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                        <Info className="size-4" />
                        {intl.formatMessage(messages.callout)}
                    </DropdownMenuSubTrigger>
                    <DropdownMenuPortal>
                        <DropdownMenuSubContent className="w-44">
                            <CalloutItems editor={editor} />
                        </DropdownMenuSubContent>
                    </DropdownMenuPortal>
                </DropdownMenuSub>

                <DropdownMenuSeparator />

                <DropdownMenuItem
                    onSelect={() =>
                        editor.chain().focus().setHorizontalRule().run()
                    }
                >
                    <Minus className="size-4" />
                    {intl.formatMessage(messages.divider)}
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
