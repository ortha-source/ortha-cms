import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { Blocks } from 'lucide-react';

const messages = defineMessages({
    title: {
        id: 'schemaBuilder.empty.title',
        defaultMessage: 'No content types yet'
    },
    description: {
        id: 'schemaBuilder.empty.description',
        defaultMessage:
            'Content types are code. Add one under {folder}, run {command}, and restart the server.'
    }
});

/** A model with no types — a fresh app, not a failure. */
export function ContentModelEmpty() {
    const intl = useIntl();
    return (
        <div className="mt-8 flex flex-col items-center gap-3 text-center">
            <Blocks className="size-10 text-muted-foreground" aria-hidden />
            <h2 className="text-lg font-medium">
                {intl.formatMessage(messages.title)}
            </h2>
            <p className="max-w-md text-sm text-muted-foreground">
                <FormattedMessage
                    {...messages.description}
                    values={{
                        folder: (
                            <code key="folder" className="font-mono text-xs">
                                src/content/
                            </code>
                        ),
                        command: (
                            <code key="command" className="font-mono text-xs">
                                orthacms content sync
                            </code>
                        )
                    }}
                />
            </p>
        </div>
    );
}
