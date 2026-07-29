import { defineMessages, useIntl } from 'react-intl';
import { Heading, Plus } from 'lucide-react';
import { isHeaderRow } from '@ortha-cms/wysiwyg-core';
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
    }
});

/**
 * A table. Renders its own children — rows and cells have to be real `<tr>` and
 * `<td>` elements, so they cannot go through {@link BlockRow}, whose gutter and
 * drop targets are `<div>`s.
 *
 * The row and column handles live in an **extra row and column of the table
 * itself**, borderless and editor-only. That is what keeps them aligned with
 * what they act on for free: any absolutely-positioned strip would have to
 * re-measure every column on every edit, and be wrong for the frame in between.
 */
export function TableBlock({ block, path }: BlockViewProps) {
    const intl = useIntl();
    const { commands, readOnly } = useEditor();
    const rows = block.children;
    const columns = rows[0]?.children.length ?? 0;
    const header = isHeaderRow(rows[0]);

    return (
        <div
            role="group"
            aria-label={intl.formatMessage(messages.label)}
            className="my-2"
        >
            <div className="w-full overflow-x-auto">
                <table className="border-collapse text-sm">
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
                        onClick={() => commands.insertTableColumn(path, columns)}
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
                </div>
            )}
        </div>
    );
}
