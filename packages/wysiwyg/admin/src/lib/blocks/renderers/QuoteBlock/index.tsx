import { defineMessages, useIntl } from 'react-intl';
import { InlineEditable } from '../../InlineEditable';
import type { BlockViewProps } from '../../blockRegistry';

const messages = defineMessages({
    label: {
        id: 'wysiwyg.block.quote.label',
        defaultMessage: 'Quote'
    },
    placeholder: {
        id: 'wysiwyg.block.quote.placeholder',
        defaultMessage: 'Quote'
    }
});

/** A pull quote. */
export function QuoteBlock({ block, path }: BlockViewProps) {
    const intl = useIntl();
    return (
        <div className="border-border my-1 border-l-2 pl-4">
            <InlineEditable
                path={path}
                html={block.html}
                placeholder={intl.formatMessage(messages.placeholder)}
                ariaLabel={intl.formatMessage(messages.label)}
                className="py-1 leading-7 italic"
            />
        </div>
    );
}
