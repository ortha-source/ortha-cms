import { defineMessages, useIntl } from 'react-intl';
import {
    BLOCK_ALIGN,
    CELL_VALIGN,
    CELL_VALIGNS,
    type BlockAlign,
    type BlockAttrs,
    type CellValign
} from '@ortha-cms/wysiwyg-core';
import {
    DropdownMenuItem,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger
} from '@ortha-cms/design-system';

const messages = defineMessages({
    align: {
        id: 'wysiwyg.block.table.alignContent',
        defaultMessage: 'Align content'
    },
    valign: {
        id: 'wysiwyg.block.table.valignContent',
        defaultMessage: 'Vertical align'
    },
    left: { id: 'wysiwyg.align.left', defaultMessage: 'Align left' },
    center: { id: 'wysiwyg.align.center', defaultMessage: 'Align centre' },
    right: { id: 'wysiwyg.align.right', defaultMessage: 'Align right' },
    top: { id: 'wysiwyg.valign.top', defaultMessage: 'Top' },
    middle: { id: 'wysiwyg.valign.middle', defaultMessage: 'Middle' },
    bottom: { id: 'wysiwyg.valign.bottom', defaultMessage: 'Bottom' }
});

/**
 * The three horizontal alignments a cell offers. `justify` is left out on
 * purpose — a cell holds a phrase, and justifying two words is how a table ends
 * up with rivers of whitespace down a column.
 */
const ALIGNS: readonly {
    align: BlockAlign;
    message: 'left' | 'center' | 'right';
}[] = [
    { align: BLOCK_ALIGN.Left, message: 'left' },
    { align: BLOCK_ALIGN.Center, message: 'center' },
    { align: BLOCK_ALIGN.Right, message: 'right' }
];

/** The label each vertical alignment reads as. */
const VALIGN_MESSAGE = {
    [CELL_VALIGN.Top]: 'top',
    [CELL_VALIGN.Middle]: 'middle',
    [CELL_VALIGN.Bottom]: 'bottom'
} as const;

/**
 * The two alignment submenus a row's and a column's handle both carry — one
 * component because they are the same choice asked of a different set of cells,
 * and the menus should not be able to drift apart.
 *
 * Both defaults (`left`, `top`) clear the attribute rather than storing it, so a
 * cell aligned and then put back serializes as one nobody ever aligned.
 */
export function TableCellAlignItems({
    onApply
}: {
    /** Applies the attributes to whichever cells this menu speaks for. */
    onApply(attrs: BlockAttrs): void;
}) {
    const intl = useIntl();

    return (
        <>
            <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                    {intl.formatMessage(messages.align)}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                    {ALIGNS.map(({ align, message }) => (
                        <DropdownMenuItem
                            key={align}
                            onSelect={() =>
                                onApply({
                                    align:
                                        align === BLOCK_ALIGN.Left
                                            ? null
                                            : align
                                })
                            }
                        >
                            {intl.formatMessage(messages[message])}
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuSubContent>
            </DropdownMenuSub>

            <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                    {intl.formatMessage(messages.valign)}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                    {CELL_VALIGNS.map((valign: CellValign) => (
                        <DropdownMenuItem
                            key={valign}
                            onSelect={() =>
                                onApply({
                                    valign:
                                        valign === CELL_VALIGN.Top
                                            ? null
                                            : valign
                                })
                            }
                        >
                            {intl.formatMessage(
                                messages[VALIGN_MESSAGE[valign]]
                            )}
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuSubContent>
            </DropdownMenuSub>
        </>
    );
}
