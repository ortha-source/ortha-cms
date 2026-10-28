import { defineMessages, useIntl } from 'react-intl';
import { ShieldCheck } from 'lucide-react';
import { useHasPermission } from '@orthacms/identity-admin';
import type { NavBadge } from '@orthacms/shell-admin';
import { useReviewQueueSummary } from '../../../application/hooks';

const messages = defineMessages({
    waiting: {
        id: 'protection.nav.badge.waiting',
        defaultMessage:
            '{count, plural, one {# review waiting on you} other {# reviews waiting on you}}'
    }
});

/**
 * What is waiting on the reader in one workspace, as a navigation count —
 * the Reviews row in the workspace sidebar, and the workspace's row in the
 * global sidebar's list. The same number as the page's "Waiting on me" tab,
 * counted by the server so it is not capped at a page.
 *
 * Silent at 0, on a failed read and while loading: a chip is a nudge, and a
 * missing nudge is honest where a wrong number is not. `enabled` is the row's
 * own gate (false when it is hidden); `content:read` is checked here too, so
 * the workspace list — which has no gate of its own — asks nothing for a
 * reader who could not open the page.
 */
export function useReviewsNavBadge(
    workspaceId: string,
    enabled = true
): NavBadge | null {
    const intl = useIntl();
    const canRead = useHasPermission('content:read');
    const { data } = useReviewQueueSummary(workspaceId, enabled && canRead);
    const count = data?.waitingOnMe ?? 0;
    if (!enabled || !canRead || count <= 0) {
        return null;
    }
    return {
        count,
        tone: 'info',
        icon: ShieldCheck,
        label: intl.formatMessage(messages.waiting, { count })
    };
}
