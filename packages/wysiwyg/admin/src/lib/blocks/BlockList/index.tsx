import { defineMessages, useIntl } from 'react-intl';
import { cn } from '@ortha-cms/design-system';
import type { BlockPath, WysiwygBlock } from '@ortha-cms/wysiwyg-core';
import { BlockRow } from '../BlockRow';

const messages = defineMessages({
    startPlaceholder: {
        id: 'wysiwyg.editor.startPlaceholder',
        defaultMessage: "Write something, or press '/' for commands"
    }
});

/**
 * An ordered run of blocks — the editor body, and every nested level under it
 * (a list item's sub-list, a toggle's body, a column). One component for both,
 * so nesting costs nothing to support.
 */
export function BlockList({
    blocks,
    basePath = [],
    className
}: {
    blocks: readonly WysiwygBlock[];
    /** The path of the parent; a child's path is this plus its index. */
    basePath?: BlockPath;
    className?: string;
}) {
    const intl = useIntl();
    // The "press / for commands" hint belongs to an empty *document*, not to
    // every empty line in it — repeated down a draft it reads as clutter.
    const showHint = basePath.length === 0 && blocks.length === 1;

    return (
        <div className={cn('flex flex-col', className)}>
            {blocks.map((block, index) => (
                <BlockRow
                    key={block.id}
                    block={block}
                    path={[...basePath, index]}
                    placeholder={
                        showHint
                            ? intl.formatMessage(messages.startPlaceholder)
                            : undefined
                    }
                />
            ))}
        </div>
    );
}
