import { defineMessages, useIntl } from 'react-intl';
import { FileWarning } from 'lucide-react';
import { useHasPermission } from '@orthacms/identity-admin';
import { HomeAttentionCard } from '@orthacms/shell-admin';
import {
    NOTICE_DEAD_LETTER_LIMIT,
    useDeadLetters
} from '../../../application/useDeadLetters';

/** Intl descriptors for {@link DeadLettersAttention}, co-located here. */
const messages = defineMessages({
    title: {
        id: 'activity.home.deadLetters.title',
        defaultMessage:
            '{count, plural, one {# action not recorded} other {# actions not recorded}}'
    },
    description: {
        id: 'activity.home.deadLetters.description',
        defaultMessage:
            'The audit log is incomplete — these gave up after repeated failures.'
    },
    action: {
        id: 'activity.home.deadLetters.action',
        defaultMessage: 'Open Activity'
    }
});

/**
 * Home's card for audit events that could not be recorded — the same count
 * the Activity page's banner shows, said where an administrator lands.
 * Renders nothing without `activity:read` (the read itself needs it), or
 * while the log is complete.
 */
export function DeadLettersAttention() {
    const intl = useIntl();
    const canRead = useHasPermission('activity:read');
    // The banner's own limit, so the two share one cache entry.
    const { data } = useDeadLetters(NOTICE_DEAD_LETTER_LIMIT, canRead);
    const total = data?.total ?? 0;
    if (!canRead || total === 0) return null;
    return (
        <HomeAttentionCard
            tone="destructive"
            icon={FileWarning}
            title={intl.formatMessage(messages.title, { count: total })}
            description={intl.formatMessage(messages.description)}
            action={intl.formatMessage(messages.action)}
            to="/activity"
        />
    );
}
