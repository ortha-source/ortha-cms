import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { Blocks, Plus } from 'lucide-react';
import { Button } from '@orthacms/design-system';

const messages = defineMessages({
    title: {
        id: 'schemaBuilder.empty.title',
        defaultMessage: 'No content types yet'
    },
    description: {
        id: 'schemaBuilder.empty.description',
        defaultMessage:
            'Content types are code. Add one under {folder}, run {command}, and restart the server.'
    },
    create: {
        id: 'schemaBuilder.empty.create',
        defaultMessage:
            'Content types are what entries are made of — an article, an author, a home page. Start with one; it is written as code when you apply it.'
    },
    createButton: {
        id: 'schemaBuilder.empty.createButton',
        defaultMessage: 'Create a content type'
    }
});

/**
 * A model with no types — a fresh app, not a failure. With `onCreate` the
 * builder may add one: the way in; without, how a type is added by hand.
 */
export function ContentModelEmpty({ onCreate }: { onCreate?: () => void }) {
    const intl = useIntl();
    return (
        <div className="mt-8 flex flex-col items-center gap-3 text-center">
            <Blocks className="size-10 text-muted-foreground" aria-hidden />
            <h2 className="text-lg font-medium">
                {intl.formatMessage(messages.title)}
            </h2>
            <p className="max-w-md text-sm text-muted-foreground">
                {onCreate ? (
                    intl.formatMessage(messages.create)
                ) : (
                    <FormattedMessage
                        {...messages.description}
                        values={{
                            folder: (
                                <code
                                    key="folder"
                                    className="font-mono text-xs"
                                >
                                    src/content/
                                </code>
                            ),
                            command: (
                                <code
                                    key="command"
                                    className="font-mono text-xs"
                                >
                                    orthacms content sync
                                </code>
                            )
                        }}
                    />
                )}
            </p>
            {onCreate && (
                <Button onClick={onCreate}>
                    <Plus />
                    {intl.formatMessage(messages.createButton)}
                </Button>
            )}
        </div>
    );
}
