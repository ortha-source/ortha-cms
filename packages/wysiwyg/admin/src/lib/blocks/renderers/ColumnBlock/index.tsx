import { defineMessages, useIntl } from 'react-intl';
import { cn } from '@ortha-cms/design-system';
import { BlockList } from '../../BlockList';
import type { BlockViewProps } from '../../blockRegistry';

const messages = defineMessages({
    label: {
        id: 'wysiwyg.block.column.label',
        defaultMessage: 'Column {position}'
    }
});

/**
 * One column of a layout. It draws nothing of its own — it is a place blocks
 * sit in — which is exactly why the model needs it: without a node per column,
 * "which side is this paragraph on" would have to be an attribute on every
 * block inside it.
 *
 * Nothing except a **rule down its left edge**, and only in the editor. Two
 * paragraphs side by side with nothing between them read as one paragraph that
 * has gone wrong: the gap alone does not say "these are columns", and an author
 * who cannot see the boundary cannot tell which column they are typing in. It
 * is editor chrome and is not serialized — whether columns are ruled where the
 * document is finally rendered is that surface's decision, not something this
 * editor should freeze into stored HTML.
 */
export function ColumnBlock({ block, path }: BlockViewProps) {
    const intl = useIntl();
    const position = path[path.length - 1];
    return (
        <div
            role="group"
            aria-label={intl.formatMessage(messages.label, {
                position: position + 1
            })}
            className={cn(
                'min-w-0 flex-1',
                // Only *between* columns, and only once they are side by side:
                // stacked on a narrow viewport, a vertical rule down the left
                // of each would be pointing the wrong way.
                position > 0 && 'sm:border-border sm:border-l sm:pl-3'
            )}
        >
            <BlockList blocks={block.children} basePath={path} />
        </div>
    );
}
