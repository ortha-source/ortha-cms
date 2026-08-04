import { defineMessages, useIntl } from 'react-intl';
import type { Editor } from '@tiptap/react';
import { Table as TableIcon } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from '@ortha-cms/design-system';
import { useLiveEditorState } from '../../../hooks/useLiveEditorState';
import { ToolbarMenuTrigger } from '../ToolbarMenuTrigger';

const messages = defineMessages({
    label: { id: 'wysiwyg.table.label', defaultMessage: 'Table' },
    insert: { id: 'wysiwyg.table.insert', defaultMessage: 'Insert table' },
    rows: { id: 'wysiwyg.table.rows', defaultMessage: 'Rows' },
    columns: { id: 'wysiwyg.table.columns', defaultMessage: 'Columns' },
    rowBefore: {
        id: 'wysiwyg.table.rowBefore',
        defaultMessage: 'Insert row above'
    },
    rowAfter: {
        id: 'wysiwyg.table.rowAfter',
        defaultMessage: 'Insert row below'
    },
    deleteRow: { id: 'wysiwyg.table.deleteRow', defaultMessage: 'Delete row' },
    columnBefore: {
        id: 'wysiwyg.table.columnBefore',
        defaultMessage: 'Insert column left'
    },
    columnAfter: {
        id: 'wysiwyg.table.columnAfter',
        defaultMessage: 'Insert column right'
    },
    deleteColumn: {
        id: 'wysiwyg.table.deleteColumn',
        defaultMessage: 'Delete column'
    },
    headerRow: {
        id: 'wysiwyg.table.headerRow',
        defaultMessage: 'Toggle header row'
    },
    mergeOrSplit: {
        id: 'wysiwyg.table.mergeOrSplit',
        defaultMessage: 'Merge or split cells'
    },
    deleteTable: {
        id: 'wysiwyg.table.deleteTable',
        defaultMessage: 'Delete table'
    }
});

/** The starting grid: a header row plus two body rows, three columns wide. */
const INITIAL_TABLE = { rows: 3, cols: 3, withHeaderRow: true } as const;

/**
 * Table insertion and structure editing. Every item but "Insert table" acts on
 * the table around the caret, so they are hidden — not just disabled — when
 * there is no table: a menu of ten greyed-out rows is harder to read than a
 * menu of one live one.
 */
export function TableMenu({ editor }: { editor: Editor }) {
    const intl = useIntl();
    const inTable = useLiveEditorState(
        editor,
        (instance) => instance.isActive('table'),
        false
    );

    const label = intl.formatMessage(messages.label);
    const run =
        (action: (chain: ReturnType<Editor['chain']>) => void) => () => {
            const chain = editor.chain().focus();
            action(chain);
            chain.run();
        };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <ToolbarMenuTrigger
                    label={label}
                    icon={TableIcon}
                    active={inTable}
                />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52">
                <DropdownMenuItem
                    onSelect={run((chain) => chain.insertTable(INITIAL_TABLE))}
                >
                    {intl.formatMessage(messages.insert)}
                </DropdownMenuItem>
                {inTable ? (
                    <>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel>
                            {intl.formatMessage(messages.rows)}
                        </DropdownMenuLabel>
                        <DropdownMenuItem
                            onSelect={run((chain) => chain.addRowBefore())}
                        >
                            {intl.formatMessage(messages.rowBefore)}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onSelect={run((chain) => chain.addRowAfter())}
                        >
                            {intl.formatMessage(messages.rowAfter)}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onSelect={run((chain) => chain.deleteRow())}
                        >
                            {intl.formatMessage(messages.deleteRow)}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel>
                            {intl.formatMessage(messages.columns)}
                        </DropdownMenuLabel>
                        <DropdownMenuItem
                            onSelect={run((chain) => chain.addColumnBefore())}
                        >
                            {intl.formatMessage(messages.columnBefore)}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onSelect={run((chain) => chain.addColumnAfter())}
                        >
                            {intl.formatMessage(messages.columnAfter)}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onSelect={run((chain) => chain.deleteColumn())}
                        >
                            {intl.formatMessage(messages.deleteColumn)}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            onSelect={run((chain) => chain.toggleHeaderRow())}
                        >
                            {intl.formatMessage(messages.headerRow)}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onSelect={run((chain) => chain.mergeOrSplit())}
                        >
                            {intl.formatMessage(messages.mergeOrSplit)}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            onSelect={run((chain) => chain.deleteTable())}
                        >
                            {intl.formatMessage(messages.deleteTable)}
                        </DropdownMenuItem>
                    </>
                ) : null}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
