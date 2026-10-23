import { defineMessages, useIntl } from 'react-intl';
import { CircleAlert } from 'lucide-react';
import { useHasPermission } from '@orthacms/identity-admin';
import { HomeAttentionCard } from '@orthacms/shell-admin';
import { useWebhookEndpoints } from '../../../application/useWebhookEndpoints';
import { isStopped } from '../../../domain/webhookHealth';

/** Intl descriptors for {@link StoppedWebhooksAttention}, co-located here. */
const messages = defineMessages({
    title: {
        id: 'webhooks.home.stopped.title',
        defaultMessage:
            '{count, plural, one {# webhook stopped} other {# webhooks stopped}}'
    },
    one: {
        id: 'webhooks.home.stopped.one',
        defaultMessage:
            '{name} failed {failures, plural, one {# delivery} other {# deliveries}} in a row and was switched off.'
    },
    many: {
        id: 'webhooks.home.stopped.many',
        defaultMessage: '{names} were switched off after failing in a row.'
    },
    open: {
        id: 'webhooks.home.stopped.open',
        defaultMessage: 'Open webhook'
    },
    openAll: {
        id: 'webhooks.home.stopped.openAll',
        defaultMessage: 'Open webhooks'
    }
});

/**
 * Home's card for webhooks the delivery worker switched off: a receiver that
 * stopped hearing about content changes, and nothing else on screen says so.
 * Renders nothing without `webhooks:read`, or while every endpoint is fine.
 */
export function StoppedWebhooksAttention() {
    const intl = useIntl();
    const canRead = useHasPermission('webhooks:read');
    const { data } = useWebhookEndpoints(canRead);
    const stopped = (data ?? []).filter(isStopped);
    if (!canRead || stopped.length === 0) return null;

    const [first] = stopped;
    return (
        <HomeAttentionCard
            tone="destructive"
            icon={CircleAlert}
            title={intl.formatMessage(messages.title, {
                count: stopped.length
            })}
            description={
                stopped.length === 1
                    ? intl.formatMessage(messages.one, {
                          name: first.name,
                          failures: first.consecutiveFailures
                      })
                    : intl.formatMessage(messages.many, {
                          names: intl.formatList(
                              stopped.map((endpoint) => endpoint.name)
                          )
                      })
            }
            action={intl.formatMessage(
                stopped.length === 1 ? messages.open : messages.openAll
            )}
            to={stopped.length === 1 ? `/webhooks/${first.id}` : '/webhooks'}
        />
    );
}
