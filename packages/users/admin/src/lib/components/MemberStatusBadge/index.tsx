import { defineMessages, useIntl } from 'react-intl';
import { Badge, cn } from '@ortha-cms/design-system';
import type { MemberStatus } from '../../types/member';

/** Intl descriptors for {@link MemberStatusBadge}, co-located with the component. */
const messages = defineMessages({
    active: {
        id: 'users.status.active',
        defaultMessage: 'Active'
    },
    invited: {
        id: 'users.status.invited',
        defaultMessage: 'Invited'
    },
    disabled: {
        id: 'users.status.disabled',
        defaultMessage: 'Disabled'
    }
});

/** Dot color + label per status; the label keeps color from being the sole signal. */
const APPEARANCE = {
    active: { dot: 'bg-status-active', message: messages.active },
    pending: { dot: 'bg-status-invited', message: messages.invited },
    disabled: { dot: 'bg-muted-foreground', message: messages.disabled }
} as const;

/**
 * The Status column's pill: a leading colored dot plus the status label —
 * green "Active", amber "Invited" (a sent, unaccepted invite), muted
 * "Disabled".
 */
export function MemberStatusBadge({ status }: { status: MemberStatus }) {
    const intl = useIntl();
    const appearance = APPEARANCE[status];

    return (
        <Badge variant="secondary" className="gap-1.5 rounded-xl border-border">
            <span
                aria-hidden
                className={cn('size-1.5 rounded-full', appearance.dot)}
            />
            <span
                className={cn(status === 'disabled' && 'text-muted-foreground')}
            >
                {intl.formatMessage(appearance.message)}
            </span>
        </Badge>
    );
}
