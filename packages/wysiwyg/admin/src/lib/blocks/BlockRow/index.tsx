import { useState, type DragEvent } from 'react';
import {
    pathAfter,
    type BlockPath,
    type WysiwygBlock
} from '@ortha-cms/wysiwyg-core';
import { cn } from '@ortha-cms/design-system';
import { useEditor } from '../../editor/editorContext';
import {
    BLOCK_DRAG_TYPE,
    DROP_EDGE,
    pathKey,
    type DropEdge
} from '../../utils/constants';
import { BlockList } from '../BlockList';
import { UnknownBlock } from '../renderers/UnknownBlock';

/**
 * One block's row: the block's own rendering and — unless the renderer places
 * them itself — its nested children. The add and drag controls are **not**
 * here; one `BlockGutter` for the whole document parks itself on the row the
 * author is on, and finds it by the `data-block-path` this sets.
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
    const { views, schema, commands } = useEditor();
    const [dropEdge, setDropEdge] = useState<DropEdge | null>(null);

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
        commands.move(
            from,
            dropEdge === DROP_EDGE.Before ? path : pathAfter(path)
        );
    };

    return (
        <div
            className={cn('relative', className)}
            data-block-path={pathKey(path)}
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

            <div className="min-w-0">
                <Component
                    block={block}
                    path={path}
                    placeholder={
                        definition?.content === 'inline'
                            ? placeholder
                            : undefined
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
