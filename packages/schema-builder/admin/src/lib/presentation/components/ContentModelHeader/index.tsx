import { defineMessages, useIntl } from 'react-intl';
import { Blocks } from 'lucide-react';
import { ContainerHeader } from '@orthacms/design-system';

const messages = defineMessages({
    title: { id: 'schemaBuilder.page.title', defaultMessage: 'Content Model' },
    subtitle: {
        id: 'schemaBuilder.page.subtitle',
        defaultMessage:
            'The content types this app defines, their fields and how they link.'
    }
});

/** The page's own `<h1>` in the editor pane, while no type is open. */
export function ContentModelHeader() {
    const intl = useIntl();
    return (
        <ContainerHeader
            className="mb-0"
            icon={<Blocks className="size-4" />}
            title={intl.formatMessage(messages.title)}
            subtitle={intl.formatMessage(messages.subtitle)}
        />
    );
}
