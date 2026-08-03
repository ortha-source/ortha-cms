import { defineMessages, useIntl } from 'react-intl';
import {
    AlignCenter,
    AlignLeft,
    AlignRight,
    Heading,
    Plus,
    type LucideIcon
} from 'lucide-react';
import {
    BLOCK_ALIGN,
    hasColumnWidths,
    isHeaderRow,
    type BlockAlign
} from '@ortha-cms/wysiwyg-core';
import { Button, cn } from '@ortha-cms/design-system';
import { useEditor } from '../../../editor/editorContext';
import type { BlockViewProps } from '../../blockRegistry';
import { TableCellBlock } from '../TableCellBlock';
import { TableColumnMenu } from '../TableColumnMenu';
import { TableRowMenu } from '../TableRowMenu';

const messages = defineMessages({
    label: { id: 'wysiwyg.block.table.label', defaultMessage: 'Table' },
    addRow: {
        id: 'wysiwyg.block.table.addRow',
        defaultMessage: 'Add row'
    },
    addColumn: {
        id: 'wysiwyg.block.table.addColumn',
        defaultMessage: 'Add column'
    },
    headerRow: {
        id: 'wysiwyg.block.table.headerRow',
        defaultMessage: 'Header row'
    },
    tableAlign: {
        id: 'wysiwyg.block.table.tableAlign',
        defaultMessage: 'Table'
    },
    alignLeft: { id: 'wysiwyg.align.left', defaultMessage: 'Align left' },
    alignCenter: { id: 'wysiwyg.align.center', defaultMessage: 'Align centre' },
    alignRight: { id: 'wysiwyg.align.right', defaultMessage: 'Align right' }
});

/**
 * Where the table itself sits in the measure. Three, not the usual four —
 * `justify` says nothing about a box that is narrower than its container, which
 * is the only case any of this is visible in.
 */
const TABLE_ALIGNS: readonly {
    align: BlockAlign;
    Icon: LucideIcon;
    message: 'alignLeft' | 'alignCenter' | 'alignRight';
}[] = [
    { align: BLOCK_ALIGN.Left, Icon: AlignLeft, message: 'alignLeft' },
    { align: BLOCK_ALIGN.Center, Icon: AlignCenter, message: 'alignCenter' },
    { align: BLOCK_ALIGN.Right, Icon: AlignRight, message: 'alignRight' }
];

/**
 * A table. Renders its own children — rows and cells have to be real `<tr>` and
 * `<td>` elements, so they cannot go through {@link BlockRow}, whose gutter and
 * drop targets are `<div>`s.
 *
 * The row and column handles live in an **extra row and column of the table
 * itself**, borderless and editor-only. That is what keeps them aligned with
 * what they act on for free: any absolutely-positioned strip would have to
 * re-measure every column on every edit, and be wrong for the frame in between.
 *
 * Three separate alignment choices meet here and are deliberately kept apart:
 * where the **table** sits (the footer's buttons, and the block menu), where a
 * **cell's** content sits horizontally (the toolbar, and the row/column menus),
 * and where it sits vertically (the row/column menus). Collapsing them into one
 * control would make "centre" ambiguous the moment the caret is in a cell.
 */
export function TableBlock({ block, path }: BlockViewProps) {
    const intl = useIntl();
    const { commands, readOnly } = useEditor();
    const rows = block.children;
    const columns = rows[0]?.children.length ?? 0;
    const header = isHeaderRow(rows[0]);
    const align = block.attrs['align'];
    // A resized table takes the whole measure: percentage column widths are
    // resolved against the table, and a shrink-to-fit table would re-resolve
    // them on every keystroke. This is the same rule `toHtml` writes out.
    const sized = hasColumnWidths(block);

    return (
        <div
            role="group"
            aria-label={intl.formatMessage(messages.label)}
            className="group/table my-2"
        >
            <div
                className={cn(
                    'w-full overflow-x-auto',
                    // Aligning the table moves its box, so the *wrapper* is
                    // what has to shrink to it — `text-align` cannot move a
                    // block, and the table is one.
                    align === BLOCK_ALIGN.Center && 'flex justify-center',
                    align === BLOCK_ALIGN.Right && 'flex justify-end'
                )}
            >
                <table
                    data-align={align ?? undefined}
                    className={cn(
                        'border-collapse text-sm',
                        sized && 'w-full',
                        // The table's own alignment must not inherit down into
                        // the cells: where the box sits and where the words sit
                        // are two choices, and a cell that made neither should
                        // read left-aligned.
                        align !== undefined && 'text-start'
                    )}
                >
                    <tbody>
                        {!readOnly && (
                            <tr>
                                <td className="w-4 p-0" />
                                {rows[0]?.children.map((cell, column) => (
                                    <td key={cell.id} className="p-0 pb-0.5">
                                        <TableColumnMenu
                                            tablePath={path}
                                            index={column}
                                            count={columns}
                                        />
                                    </td>
                                ))}
                            </tr>
                        )}
                        {rows.map((row, rowIndex) => (
                            <tr key={row.id}>
                                {!readOnly && (
                                    <td className="w-4 p-0 pr-0.5">
                                        <TableRowMenu
                                            tablePath={path}
                                            index={rowIndex}
                                            count={rows.length}
                                            headerRow={header}
                                        />
                                    </td>
                                )}
                                {row.children.map((cell, columnIndex) => (
                                    <TableCellBlock
                                        key={cell.id}
                                        block={cell}
                                        path={[...path, rowIndex, columnIndex]}
                                        // Every row carries a segment of the
                                        // column's edge, so the line runs the
                                        // whole depth of the table; only the
                                        // first is the named control.
                                        resizable
                                        labelledResizer={rowIndex === 0}
                                    />
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {!readOnly && (
                <div className="mt-1 flex flex-wrap items-center gap-1">
                    <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-muted-foreground h-7 px-2 text-xs"
                        onClick={() =>
                            commands.insertTableRow(path, rows.length)
                        }
                    >
                        <Plus aria-hidden className="size-3.5" />
                        {intl.formatMessage(messages.addRow)}
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-muted-foreground h-7 px-2 text-xs"
                        onClick={() =>
                            commands.insertTableColumn(path, columns)
                        }
                    >
                        <Plus aria-hidden className="size-3.5" />
                        {intl.formatMessage(messages.addColumn)}
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        aria-pressed={header}
                        className={cn(
                            'h-7 px-2 text-xs',
                            header
                                ? 'bg-accent text-accent-foreground'
                                : 'text-muted-foreground'
                        )}
                        onClick={() => commands.toggleTableHeaderRow(path)}
                    >
                        <Heading aria-hidden className="size-3.5" />
                        {intl.formatMessage(messages.headerRow)}
                    </Button>

                    {/* The table's own alignment. Beside the table rather than
                        in the toolbar because the toolbar's control follows the
                        caret, and a caret in a cell means the cell. */}
                    <span
                        aria-hidden
                        className="text-muted-foreground ml-1 shrink-0 text-[11px] font-medium tracking-wide uppercase"
                    >
                        {intl.formatMessage(messages.tableAlign)}
                    </span>
                    {TABLE_ALIGNS.map(({ align: option, Icon, message }) => {
                        const active = (align ?? BLOCK_ALIGN.Left) === option;
                        return (
                            <Button
                                key={option}
                                type="button"
                                size="icon"
                                variant="ghost"
                                aria-pressed={active}
                                aria-label={intl.formatMessage(
                                    messages[message]
                                )}
                                className={cn(
                                    'size-7',
                                    active
                                        ? 'bg-accent text-accent-foreground'
                                        : 'text-muted-foreground'
                                )}
                                onClick={() => commands.setAlign(path, option)}
                            >
                                <Icon aria-hidden className="size-3.5" />
                            </Button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
