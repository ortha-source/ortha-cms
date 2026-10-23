import { Link } from 'react-router-dom';
import { defineMessages, useIntl } from 'react-intl';
import { UserPlus } from 'lucide-react';
import { Button } from '@orthacms/design-system';
import { useHasPermission } from '@orthacms/identity-admin';

/** Intl descriptors for {@link InviteMemberHomeAction}, co-located here. */
const messages = defineMessages({
    label: {
        id: 'users.home.invite',
        defaultMessage: 'Invite member'
    }
});

/**
 * The home top bar's **Invite member** button, for someone who may invite
 * (`users:create`). Renders nothing otherwise.
 */
export function InviteMemberHomeAction() {
    const intl = useIntl();
    const canInvite = useHasPermission('users:create');
    if (!canInvite) return null;
    return (
        <Button asChild size="sm" variant="outline">
            <Link to="/users/invite">
                <UserPlus aria-hidden />
                {intl.formatMessage(messages.label)}
            </Link>
        </Button>
    );
}
