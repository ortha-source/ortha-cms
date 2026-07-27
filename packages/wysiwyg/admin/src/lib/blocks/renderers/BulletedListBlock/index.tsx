import { defineMessages, useIntl } from 'react-intl';
import { InlineEditable } from '../../InlineEditable';
import type { BlockViewProps } from '../../blockRegistry';

const messages = defineMessages({
    label: {
        id: 'wysiwyg.block.bulletedList.label',
        defaultMessage: 'List item'
    }
});

/**
 * One bullet. The marker is drawn, not a real `<li>` marker: each item is its
 * own block (its own row, handle and menu), and only the serializer knows they
 * are a list.
 */
export function BulletedListBlock({ block, path }: BlockViewProps) {
    const intl = useIntl();
    return (
        <div className="flex items-start gap-2 py-0.5">
            <span
                aria-hidden
                className="text-muted-foreground mt-3 size-1.5 shrink-0 rounded-full bg-current"
            />
            <InlineEditable
                path={path}
                html={block.html}
                ariaLabel={intl.formatMessage(messages.label)}
                className="flex-1 py-1 leading-7"
            />
        </div>
    );
}
