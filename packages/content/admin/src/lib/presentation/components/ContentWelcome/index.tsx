import { defineMessages, useIntl } from 'react-intl';
import {
    Container,
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle
} from '@ortha-cms/design-system';
import { LibraryBig } from 'lucide-react';

/** Intl descriptors for the content-library landing, co-located here. */
const messages = defineMessages({
    title: {
        id: 'content.welcome.title',
        defaultMessage: 'Content Library'
    },
    body: {
        id: 'content.welcome.body',
        defaultMessage:
            'Select a collection or page from the sidebar to get started in {workspace}.'
    }
});

type ContentWelcomeProps = {
    /** Name of the open workspace, woven into the prompt. */
    workspaceName: string;
};

/**
 * The Content Library index pane, shown before a content type is selected.
 * A friendly prompt to pick a collection or page from the second sidebar.
 */
export function ContentWelcome({ workspaceName }: ContentWelcomeProps) {
    const intl = useIntl();

    return (
        <Container className="py-8">
            <Empty>
                <EmptyHeader>
                    <EmptyMedia variant="icon">
                        <LibraryBig />
                    </EmptyMedia>
                    <EmptyTitle>
                        {intl.formatMessage(messages.title)}
                    </EmptyTitle>
                    <EmptyDescription>
                        {intl.formatMessage(messages.body, {
                            workspace: workspaceName
                        })}
                    </EmptyDescription>
                </EmptyHeader>
            </Empty>
        </Container>
    );
}
