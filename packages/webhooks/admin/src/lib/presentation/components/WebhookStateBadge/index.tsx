import { defineMessages, useIntl } from 'react-intl';
import { Badge, BadgeDot } from '@orthacms/design-system';
import type { WebhookEndpoint } from '../../../domain/types/webhook';
import { webhookState } from '../../../domain/webhookHealth';

const messages = defineMessages({
    active: { id: 'webhooks.state.active', defaultMessage: 'Active' },
    paused: { id: 'webhooks.state.paused', defaultMessage: 'Paused' },
    stopped: { id: 'webhooks.state.stopped', defaultMessage: 'Stopped' }
});

const VARIANT = {
    active: 'success',
    paused: 'muted',
    stopped: 'destructive-soft'
} as const;

/**
 * What an endpoint is doing, as a chip: active, paused by someone, or stopped
 * by the delivery worker. The last two must read differently — one is a
 * decision, the other an outage nobody has noticed yet.
 */
export function WebhookStateBadge({
    endpoint
}: {
    endpoint: Pick<WebhookEndpoint, 'enabled' | 'disabledReason'>;
}) {
    const intl = useIntl();
    const state = webhookState(endpoint);
    return (
        <Badge variant={VARIANT[state]}>
            <BadgeDot />
            {intl.formatMessage(messages[state])}
        </Badge>
    );
}
