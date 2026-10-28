import { defineMessages, useIntl } from 'react-intl';
import { Link } from 'react-router-dom';
import { Inbox } from 'lucide-react';
import { Container, ContainerHeader } from '@orthacms/design-system';
import { byOrder } from '@orthacms/utils-admin';
import { PageTopBar } from '@orthacms/shell-admin';
import { INBOX_SETTINGS_SLOT } from '../../slots/inboxSlots';

const messages = defineMessages({
    inbox: { id: 'inbox.title', defaultMessage: 'Inbox' },
    title: {
        id: 'inbox.settings.title',
        defaultMessage: 'Notification settings'
    },
    subtitle: {
        id: 'inbox.settings.subtitle',
        defaultMessage:
            'What reaches you by email. Your inbox always holds everything.'
    },
    none: {
        id: 'inbox.settings.none',
        defaultMessage: 'There is nothing to configure on this installation.'
    },
    back: { id: 'inbox.settings.back', defaultMessage: 'Back to your inbox' }
});

/**
 * `/inbox/settings` — the reader's own notification settings, one section per
 * contributing plugin ({@link INBOX_SETTINGS_SLOT}). The digest's link points
 * here, so it must exist even with nothing to set; then it says so.
 */
export function InboxSettingsPage() {
    const intl = useIntl();
    const sections = byOrder(INBOX_SETTINGS_SLOT.getItems());
    return (
        <>
            <PageTopBar
                icon={Inbox}
                crumbs={[
                    {
                        key: 'inbox',
                        label: intl.formatMessage(messages.inbox),
                        to: '/inbox'
                    },
                    {
                        key: 'settings',
                        label: intl.formatMessage(messages.title)
                    }
                ]}
            />
            <Container className="flex max-w-3xl flex-col gap-6">
                <ContainerHeader
                    title={intl.formatMessage(messages.title)}
                    subtitle={intl.formatMessage(messages.subtitle)}
                />
                {sections.length ? (
                    sections.map(({ id, Component }) => <Component key={id} />)
                ) : (
                    <p className="text-sm text-muted-foreground">
                        {intl.formatMessage(messages.none)}
                    </p>
                )}
                <Link to="/inbox" className="text-sm underline">
                    {intl.formatMessage(messages.back)}
                </Link>
            </Container>
        </>
    );
}
