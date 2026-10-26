import { defineMessages, useIntl } from 'react-intl';
import { Badge, BadgeDot } from '@orthacms/design-system';
import type { MemberStatus } from '../../../../domain/types/member';

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

/** Badge tone and label per status; the word keeps colour from being the only signal. */
const APPEARANCE = {
    active: { variant: 'success', message: messages.active },
    pending: { variant: 'warning', message: messages.invited },
    disabled: { variant: 'muted', message: messages.disabled }
} as const;

/**
 * A member's status as a dotted badge — green "Active", amber "Invited" (a
 * sent, unaccepted invite), muted "Disabled".
 */
export function MemberStatusBadge({ status }: { status: MemberStatus }) {
    const intl = useIntl();
    const appearance = APPEARANCE[status];

    return (
        <Badge size="xs" variant={appearance.variant}>
            <BadgeDot />
            {intl.formatMessage(appearance.message)}
        </Badge>
    );
}
