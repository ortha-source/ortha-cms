import { defineMessages, useIntl } from 'react-intl';
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
 */
export function ColumnBlock({ block, path }: BlockViewProps) {
    const intl = useIntl();
    return (
        <div
            role="group"
            aria-label={intl.formatMessage(messages.label, {
                position: path[path.length - 1] + 1
            })}
            className="min-w-0 flex-1"
        >
            <BlockList blocks={block.children} basePath={path} />
        </div>
    );
}
