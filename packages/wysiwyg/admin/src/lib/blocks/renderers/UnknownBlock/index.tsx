import { defineMessages, useIntl } from 'react-intl';
import { InlineEditable } from '../../InlineEditable';
import type { BlockViewProps } from '../../blockRegistry';

const messages = defineMessages({
    label: {
        id: 'wysiwyg.block.unknown.label',
        defaultMessage: 'Text block'
    },
    notice: {
        id: 'wysiwyg.block.unknown.notice',
        defaultMessage: 'Unsupported block ({type}) — shown as text.'
    }
});

/**
 * The fallback for a block whose type has no renderer — content written by a
 * newer editor, or a plugin block whose plugin is no longer installed.
 *
 * It renders the text **editable** rather than hiding it or dropping it: the
 * author's words are the one thing that must survive a schema mismatch, and a
 * block nobody can see is a block that gets deleted by accident.
 */
export function UnknownBlock({ block, path }: BlockViewProps) {
    const intl = useIntl();
    return (
        <div className="border-border/70 my-1 rounded-md border border-dashed px-3 py-2">
            <p className="text-muted-foreground mb-1 text-xs">
                {intl.formatMessage(messages.notice, { type: block.type })}
            </p>
            <InlineEditable
                path={path}
                html={block.html}
                ariaLabel={intl.formatMessage(messages.label)}
                className="leading-7"
            />
        </div>
    );
}
