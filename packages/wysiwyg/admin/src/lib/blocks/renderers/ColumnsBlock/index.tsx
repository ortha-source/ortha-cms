import { defineMessages, useIntl } from 'react-intl';
import { Plus } from 'lucide-react';
import {
    BLOCK_TYPE,
    PARAGRAPH_TYPE,
    createBlock
} from '@ortha-cms/wysiwyg-core';
import { Button } from '@ortha-cms/design-system';
import { useEditor } from '../../../editor/editorContext';
import { ColumnBlock } from '../ColumnBlock';
import type { BlockViewProps } from '../../blockRegistry';

const messages = defineMessages({
    label: {
        id: 'wysiwyg.block.columns.label',
        defaultMessage: 'Column layout'
    },
    addColumn: {
        id: 'wysiwyg.block.columns.addColumn',
        defaultMessage: 'Add a column'
    }
});

/** Columns beyond which the layout stops being readable in the editor. */
const MAX_COLUMNS = 4;

/**
 * A side-by-side layout. Its children are columns, each holding arbitrary
 * blocks — the model is a tree, so nothing here is special-cased: a column
 * renders the same {@link BlockList} the top level does.
 */
export function ColumnsBlock({ block, path }: BlockViewProps) {
    const intl = useIntl();
    const { commands, readOnly } = useEditor();

    return (
        <section
            aria-label={intl.formatMessage(messages.label)}
            className="my-2"
        >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
                {block.children.map((column, index) => (
                    <ColumnBlock
                        key={column.id}
                        block={column}
                        path={[...path, index]}
                    />
                ))}
            </div>
            {!readOnly && block.children.length < MAX_COLUMNS && (
                <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-muted-foreground mt-1 h-7 px-2 text-xs"
                    onClick={() =>
                        commands.insertAfter(
                            [...path, block.children.length - 1],
                            [
                                createBlock(BLOCK_TYPE.Column, {
                                    children: [createBlock(PARAGRAPH_TYPE)]
                                })
                            ]
                        )
                    }
                >
                    <Plus aria-hidden className="size-3.5" />
                    {intl.formatMessage(messages.addColumn)}
                </Button>
            )}
        </section>
    );
}
