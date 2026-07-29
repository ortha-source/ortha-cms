import { defineMessages, useIntl } from 'react-intl';
import {
    ArrowLeftToLine,
    ArrowRightToLine,
    GripHorizontal,
    Trash2
} from 'lucide-react';
import type { BlockPath } from '@ortha-cms/wysiwyg-core';
import {
    Button,
    cn,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from '@ortha-cms/design-system';
import { useEditor } from '../../../editor/editorContext';

const messages = defineMessages({
    label: {
        id: 'wysiwyg.block.table.columnMenu',
        defaultMessage: 'Column {index} options'
    },
    insertBefore: {
        id: 'wysiwyg.block.table.insertColumnBefore',
        defaultMessage: 'Insert column left'
    },
    insertAfter: {
        id: 'wysiwyg.block.table.insertColumnAfter',
        defaultMessage: 'Insert column right'
    },
    remove: {
        id: 'wysiwyg.block.table.removeColumn',
        defaultMessage: 'Delete column'
    }
});

/** The handle above one column: insert either side of it, or delete it. */
export function TableColumnMenu({
    tablePath,
    index,
    count
}: {
    tablePath: BlockPath;
    index: number;
    /** How many columns there are — the last one can't be deleted. */
    count: number;
}) {
    const intl = useIntl();
    const { commands } = useEditor();

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label={intl.formatMessage(messages.label, {
                        index: index + 1
                    })}
                    className={cn(
                        'text-muted-foreground hover:bg-muted h-4 w-full rounded-sm',
                        // Present but invisible until the table is hovered
                        // or the handle itself has focus — the same rule the
                        // block gutter follows, so the handles never shift
                        // the grid and never vanish mid-keyboard-use.
                        'opacity-0 transition-opacity group-hover/table:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100'
                    )}
                >
                    <GripHorizontal aria-hidden className="size-3.5" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuItem
                    onSelect={() => commands.insertTableColumn(tablePath, index)}
                >
                    <ArrowLeftToLine aria-hidden className="size-4" />
                    {intl.formatMessage(messages.insertBefore)}
                </DropdownMenuItem>
                <DropdownMenuItem
                    onSelect={() =>
                        commands.insertTableColumn(tablePath, index + 1)
                    }
                >
                    <ArrowRightToLine aria-hidden className="size-4" />
                    {intl.formatMessage(messages.insertAfter)}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                    disabled={count <= 1}
                    className="text-destructive focus:text-destructive"
                    onSelect={() => commands.removeTableColumn(tablePath, index)}
                >
                    <Trash2 aria-hidden className="size-4" />
                    {intl.formatMessage(messages.remove)}
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
