import { defineMessages, useIntl } from 'react-intl';

const messages = defineMessages({
    label: {
        id: 'wysiwyg.block.divider.label',
        defaultMessage: 'Divider'
    }
});

/**
 * A horizontal rule. It holds no text at all, so it takes no caret — the arrow
 * keys step over it and Backspace from the block below deletes it (see
 * `focusNeighbour` and `mergeBackward`).
 */
export function DividerBlock() {
    const intl = useIntl();
    return (
        <div
            className="py-3"
            role="separator"
            aria-label={intl.formatMessage(messages.label)}
        >
            <hr className="border-border" />
        </div>
    );
}
