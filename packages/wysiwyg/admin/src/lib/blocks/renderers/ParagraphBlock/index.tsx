import { defineMessages, useIntl } from 'react-intl';
import { InlineEditable } from '../../InlineEditable';
import type { BlockViewProps } from '../../blockRegistry';

const messages = defineMessages({
    label: {
        id: 'wysiwyg.block.paragraph.label',
        defaultMessage: 'Text block'
    }
});

/** Plain prose — the default block. */
export function ParagraphBlock({ block, path, placeholder }: BlockViewProps) {
    const intl = useIntl();
    return (
        <InlineEditable
            path={path}
            html={block.html}
            placeholder={placeholder}
            ariaLabel={intl.formatMessage(messages.label)}
            className="py-1 leading-7"
        />
    );
}
