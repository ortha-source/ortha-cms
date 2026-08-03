import { defineMessages, useIntl } from 'react-intl';
import {
    ArrowDownToLine,
    ArrowUpToLine,
    GripVertical,
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
import { TableCellAlignItems } from '../TableCellAlignItems';

const messages = defineMessages({
    label: {
        id: 'wysiwyg.block.table.rowMenu',
        defaultMessage: 'Row {index} options'
    },
    insertBefore: {
        id: 'wysiwyg.block.table.insertRowBefore',
        defaultMessage: 'Insert row above'
    },
    insertAfter: {
        id: 'wysiwyg.block.table.insertRowAfter',
        defaultMessage: 'Insert row below'
    },
    remove: {
        id: 'wysiwyg.block.table.removeRow',
        defaultMessage: 'Delete row'
    }
});

/**
 * The handle beside one row: insert either side of it, align its cells, or
 * delete it. Alignment is offered per row as well as per column because a
 * header row is routinely centred while its columns are not.
 */
export function TableRowMenu({
    tablePath,
    index,
    count,
    headerRow
}: {
    tablePath: BlockPath;
    index: number;
    /** How many rows there are — the last one can't be deleted. */
    count: number;
    /** Whether the table's first row is a header row. */
    headerRow: boolean;
}) {
    const intl = useIntl();
    const { commands } = useEditor();
    // Nothing goes above a header row: a header that isn't the first row stops
    // serializing as a `<thead>`, which loses what it meant.
    const canInsertAbove = !(headerRow && index === 0);

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
                        'text-muted-foreground hover:bg-muted h-full w-4 rounded-sm',
                        // Present but invisible until the table is hovered
                        // or the handle itself has focus — the same rule the
                        // block gutter follows, so the handles never shift
                        // the grid and never vanish mid-keyboard-use.
                        'opacity-0 transition-opacity group-hover/table:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100'
                    )}
                >
                    <GripVertical aria-hidden className="size-3.5" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuItem
                    disabled={!canInsertAbove}
                    onSelect={() => commands.insertTableRow(tablePath, index)}
                >
                    <ArrowUpToLine aria-hidden className="size-4" />
                    {intl.formatMessage(messages.insertBefore)}
                </DropdownMenuItem>
                <DropdownMenuItem
                    onSelect={() =>
                        commands.insertTableRow(tablePath, index + 1)
                    }
                >
                    <ArrowDownToLine aria-hidden className="size-4" />
                    {intl.formatMessage(messages.insertAfter)}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <TableCellAlignItems
                    onApply={(attrs) =>
                        commands.setTableRowAttrs(tablePath, index, attrs)
                    }
                />
                <DropdownMenuSeparator />
                <DropdownMenuItem
                    disabled={count <= 1}
                    className="text-destructive focus:text-destructive"
                    onSelect={() => commands.removeTableRow(tablePath, index)}
                >
                    <Trash2 aria-hidden className="size-4" />
                    {intl.formatMessage(messages.remove)}
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
