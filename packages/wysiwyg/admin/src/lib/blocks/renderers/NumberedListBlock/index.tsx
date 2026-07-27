import { defineMessages, useIntl } from 'react-intl';
import { InlineEditable } from '../../InlineEditable';
import type { BlockViewProps } from '../../blockRegistry';

const messages = defineMessages({
    label: {
        id: 'wysiwyg.block.numberedList.label',
        defaultMessage: 'Numbered item'
    }
});

/**
 * One numbered item. The number shown is the item's position among its
 * **siblings** — which is exactly what the `<ol>` will render, because the
 * serializer groups the same run into one list.
 */
export function NumberedListBlock({ block, path }: BlockViewProps) {
    const intl = useIntl();
    const position = path[path.length - 1] + 1;
    return (
        <div className="flex items-start gap-2 py-0.5">
            <span
                aria-hidden
                className="text-muted-foreground mt-1 w-4 shrink-0 text-right text-sm tabular-nums leading-7"
            >
                {position}.
            </span>
            <InlineEditable
                path={path}
                html={block.html}
                ariaLabel={intl.formatMessage(messages.label)}
                className="flex-1 py-1 leading-7"
            />
        </div>
    );
}
