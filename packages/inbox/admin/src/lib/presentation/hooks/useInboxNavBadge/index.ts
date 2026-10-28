import { defineMessages, useIntl } from 'react-intl';
import type { NavBadge } from '@orthacms/shell-admin';
import { useInboxSummary } from '../../../application/hooks';

const messages = defineMessages({
    unread: {
        id: 'inbox.nav.badge',
        defaultMessage: '{count, plural, one {# unread} other {# unread}}'
    }
});

/**
 * The Inbox row's count in the global sidebar — everything unread, across
 * workspaces. `strong`, not a severity tone: it is a total of several kinds
 * of thing, and the tabs say which. Silent at 0, while loading and on a
 * failed read.
 */
export function useInboxNavBadge(enabled = true): NavBadge | null {
    const intl = useIntl();
    const { data } = useInboxSummary(enabled);
    const count = data?.unread ?? 0;
    if (!enabled || count <= 0) return null;
    return {
        count,
        tone: 'strong',
        label: intl.formatMessage(messages.unread, { count })
    };
}
