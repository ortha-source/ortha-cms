import type { ReactNode } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { Blocks } from 'lucide-react';
import { Container, ContainerHeader } from '@orthacms/design-system';
import { PageTopBar } from '@orthacms/shell-admin';

const messages = defineMessages({
    title: { id: 'schemaBuilder.page.title', defaultMessage: 'Content Model' },
    subtitle: {
        id: 'schemaBuilder.page.subtitle',
        defaultMessage:
            'The content types this app defines, their fields and how they link.'
    }
});

/**
 * The page's identity: top bar and header. Shared by every state of the page
 * and by its skeleton, so the chrome is on screen from the first paint and the
 * `<h1>` exists in every state (axe `page-has-heading-one`).
 */
export function ContentModelChrome({
    actions,
    children
}: {
    actions?: ReactNode;
    children: ReactNode;
}) {
    const intl = useIntl();
    const title = intl.formatMessage(messages.title);
    return (
        <>
            <PageTopBar
                icon={Blocks}
                crumbs={[{ key: 'content-model', label: title }]}
            />
            <Container>
                <ContainerHeader
                    title={title}
                    subtitle={intl.formatMessage(messages.subtitle)}
                    actions={actions}
                />
                {children}
            </Container>
        </>
    );
}
