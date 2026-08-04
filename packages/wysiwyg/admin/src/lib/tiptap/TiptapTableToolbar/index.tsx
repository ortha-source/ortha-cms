import { useCallback } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { BubbleMenu } from '@tiptap/react/menus';
import { useEditorState, type Editor } from '@tiptap/react';
import {
    AlignCenter,
    AlignEndVertical,
    AlignJustify,
    AlignLeft,
    AlignRight,
    AlignStartVertical,
    AlignVerticalSpaceAround,
    ArrowDownToLine,
    ArrowLeftToLine,
    ArrowRightToLine,
    ArrowUpToLine,
    Heading,
    Trash2
} from 'lucide-react';
import {
    BLOCK_ALIGN,
    CELL_VALIGN,
    type BlockAlign,
    type CellValign
} from '@ortha-cms/wysiwyg-core';
import { Separator } from '@ortha-cms/design-system';
import { ToolbarButton } from '../../menus/ToolbarButton';
import { useWysiwyg } from '../tiptapContext';
import { tableAround } from '../cellWidth';

const messages = defineMessages({
    label: { id: 'wysiwyg.tableToolbar.label', defaultMessage: 'Table' },
    rowBefore: {
        id: 'wysiwyg.table.rowBefore',
        defaultMessage: 'Insert row above'
    },
    rowAfter: {
        id: 'wysiwyg.table.rowAfter',
        defaultMessage: 'Insert row below'
    },
    columnBefore: {
        id: 'wysiwyg.table.columnBefore',
        defaultMessage: 'Insert column before'
    },
    columnAfter: {
        id: 'wysiwyg.table.columnAfter',
        defaultMessage: 'Insert column after'
    },
    deleteRow: { id: 'wysiwyg.table.deleteRow', defaultMessage: 'Delete row' },
    deleteColumn: {
        id: 'wysiwyg.table.deleteColumn',
        defaultMessage: 'Delete column'
    },
    deleteTable: {
        id: 'wysiwyg.table.deleteTable',
        defaultMessage: 'Delete table'
    },
    headerRow: { id: 'wysiwyg.table.headerRow', defaultMessage: 'Header row' },
    cellLeft: { id: 'wysiwyg.table.cellLeft', defaultMessage: 'Align cell left' },
    cellCenter: {
        id: 'wysiwyg.table.cellCenter',
        defaultMessage: 'Align cell centre'
    },
    cellRight: {
        id: 'wysiwyg.table.cellRight',
        defaultMessage: 'Align cell right'
    },
    cellTop: { id: 'wysiwyg.table.cellTop', defaultMessage: 'Align cell top' },
    cellMiddle: {
        id: 'wysiwyg.table.cellMiddle',
        defaultMessage: 'Align cell middle'
    },
    cellBottom: {
        id: 'wysiwyg.table.cellBottom',
        defaultMessage: 'Align cell bottom'
    },
    tableLeft: { id: 'wysiwyg.table.tableLeft', defaultMessage: 'Align table left' },
    tableCenter: {
        id: 'wysiwyg.table.tableCenter',
        defaultMessage: 'Align table centre'
    },
    tableRight: {
        id: 'wysiwyg.table.tableRight',
        defaultMessage: 'Align table right'
    }
});

/** Where a cell's content sits across, in the order it reads on a toolbar. */
const CELL_ALIGNS: readonly {
    align: BlockAlign;
    Icon: typeof AlignLeft;
    message: 'cellLeft' | 'cellCenter' | 'cellRight';
}[] = [
    { align: BLOCK_ALIGN.Left, Icon: AlignLeft, message: 'cellLeft' },
    { align: BLOCK_ALIGN.Center, Icon: AlignCenter, message: 'cellCenter' },
    { align: BLOCK_ALIGN.Right, Icon: AlignRight, message: 'cellRight' }
];

/** And where it sits down the cell's height. */
const CELL_VALIGNS: readonly {
    valign: CellValign;
    Icon: typeof AlignLeft;
    message: 'cellTop' | 'cellMiddle' | 'cellBottom';
}[] = [
    { valign: CELL_VALIGN.Top, Icon: AlignStartVertical, message: 'cellTop' },
    {
        valign: CELL_VALIGN.Middle,
        Icon: AlignVerticalSpaceAround,
        message: 'cellMiddle'
    },
    { valign: CELL_VALIGN.Bottom, Icon: AlignEndVertical, message: 'cellBottom' }
];

/** Where the table's own box sits in the measure. */
const TABLE_ALIGNS: readonly {
    align: BlockAlign;
    Icon: typeof AlignLeft;
    message: 'tableLeft' | 'tableCenter' | 'tableRight';
}[] = [
    { align: BLOCK_ALIGN.Left, Icon: AlignLeft, message: 'tableLeft' },
    { align: BLOCK_ALIGN.Center, Icon: AlignJustify, message: 'tableCenter' },
    { align: BLOCK_ALIGN.Right, Icon: AlignRight, message: 'tableRight' }
];

/**
 * The table's controls, shown while the caret is inside one.
 *
 * A floating bar rather than the old handles above every column and beside
 * every row. Those handles had to *be* cells — an extra borderless row and
 * column of the table itself — because an absolutely positioned strip has to
 * re-measure every column on every edit and is wrong for the frame in between.
 * That worked, and it cost a control row and a control column in every table,
 * which every operation, every test and every serializer had to know were not
 * really there. Acting on the column and row the **caret is in** needs neither.
 *
 * A table has **three** separate alignments and they are deliberately kept
 * apart: where the table's box sits in the measure, where a cell's content sits
 * across, and where it sits down. Naming them all "align" is what made the old
 * menus ambiguous.
 */
export function TiptapTableToolbar() {
    const intl = useIntl();
    const { editor, readOnly } = useWysiwyg();

    const state = useEditorState({
        editor,
        selector: ({ editor: instance }) => {
            if (!instance) return null;
            const cell = {
                ...instance.getAttributes('tableCell'),
                ...instance.getAttributes('tableHeader')
            };
            return {
                cellAlign: (cell['align'] as string) ?? BLOCK_ALIGN.Left,
                cellValign: (cell['valign'] as string) ?? CELL_VALIGN.Top,
                tableAlign:
                    (tableAround(instance.state)?.node.attrs['align'] as
                        | string
                        | undefined) ?? BLOCK_ALIGN.Left,
                header: instance.isActive('tableHeader')
            };
        }
    });

    /**
     * Stable: `BubbleMenu` dispatches a transaction when this identity moves.
     *
     * Only with the caret at rest. A selection inside a cell belongs to the
     * formatting toolbar — two bars stacked over the same three words is worse
     * than either of them.
     */
    const shouldShow = useCallback(
        ({ editor: instance, from, to }: { editor: Editor; from: number; to: number }) =>
            instance.isEditable && instance.isActive('table') && from === to,
        []
    );

    if (!editor || readOnly || !state) return null;
    const run = () => editor.chain().focus();

    return (
        <BubbleMenu
            editor={editor}
            pluginKey="wysiwygTableToolbar"
            shouldShow={shouldShow}
            role="toolbar"
            aria-label={intl.formatMessage(messages.label)}
            aria-orientation="horizontal"
            className="bg-popover text-popover-foreground z-50 flex flex-wrap items-center gap-0.5 rounded-md border p-1 shadow-md"
        >
            <ToolbarButton
                label={intl.formatMessage(messages.rowBefore)}
                active={false}
                onClick={() => run().addRowBefore().run()}
            >
                <ArrowUpToLine aria-hidden className="size-4" />
            </ToolbarButton>
            <ToolbarButton
                label={intl.formatMessage(messages.rowAfter)}
                active={false}
                onClick={() => run().addRowAfter().run()}
            >
                <ArrowDownToLine aria-hidden className="size-4" />
            </ToolbarButton>
            <ToolbarButton
                label={intl.formatMessage(messages.columnBefore)}
                active={false}
                onClick={() => run().addColumnBefore().run()}
            >
                <ArrowLeftToLine aria-hidden className="size-4" />
            </ToolbarButton>
            <ToolbarButton
                label={intl.formatMessage(messages.columnAfter)}
                active={false}
                onClick={() => run().addColumnAfter().run()}
            >
                <ArrowRightToLine aria-hidden className="size-4" />
            </ToolbarButton>

            <Separator orientation="vertical" className="mx-1 h-5" />
            <ToolbarButton
                label={intl.formatMessage(messages.headerRow)}
                active={state.header}
                onClick={() => run().toggleHeaderRow().run()}
            >
                <Heading aria-hidden className="size-4" />
            </ToolbarButton>

            <Separator orientation="vertical" className="mx-1 h-5" />
            {CELL_ALIGNS.map(({ align, Icon, message }) => (
                <ToolbarButton
                    key={`cell-${align}`}
                    label={intl.formatMessage(messages[message])}
                    active={state.cellAlign === align}
                    onClick={() => run().setBlockAlign(align).run()}
                >
                    <Icon aria-hidden className="size-4" />
                </ToolbarButton>
            ))}
            {CELL_VALIGNS.map(({ valign, Icon, message }) => (
                <ToolbarButton
                    key={`valign-${valign}`}
                    label={intl.formatMessage(messages[message])}
                    active={state.cellValign === valign}
                    onClick={() =>
                        run()
                            .updateAttributes(
                                state.header ? 'tableHeader' : 'tableCell',
                                {
                                    valign:
                                        valign === CELL_VALIGN.Top
                                            ? null
                                            : valign
                                }
                            )
                            .run()
                    }
                >
                    <Icon aria-hidden className="size-4" />
                </ToolbarButton>
            ))}

            <Separator orientation="vertical" className="mx-1 h-5" />
            {TABLE_ALIGNS.map(({ align, Icon, message }) => (
                <ToolbarButton
                    key={`table-${align}`}
                    label={intl.formatMessage(messages[message])}
                    active={state.tableAlign === align}
                    // Not `setBlockAlign`: the caret is inside a cell, so that
                    // command would align the cell's content as well as the
                    // table — which is exactly the confusion the three
                    // alignments are kept apart to avoid.
                    onClick={() => {
                        const table = tableAround(editor.state);
                        if (!table) return;
                        const { tr } = editor.state;
                        tr.setNodeAttribute(
                            table.pos,
                            'align',
                            align === BLOCK_ALIGN.Left ? null : align
                        );
                        editor.view.dispatch(tr);
                    }}
                >
                    <Icon aria-hidden className="size-4" />
                </ToolbarButton>
            ))}

            <Separator orientation="vertical" className="mx-1 h-5" />
            <ToolbarButton
                label={intl.formatMessage(messages.deleteRow)}
                active={false}
                onClick={() => run().deleteRow().run()}
            >
                <span aria-hidden className="text-xs">
                    ⇥
                </span>
            </ToolbarButton>
            <ToolbarButton
                label={intl.formatMessage(messages.deleteColumn)}
                active={false}
                onClick={() => run().deleteColumn().run()}
            >
                <span aria-hidden className="text-xs">
                    ⇤
                </span>
            </ToolbarButton>
            <ToolbarButton
                label={intl.formatMessage(messages.deleteTable)}
                active={false}
                onClick={() => run().deleteTable().run()}
            >
                <Trash2 aria-hidden className="text-destructive size-4" />
            </ToolbarButton>
        </BubbleMenu>
    );
}
