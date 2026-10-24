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
 * and by its skeleton, so the chrome is on screen from the first paint.
 *
 * `flush` hands the body the whole work area — the two-pane workspace, whose
 * rail runs its full height and whose editor pane draws its own `<h1>` (the
 * open type's name, or the page's when there is none). Otherwise the body
 * sits in the page measure under the page's own header, and the `<h1>` exists
 * in every state (axe `page-has-heading-one`). `crumb` names the open type
 * after "Content Model" in the top bar, which then links back to the page.
 */
export function ContentModelChrome({
    actions,
    crumb,
    flush = false,
    children
}: {
    actions?: ReactNode;
    crumb?: string;
    flush?: boolean;
    children: ReactNode;
}) {
    const intl = useIntl();
    const title = intl.formatMessage(messages.title);
    return (
        <>
            <PageTopBar
                icon={Blocks}
                crumbs={[
                    {
                        key: 'content-model',
                        label: title,
                        to: crumb ? '/content-model' : undefined
                    },
                    ...(crumb ? [{ key: 'type', label: crumb }] : [])
                ]}
            />
            {flush ? (
                children
            ) : (
                <Container>
                    <ContainerHeader
                        title={title}
                        subtitle={intl.formatMessage(messages.subtitle)}
                        actions={actions}
                    />
                    {children}
                </Container>
            )}
        </>
    );
}
