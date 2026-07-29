import { useState, type DragEvent } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { Plus } from 'lucide-react';
import {
    PARAGRAPH_TYPE,
    createBlock,
    pathAfter,
    type BlockPath,
    type WysiwygBlock
} from '@ortha-cms/wysiwyg-core';
import { Button, cn } from '@ortha-cms/design-system';
import { useEditor } from '../../editor/editorContext';
import {
    BLOCK_DRAG_TYPE,
    DROP_EDGE,
    pathKey,
    type DropEdge
} from '../../utils/constants';
import { BlockMenu } from '../../menus/BlockMenu';
import { BlockList } from '../BlockList';
import { UnknownBlock } from '../renderers/UnknownBlock';

const messages = defineMessages({
    insert: {
        id: 'wysiwyg.row.insert',
        defaultMessage: 'Add a block below'
    }
});

/**
 * One block's row: the hover gutter (add + drag handle + block menu), the
 * block's own rendering, and — unless the renderer places them itself — its
 * nested children.
 *
 * Drag-and-drop lives here rather than in a library because the drop target is
 * a **slot between blocks at a given depth**, which is a concept only the block
 * tree has. The row decides which half of itself the pointer is in and hands
 * the resulting path to `commands.move`.
 */
export function BlockRow({
    block,
    path,
    placeholder,
    className
}: {
    block: WysiwygBlock;
    path: BlockPath;
    placeholder?: string;
    className?: string;
}) {
    const intl = useIntl();
    const { views, schema, commands, readOnly, selectedKeys } = useEditor();
    const [dropEdge, setDropEdge] = useState<DropEdge | null>(null);
    const selected = selectedKeys.has(pathKey(path));

    const view = views[block.type];
    const Component = view?.Component ?? UnknownBlock;
    const definition = schema.get(block.type);
    const showsOwnChildren = view?.rendersChildren ?? false;

    const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
        if (!event.dataTransfer.types.includes(BLOCK_DRAG_TYPE)) return;
        event.preventDefault();
        const bounds = event.currentTarget.getBoundingClientRect();
        setDropEdge(
            event.clientY < bounds.top + bounds.height / 2
                ? DROP_EDGE.Before
                : DROP_EDGE.After
        );
    };

    const handleDrop = (event: DragEvent<HTMLDivElement>) => {
        const raw = event.dataTransfer.getData(BLOCK_DRAG_TYPE);
        setDropEdge(null);
        if (!raw) return;
        event.preventDefault();
        const from = raw.split('.').map(Number);
        if (from.some(Number.isNaN)) return;
        commands.move(from, dropEdge === DROP_EDGE.Before ? path : pathAfter(path));
    };

    return (
        <div
            className={cn(
                'group/block relative rounded-sm',
                // A selected block is tinted rather than outlined: a run of
                // selected blocks should read as one region, and per-block
                // borders would draw seams through the middle of it.
                selected && 'bg-primary/15',
                className
            )}
            data-block-path={pathKey(path)}
            data-selected={selected || undefined}
            onDragOver={handleDragOver}
            onDragLeave={() => setDropEdge(null)}
            onDrop={handleDrop}
        >
            {dropEdge && (
                <div
                    aria-hidden
                    className={cn(
                        'bg-primary pointer-events-none absolute inset-x-0 h-0.5 rounded-full',
                        dropEdge === DROP_EDGE.Before ? 'top-0' : 'bottom-0'
                    )}
                />
            )}

            {!readOnly && (
                <div
                    className={cn(
                        // Positioned **outside** the row rather than beside the
                        // text. In the flow it took a fixed 3rem from every row
                        // at every depth, so a bullet nested two levels down
                        // started 6rem further right than its parent — the
                        // indentation of the *content* has to come from nesting
                        // alone, not from the affordances next to it.
                        'absolute top-0.5 right-full mr-1 flex gap-0.5',
                        // Present but invisible until the row is hovered or
                        // something in it has focus, so it never shifts the
                        // text and never disappears mid-keyboard-use.
                        'opacity-0 transition-opacity group-hover/block:opacity-100 focus-within:opacity-100'
                    )}
                >
                    <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label={intl.formatMessage(messages.insert)}
                        className="text-muted-foreground size-6"
                        onClick={() =>
                            commands.insertAfter(path, [
                                createBlock(PARAGRAPH_TYPE)
                            ])
                        }
                    >
                        <Plus aria-hidden className="size-4" />
                    </Button>
                    <BlockMenu block={block} path={path} />
                </div>
            )}

            <div className="min-w-0">
                <Component
                    block={block}
                    path={path}
                    placeholder={
                        definition?.content === 'inline' ? placeholder : undefined
                    }
                />
                {!showsOwnChildren && block.children.length > 0 && (
                    <BlockList
                        blocks={block.children}
                        basePath={path}
                        className="border-border ml-1 border-l pl-4"
                    />
                )}
            </div>
        </div>
    );
}
